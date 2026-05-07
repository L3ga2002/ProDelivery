from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta, timezone
from database import db
from auth import get_current_user
from models.schedule import AutoGenerateScheduleRequest, BulkDeleteScheduleRequest, ScheduleCreate, ScheduleUpdate, Schedule
from utils.driver_ranking import build_driver_ranking_payload, build_tier_access_state, ROMANIA_TZ

router = APIRouter(prefix="/schedules", tags=["schedules"])

# Driver can only set hours 10:00-22:00
DRIVER_ALLOWED_HOURS = [f"{h:02d}:00" for h in range(10, 22)]
# Admin can set all hours 10:00-02:00
ADMIN_ALLOWED_HOURS = [f"{h:02d}:00" for h in list(range(10, 24)) + [0, 1]]
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def calc_total_hours(slots: dict) -> float:
    total = 0.0
    for day, time_slots in slots.items():
        total += len(time_slots)
    return round(total, 2)


def validate_driver_slots(slots: dict):
    """Ensure driver only sets hours within 10:00-22:00"""
    for day, time_slots in slots.items():
        for slot in time_slots:
            if slot.get("added_by") == "admin":
                continue
            if slot["start"] not in DRIVER_ALLOWED_HOURS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Livratorii pot selecta ore doar între 10:00-22:00. Ora {slot['start']} nu este permisă."
                )


async def ensure_schedule_access(current_user: dict, driver_id: str) -> bool:
    is_admin = current_user["role"] == "admin"
    if current_user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
        if not driver or driver["id"] != driver_id:
            raise HTTPException(status_code=403, detail="Cannot edit another driver's schedule")
        ranking = await build_driver_ranking_payload(db, driver)
        if not ranking["schedule_access"]["can_select_schedule"]:
            raise HTTPException(
                status_code=403,
                detail=f"Calendarul se deschide pentru tier-ul {ranking['ranking_tier']} la {ranking['schedule_access']['opens_at']}"
            )
        return False
    if not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return True


def serialize_slots(slot_groups: dict) -> dict:
    return {day: [slot.model_dump() for slot in slots] for day, slots in slot_groups.items()}


def merge_driver_slots(existing_schedule: dict | None, submitted_slots: dict) -> dict:
    if not existing_schedule or not existing_schedule.get("slots"):
        return submitted_slots

    merged_slots = {day: list(slots) for day, slots in submitted_slots.items()}
    for day, current_slots in existing_schedule["slots"].items():
        admin_slots = [slot for slot in current_slots if slot.get("added_by") == "admin"]
        driver_slots = [slot for slot in merged_slots.get(day, []) if slot.get("added_by") != "admin"]
        merged_slots[day] = driver_slots + admin_slots
    return merged_slots


def tag_admin_slots(slots_dict: dict, source: str) -> None:
    for day, slots in slots_dict.items():
        for slot in slots:
            if "added_by" not in slot:
                slot["added_by"] = source


def _hour_range(start_hour: str, end_hour: str) -> list[str]:
    start = int(start_hour.split(":")[0])
    end = int(end_hour.split(":")[0])
    hours = []
    current = start
    while current != end:
        value = f"{current:02d}:00"
        if value not in ADMIN_ALLOWED_HOURS:
            raise HTTPException(status_code=400, detail=f"Ora {value} nu este permisă pentru program")
        hours.append(value)
        current = (current + 1) % 24
        if len(hours) > 24:
            raise HTTPException(status_code=400, detail="Interval orar invalid")
    return hours


def _slot_end(hour: str) -> str:
    end_h = (int(hour.split(":")[0]) + 1) % 24
    return f"{end_h:02d}:00"


def _week_offset(week_start: str, offset: int) -> str:
    start = datetime.fromisoformat(week_start)
    return (start + timedelta(days=offset * 7)).date().isoformat()


async def upsert_schedule_record(data: ScheduleCreate, slots_dict: dict, total_hours: float) -> dict:
    existing = await db.schedules.find_one(
        {"driver_id": data.driver_id, "week_start": data.week_start}
    )

    if existing:
        await db.schedules.update_one(
            {"driver_id": data.driver_id, "week_start": data.week_start},
            {"$set": {"slots": slots_dict, "total_hours": total_hours}}
        )
        return {"message": "Schedule updated", "total_hours": total_hours}

    schedule = Schedule(
        driver_id=data.driver_id,
        week_start=data.week_start,
        slots=slots_dict,
        total_hours=total_hours
    )
    doc = schedule.model_dump()
    await db.schedules.insert_one(doc)
    return {"message": "Schedule created", "id": schedule.id, "total_hours": total_hours}


async def build_driver_summary(driver: dict, week_start: str | None) -> dict:
    query = {"driver_id": driver["id"]}
    if week_start:
        query["week_start"] = week_start

    schedules = await db.schedules.find(query, {"_id": 0}).to_list(60)
    total_hours = sum(schedule.get("total_hours", 0) for schedule in schedules)
    orders_delivered = await db.orders.count_documents({"driver_id": driver["id"], "status": "DELIVERED"})

    by_restaurant = await db.orders.aggregate([
        {"$match": {"driver_id": driver["id"], "status": "DELIVERED"}},
        {"$group": {"_id": "$restaurant_name", "count": {"$sum": 1}}}
    ]).to_list(100)

    by_zone_raw = await db.orders.aggregate([
        {"$match": {"driver_id": driver["id"]}},
        {"$group": {"_id": "$zone", "count": {"$sum": 1}}}
    ]).to_list(100)

    orders_by_zone = {}
    for zone in by_zone_raw:
        zone_key = zone["_id"] if zone["_id"] else "Neatribuită"
        orders_by_zone[zone_key] = zone["count"]

    ranking = await build_driver_ranking_payload(db, driver)
    return {
        "driver_id": driver["id"],
        "driver_name": driver["name"],
        "phone": driver["phone"],
        "is_active": driver["is_active"],
        "total_hours_scheduled": total_hours,
        "total_orders_delivered": orders_delivered,
        "orders_by_restaurant": {item["_id"]: item["count"] for item in by_restaurant},
        "orders_by_zone": orders_by_zone,
        "schedules": schedules,
        "ranking_priority": ranking["ranking_tier"],
        "ranking_score": ranking["ranking_score"],
        "schedule_access": ranking["schedule_access"],
    }


@router.get("/driver/{driver_id}")
async def get_driver_schedules(driver_id: str, year: int = 2026, current_user: dict = Depends(get_current_user)):
    schedules = await db.schedules.find(
        {"driver_id": driver_id, "week_start": {"$regex": f"^{year}"}},
        {"_id": 0}
    ).to_list(60)
    return schedules


@router.post("")
async def create_or_update_schedule(data: ScheduleCreate, current_user: dict = Depends(get_current_user)):
    is_admin = await ensure_schedule_access(current_user, data.driver_id)

    source = "admin" if is_admin else "driver"
    slots_dict = serialize_slots(data.slots)

    if not is_admin:
        existing = await db.schedules.find_one(
            {"driver_id": data.driver_id, "week_start": data.week_start},
            {"_id": 0}
        )
        validate_driver_slots(slots_dict)
        slots_dict = merge_driver_slots(existing, slots_dict)
    else:
        tag_admin_slots(slots_dict, source)

    total_hours = calc_total_hours(slots_dict)
    return await upsert_schedule_record(data, slots_dict, total_hours)


@router.put("/{schedule_id}")
async def update_schedule(schedule_id: str, data: ScheduleUpdate, current_user: dict = Depends(get_current_user)):
    schedule = await db.schedules.find_one({"id": schedule_id}, {"_id": 0})
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if current_user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
        if not driver or driver["id"] != schedule["driver_id"]:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    slots_dict = {day: [s.model_dump() for s in slots] for day, slots in data.slots.items()}
    total_hours = calc_total_hours(slots_dict)

    await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": {"slots": slots_dict, "total_hours": total_hours}}
    )
    return {"message": "Schedule updated", "total_hours": total_hours}


@router.get("/admin/summary")
async def get_admin_schedule_summary(week_start: str = None, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    return [await build_driver_summary(driver, week_start) for driver in drivers]


@router.post("/admin/auto-generate")
async def auto_generate_normal_slots(data: AutoGenerateScheduleRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    if data.total_slots < 1:
        raise HTTPException(status_code=400, detail="Minimum 1 slot")
    if not data.days or any(day not in DAYS for day in data.days):
        raise HTTPException(status_code=400, detail="Zile invalide")

    hours = _hour_range(data.start_hour, data.end_hour)
    drivers = await db.drivers.find({"is_active": True}, {"_id": 0}).sort("name", 1).to_list(300)
    if not drivers:
        raise HTTPException(status_code=400, detail="Nu există livratori activi")

    touched = 0
    for repeat_index in range(max(data.repeat_weeks, 1)):
        target_week = _week_offset(data.week_start, repeat_index)
        for day in data.days:
            for hour_index, hour in enumerate(hours):
                selected_drivers = [drivers[(hour_index + idx) % len(drivers)] for idx in range(min(data.total_slots, len(drivers)))]
                for driver in selected_drivers:
                    schedule = await db.schedules.find_one({"driver_id": driver["id"], "week_start": target_week}, {"_id": 0})
                    slots = schedule.get("slots", {}) if schedule else {}
                    day_slots = slots.get(day, [])
                    if any(slot.get("start") == hour for slot in day_slots):
                        continue
                    day_slots.append({"start": hour, "end": _slot_end(hour), "added_by": "auto"})
                    slots[day] = day_slots
                    total_hours = calc_total_hours(slots)
                    if schedule:
                        await db.schedules.update_one(
                            {"driver_id": driver["id"], "week_start": target_week},
                            {"$set": {"slots": slots, "total_hours": total_hours}},
                        )
                    else:
                        doc = Schedule(driver_id=driver["id"], week_start=target_week, slots=slots, total_hours=total_hours).model_dump()
                        await db.schedules.insert_one(doc)
                    touched += 1

    return {"message": f"Generate normală completă: {touched} sloturi adăugate", "created_slots": touched}


@router.post("/admin/bulk-delete")
async def bulk_delete_generated_slots(data: BulkDeleteScheduleRequest, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    hours = set(_hour_range(data.start_hour, data.end_hour))
    schedules = await db.schedules.find({"week_start": data.week_start}, {"_id": 0}).to_list(500)
    removed = 0
    for schedule in schedules:
        slots = schedule.get("slots", {})
        changed = False
        for day in data.days:
            current_slots = slots.get(day, [])
            filtered = [slot for slot in current_slots if not (slot.get("added_by") == data.added_by and slot.get("start") in hours)]
            removed += len(current_slots) - len(filtered)
            if len(filtered) != len(current_slots):
                slots[day] = filtered
                changed = True
        if changed:
            await db.schedules.update_one(
                {"id": schedule["id"]},
                {"$set": {"slots": slots, "total_hours": calc_total_hours(slots)}},
            )
    return {"message": f"Ștergere bulk completă: {removed} sloturi eliminate", "deleted_slots": removed}


@router.get("/scheduling-window")
async def get_scheduling_window(current_user: dict = Depends(get_current_user)):
    now_local = datetime.now(ROMANIA_TZ)

    if current_user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")
        ranking = await build_driver_ranking_payload(db, driver)
        access = ranking["schedule_access"]
        return {
            "is_open": access["can_select_schedule"],
            "can_select_schedule": access["can_select_schedule"],
            "tier": ranking["ranking_tier"],
            "tier_key": ranking["ranking_tier_key"],
            "score": ranking["ranking_score"],
            "opens_at": access["opens_at"],
            "opens_at_label": access["opens_at_label"],
            "closes_at": access["closes_at"],
            "closes_at_label": access["closes_at_label"],
            "next_open_at": access["next_open_at"],
            "next_open_at_label": access["next_open_at_label"],
            "current_local_time": access["current_local_time"],
        }

    global_access = build_tier_access_state("gold")
    return {
        "is_open": global_access["can_select_schedule"],
        "opens_at": global_access["opens_at"],
        "closes_at": global_access["closes_at"],
        "current_local_time": now_local.isoformat(),
    }
