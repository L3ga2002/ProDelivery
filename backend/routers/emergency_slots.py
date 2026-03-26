from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import get_current_user
from models.emergency_slot import EmergencySlotCreate, EmergencySlot

router = APIRouter(prefix="/schedules/emergency", tags=["emergency-slots"])


@router.post("")
async def create_emergency_slot(data: EmergencySlotCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    if data.total_spots < 1:
        raise HTTPException(status_code=400, detail="Minimum 1 loc")

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
