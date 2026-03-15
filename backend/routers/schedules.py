from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from database import db
from auth import get_current_user
from models.schedule import ScheduleCreate, ScheduleUpdate, Schedule

router = APIRouter(prefix="/schedules", tags=["schedules"])


def calc_total_hours(slots: dict) -> float:
    total = 0.0
    for day, time_slots in slots.items():
        for slot in time_slots:
            start_h, start_m = map(int, slot["start"].split(":"))
            end_h, end_m = map(int, slot["end"].split(":"))
            hours = (end_h + end_m / 60) - (start_h + start_m / 60)
            if hours > 0:
                total += hours
    return round(total, 2)


@router.get("/driver/{driver_id}")
async def get_driver_schedules(driver_id: str, year: int = 2026, current_user: dict = Depends(get_current_user)):
    schedules = await db.schedules.find(
        {"driver_id": driver_id, "week_start": {"$regex": f"^{year}"}},
        {"_id": 0}
    ).to_list(60)
    return schedules


@router.post("")
async def create_or_update_schedule(data: ScheduleCreate, current_user: dict = Depends(get_current_user)):
    # Only driver themselves or admin can set schedule
    if current_user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
        if not driver or driver["id"] != data.driver_id:
            raise HTTPException(status_code=403, detail="Cannot edit another driver's schedule")
    elif current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    slots_dict = {day: [s.model_dump() for s in slots] for day, slots in data.slots.items()}
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
        pipeline = [
            {"$match": {"driver_id": driver["id"], "status": "DELIVERED"}},
            {"$group": {"_id": "$restaurant_name", "count": {"$sum": 1}}}
        ]
        by_restaurant = await db.orders.aggregate(pipeline).to_list(100)

        result.append({
            "driver_id": driver["id"],
            "driver_name": driver["name"],
            "phone": driver["phone"],
            "is_active": driver["is_active"],
            "total_hours_scheduled": total_hours,
            "total_orders_delivered": orders_delivered,
            "orders_by_restaurant": {r["_id"]: r["count"] for r in by_restaurant},
            "schedules": schedules
        })

    return result
