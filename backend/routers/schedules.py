from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from models.schedule import ScheduleCreate, ScheduleUpdate, Schedule

router = APIRouter(prefix="/schedules", tags=["schedules"])

# Driver can only set hours 10:00-22:00
DRIVER_ALLOWED_HOURS = [f"{h:02d}:00" for h in range(10, 22)]
# Admin can set all hours 10:00-02:00
ADMIN_ALLOWED_HOURS = [f"{h:02d}:00" for h in list(range(10, 24)) + [0, 1]]


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


@router.get("/driver/{driver_id}")
async def get_driver_schedules(driver_id: str, year: int = 2026, current_user: dict = Depends(get_current_user)):
    schedules = await db.schedules.find(
        {"driver_id": driver_id, "week_start": {"$regex": f"^{year}"}},
        {"_id": 0}
    ).to_list(60)
    return schedules


@router.post("")
async def create_or_update_schedule(data: ScheduleCreate, current_user: dict = Depends(get_current_user)):
    is_admin = current_user["role"] == "admin"

    if current_user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
        if not driver or driver["id"] != data.driver_id:
            raise HTTPException(status_code=403, detail="Cannot edit another driver's schedule")
    elif not is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    source = "admin" if is_admin else "driver"
    slots_dict = {}

    for day, slot_list in data.slots.items():
        slots_dict[day] = [s.model_dump() for s in slot_list]

    if not is_admin:
        # Driver: validate hours + preserve admin-assigned night slots
        existing = await db.schedules.find_one(
            {"driver_id": data.driver_id, "week_start": data.week_start},
            {"_id": 0}
        )

        # Check driver's own slots are within allowed range
        for day, slot_list in slots_dict.items():
            for slot in slot_list:
                if slot.get("added_by") == "admin":
                    continue
                if slot["start"] not in DRIVER_ALLOWED_HOURS:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Poți selecta ore doar între 10:00-22:00."
                    )

        # Merge: keep admin night slots, replace driver day slots
        if existing and existing.get("slots"):
            for day in existing["slots"]:
                admin_slots = [s for s in existing["slots"].get(day, []) if s.get("added_by") == "admin"]
                driver_new_slots = [s for s in slots_dict.get(day, []) if s.get("added_by") != "admin"]
                slots_dict[day] = driver_new_slots + admin_slots
    else:
        # Admin: tag all slots with source
        for day in slots_dict:
            for slot in slots_dict[day]:
                if "added_by" not in slot:
                    slot["added_by"] = source

    total_hours = calc_total_hours(slots_dict)

    existing = await db.schedules.find_one(
        {"driver_id": data.driver_id, "week_start": data.week_start}
    )

    if existing:
        await db.schedules.update_one(
            {"driver_id": data.driver_id, "week_start": data.week_start},
            {"$set": {"slots": slots_dict, "total_hours": total_hours}}
        )
        return {"message": "Schedule updated", "total_hours": total_hours}
    else:
        schedule = Schedule(
            driver_id=data.driver_id,
            week_start=data.week_start,
            slots=slots_dict,
            total_hours=total_hours
        )
        doc = schedule.model_dump()
        await db.schedules.insert_one(doc)
        return {"message": "Schedule created", "id": schedule.id, "total_hours": total_hours}


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
    result = []

    for driver in drivers:
        query = {"driver_id": driver["id"]}
        if week_start:
            query["week_start"] = week_start

        schedules = await db.schedules.find(query, {"_id": 0}).to_list(60)
        total_hours = sum(s.get("total_hours", 0) for s in schedules)

        # Count orders delivered by this driver
        order_query = {"driver_id": driver["id"], "status": "DELIVERED"}
        orders_delivered = await db.orders.count_documents(order_query)

        # Orders by restaurant
        pipeline_rest = [
            {"$match": {"driver_id": driver["id"], "status": "DELIVERED"}},
            {"$group": {"_id": "$restaurant_name", "count": {"$sum": 1}}}
        ]
        by_restaurant = await db.orders.aggregate(pipeline_rest).to_list(100)

        # Orders by zone (using customer_address zone detection)
        pipeline_zone = [
            {"$match": {"driver_id": driver["id"]}},
            {"$group": {"_id": "$zone", "count": {"$sum": 1}}}
        ]
        by_zone_raw = await db.orders.aggregate(pipeline_zone).to_list(100)
        orders_by_zone = {}
        for z in by_zone_raw:
            zone_key = z["_id"] if z["_id"] else "Neatribuită"
            orders_by_zone[zone_key] = z["count"]

        result.append({
            "driver_id": driver["id"],
            "driver_name": driver["name"],
            "phone": driver["phone"],
            "is_active": driver["is_active"],
            "total_hours_scheduled": total_hours,
            "total_orders_delivered": orders_delivered,
            "orders_by_restaurant": {r["_id"]: r["count"] for r in by_restaurant},
            "orders_by_zone": orders_by_zone,
            "schedules": schedules,
            "ranking_priority": None  # Future: ranking system
        })

    return result


@router.get("/scheduling-window")
async def get_scheduling_window(current_user: dict = Depends(get_current_user)):
    """Check if the scheduling window is currently open for drivers.
    Window: Sunday 22:00 - Monday 10:00"""
    now = datetime.now(timezone.utc)
    day_of_week = now.weekday()  # 0=Monday, 6=Sunday
    hour = now.hour

    is_open = False
    if day_of_week == 6 and hour >= 22:  # Sunday after 22:00
        is_open = True
    elif day_of_week == 0 and hour < 10:  # Monday before 10:00
        is_open = True

    return {
        "is_open": is_open,
        "opens_at": "Duminică 22:00",
        "closes_at": "Luni 10:00",
        "current_day": day_of_week,
        "current_hour": hour
    }
