from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from database import db
from auth import get_current_user
from models.emergency_slot import EmergencySlotCreate, EmergencySlot

router = APIRouter(prefix="/schedules/emergency", tags=["emergency-slots"])

DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
PEAK_HOURS = ["12:00", "13:00", "19:00", "20:00", "21:00"]


def _extract_hour_from_created_at(created_at):
    if not created_at:
        return None
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except ValueError:
            return None
    return f"{created_at.hour:02d}:00"


def _required_emergency_spots(hourly_orders: int, scheduled_coverage: int):
    if hourly_orders >= 30:
        target = 4
    elif hourly_orders >= 22:
        target = 3
    elif hourly_orders >= 15:
        target = 2
    elif hourly_orders >= 10:
        target = 1
    else:
        target = 0
    return max(target - scheduled_coverage, 0)


@router.post("")
async def create_emergency_slot(data: EmergencySlotCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if data.total_spots < 1:
        raise HTTPException(status_code=400, detail="Minimum 1 loc")

    # Emergency slots only allowed between 10:00-22:00
    allowed_hours = [f"{h:02d}:00" for h in range(10, 22)]
    if data.hour not in allowed_hours:
        raise HTTPException(status_code=400, detail="Sloturile de urgență sunt doar între 10:00-22:00")

    # Check if slot already exists for this day/hour/week
    existing = await db.emergency_slots.find_one({
        "week_start": data.week_start,
        "day": data.day,
        "hour": data.hour
    })

    if existing:
        # Update existing
        await db.emergency_slots.update_one(
            {"week_start": data.week_start, "day": data.day, "hour": data.hour},
            {"$set": {
                "total_spots": data.total_spots,
                "remaining_spots": data.total_spots - len(existing.get("claimed_by", []))
            }}
        )
        return {"message": "Slot urgență actualizat", "total_spots": data.total_spots}

    slot = EmergencySlot(
        week_start=data.week_start,
        day=data.day,
        hour=data.hour,
        total_spots=data.total_spots,
        remaining_spots=data.total_spots,
    )
    doc = slot.model_dump()
    await db.emergency_slots.insert_one(doc)
    return {"message": "Slot urgență creat", "id": slot.id, "total_spots": data.total_spots}


@router.get("")
async def get_emergency_slots(week_start: str, current_user: dict = Depends(get_current_user)):
    slots = await db.emergency_slots.find(
        {"week_start": week_start},
        {"_id": 0}
    ).to_list(200)
    return slots


@router.post("/auto-generate")
async def auto_generate_emergency_slots(week_start: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    schedules = await db.schedules.find({"week_start": week_start}, {"_id": 0}).to_list(500)
    orders = await db.orders.find({}, {"_id": 0, "created_at": 1}).to_list(1000)

    hourly_demand = {hour: 0 for hour in PEAK_HOURS}
    for order in orders:
        hour = _extract_hour_from_created_at(order.get("created_at"))
        if hour in hourly_demand:
            hourly_demand[hour] += 1

    fallback_demand = {"12:00": 18, "13:00": 15, "19:00": 20, "20:00": 28, "21:00": 19}
    for hour in PEAK_HOURS:
        if hourly_demand[hour] == 0:
            hourly_demand[hour] = fallback_demand[hour]

    coverage = {(day, hour): 0 for day in DAYS for hour in PEAK_HOURS}
    for schedule in schedules:
        for day, slots in (schedule.get("slots") or {}).items():
            for slot in slots:
                hour = slot.get("start")
                if (day, hour) in coverage:
                    coverage[(day, hour)] += 1

    created = 0
    updated = 0
    touched_slots = []
    existing_slots = await db.emergency_slots.find({"week_start": week_start}, {"_id": 0}).to_list(500)
    existing_map = {(slot["day"], slot["hour"]): slot for slot in existing_slots}

    for day in DAYS:
        for hour in PEAK_HOURS:
            required_spots = _required_emergency_spots(hourly_demand[hour], coverage[(day, hour)])
            if required_spots <= 0:
                continue

            existing = existing_map.get((day, hour))
            if existing:
                if existing.get("created_by") == "admin":
                    continue
                claimed_count = len(existing.get("claimed_by", []))
                total_spots = max(required_spots, claimed_count)
                remaining_spots = max(total_spots - claimed_count, 0)
                await db.emergency_slots.update_one(
                    {"id": existing["id"]},
                    {"$set": {"total_spots": total_spots, "remaining_spots": remaining_spots, "created_by": "system"}},
                )
                touched_slots.append({"day": day, "hour": hour, "spots": total_spots, "mode": "updated"})
                updated += 1
                continue

            slot = EmergencySlot(
                week_start=week_start,
                day=day,
                hour=hour,
                total_spots=required_spots,
                remaining_spots=required_spots,
                created_by="system",
            )
            await db.emergency_slots.insert_one(slot.model_dump())
            touched_slots.append({"day": day, "hour": hour, "spots": required_spots, "mode": "created"})
            created += 1

    return {
        "message": f"Auto-generator complet: {created} create, {updated} actualizate",
        "created": created,
        "updated": updated,
        "hourly_demand": hourly_demand,
        "slots": touched_slots,
    }


@router.post("/{slot_id}/claim")
async def claim_emergency_slot(slot_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Doar livratorul poate lua sloturi")

    slot = await db.emergency_slots.find_one({"id": slot_id}, {"_id": 0})
    if not slot:
        raise HTTPException(status_code=404, detail="Slot negăsit")

    if slot["remaining_spots"] <= 0:
        raise HTTPException(status_code=400, detail="Nu mai sunt locuri disponibile")

    # Get driver info
    driver = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver negăsit")

    # Check if driver already claimed this slot
    if driver["id"] in slot.get("claimed_by", []):
        raise HTTPException(status_code=400, detail="Ai luat deja acest slot")

    # Check if driver already has a schedule for this hour
    schedule = await db.schedules.find_one({
        "driver_id": driver["id"],
        "week_start": slot["week_start"]
    }, {"_id": 0})

    if schedule:
        day_slots = schedule.get("slots", {}).get(slot["day"], [])
        has_schedule = any(s["start"] == slot["hour"] for s in day_slots)
        if has_schedule:
            raise HTTPException(status_code=400, detail="Ai deja program la această oră")

    # Claim the slot
    await db.emergency_slots.update_one(
        {"id": slot_id},
        {
            "$push": {
                "claimed_by": driver["id"],
                "claimed_names": driver["name"]
            },
            "$inc": {"remaining_spots": -1}
        }
    )

    # Also add this hour to driver's schedule as emergency type
    end_h = (int(slot["hour"].split(":")[0]) + 1) % 24
    emergency_slot_data = {
        "start": slot["hour"],
        "end": f"{end_h:02d}:00",
        "added_by": "emergency"
    }

    if schedule:
        day_key = f"slots.{slot['day']}"
        await db.schedules.update_one(
            {"driver_id": driver["id"], "week_start": slot["week_start"]},
            {
                "$push": {day_key: emergency_slot_data},
                "$inc": {"total_hours": 1}
            }
        )
    else:
        from models.schedule import Schedule
        new_schedule = Schedule(
            driver_id=driver["id"],
            week_start=slot["week_start"],
            slots={slot["day"]: [emergency_slot_data]},
            total_hours=1.0
        )
        await db.schedules.insert_one(new_schedule.model_dump())

    return {
        "message": f"Slot de urgență luat! Rămân {slot['remaining_spots'] - 1} locuri",
        "remaining_spots": slot["remaining_spots"] - 1
    }


@router.delete("/{slot_id}")
async def delete_emergency_slot(slot_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    result = await db.emergency_slots.delete_one({"id": slot_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slot negăsit")
    return {"message": "Slot urgență șters"}
