from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
from database import db
from auth import hash_password, get_current_user
from models.driver import DriverCreate
from utils.driver_ranking import build_driver_ranking_payload

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("")
async def get_drivers(current_user: dict = Depends(get_current_user)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    enriched_drivers = []
    for driver in drivers:
        ranking = await build_driver_ranking_payload(db, driver)
        enriched_drivers.append({**driver, **ranking})
    return enriched_drivers


@router.get("/rankings")
async def get_driver_rankings(current_user: dict = Depends(get_current_user)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    rankings = []
    for driver in drivers:
        ranking = await build_driver_ranking_payload(db, driver)
        rankings.append({
            "driver_id": driver["id"],
            "driver_name": driver["name"],
            **ranking,
        })
    return sorted(rankings, key=lambda item: item["ranking_score"], reverse=True)


@router.get("/ranking/me")
async def get_my_ranking(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "driver":
        raise HTTPException(status_code=403, detail="Driver only")

    driver = await db.drivers.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    ranking = await build_driver_ranking_payload(db, driver)
    return {"driver_id": driver["id"], "driver_name": driver["name"], **ranking}


@router.get("/{driver_id}")
async def get_driver(driver_id: str, current_user: dict = Depends(get_current_user)):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.post("")
async def create_driver(data: DriverCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    user_id = str(uuid.uuid4())
    driver_id = str(uuid.uuid4())

    user_doc = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "role": "driver",
        "phone": data.phone,
        "password_hash": hash_password("driver123"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    driver_doc = {
        "id": driver_id,
        "user_id": user_id,
        "name": data.name,
        "phone": data.phone,
        "is_active": False,
        "latitude": 46.567 + (hash(data.name) % 100) / 10000,
        "longitude": 26.913 + (hash(data.phone) % 100) / 10000,
        "current_order_id": None,
        "total_deliveries": 0,
        "total_earnings": 0,
        "punctuality_rate": 0.85,
        "joined_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.drivers.insert_one(driver_doc)

    return {"message": "Driver created", "driver_id": driver_id, "password": "driver123"}


@router.put("/{driver_id}/location")
async def update_driver_location(driver_id: str, latitude: float, longitude: float, current_user: dict = Depends(get_current_user)):
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"latitude": latitude, "longitude": longitude}}
    )
    return {"message": "Location updated"}


@router.put("/{driver_id}/status")
async def update_driver_status(driver_id: str, is_active: bool, current_user: dict = Depends(get_current_user)):
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"is_active": is_active}}
    )
    return {"message": "Status updated"}
