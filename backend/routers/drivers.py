from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timedelta, timezone
import uuid
import secrets
from database import db
from auth import hash_password, verify_password, get_current_user
from models.driver import DriverCreate, DriverEmailVerification
from utils.driver_ranking import build_driver_ranking_payload
from utils.email_service import EmailDeliveryError, send_driver_verification_email
from utils.driver_ranking import ROMANIA_TZ

router = APIRouter(prefix="/drivers", tags=["drivers"])
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def _normalise_email(email: str) -> str:
    return email.strip().lower()


def _generate_verification_code() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


def _current_week_and_day() -> tuple[str, str, str]:
    now = datetime.now(ROMANIA_TZ)
    monday = now - timedelta(days=now.weekday())
    return monday.date().isoformat(), DAYS[now.weekday()], f"{now.hour:02d}:00"


async def _attach_today_schedule_state(driver: dict) -> dict:
    week_start, day_key, current_hour = _current_week_and_day()
    schedule = await db.schedules.find_one(
        {"driver_id": driver["id"], "week_start": week_start},
        {"_id": 0},
    )
    today_slots = (schedule or {}).get("slots", {}).get(day_key, [])
    is_scheduled_today = len(today_slots) > 0
    is_on_shift_now = any(slot.get("start") == current_hour for slot in today_slots)
    return {
        **driver,
        "vehicle_type": driver.get("vehicle_type", "scooter"),
        "email_verified": driver.get("email_verified", True),
        "schedule_today_hours": len(today_slots),
        "is_scheduled_today": is_scheduled_today,
        "is_on_shift_now": is_on_shift_now,
    }


async def _create_and_send_verification(driver_id: str, user_id: str, email: str, name: str) -> dict:
    code = _generate_verification_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    payload = {
        "email_verification_code_hash": hash_password(code),
        "email_verification_expires_at": expires_at.isoformat(),
        "email_verified": False,
        "email_verification_sent_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({"id": user_id}, {"$set": payload})
    await db.drivers.update_one({"id": driver_id}, {"$set": payload})
    try:
        email_response = await send_driver_verification_email(email, name, code)
        delivery = {"status": "sent", "email_id": email_response.get("id") if isinstance(email_response, dict) else None}
    except EmailDeliveryError as exc:
        if exc.reason != "test_domain_restricted":
            raise
        delivery = {
            "status": "test_domain_restricted",
            "message": str(exc),
            "verification_code": code,
            "expires_at": expires_at.isoformat(),
        }
    await db.users.update_one({"id": user_id}, {"$set": {"email_verification_delivery_status": delivery["status"]}})
    await db.drivers.update_one({"id": driver_id}, {"$set": {"email_verification_delivery_status": delivery["status"]}})
    return delivery


@router.get("")
async def get_drivers(current_user: dict = Depends(get_current_user)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    enriched_drivers = []
    for driver in drivers:
        ranking = await build_driver_ranking_payload(db, driver)
        schedule_state = await _attach_today_schedule_state(driver)
        enriched_drivers.append({**schedule_state, **ranking})
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

    normalized_email = _normalise_email(str(data.email))
    existing = await db.users.find_one({"email": normalized_email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email deja înregistrat")

    user_id = str(uuid.uuid4())
    driver_id = str(uuid.uuid4())

    user_doc = {
        "id": user_id,
        "email": normalized_email,
        "name": data.name,
        "role": "driver",
        "phone": data.phone,
        "vehicle_type": data.vehicle_type,
        "email_verified": False,
        "password_hash": hash_password("driver123"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    driver_doc = {
        "id": driver_id,
        "user_id": user_id,
        "name": data.name,
        "email": normalized_email,
        "phone": data.phone,
        "vehicle_type": data.vehicle_type,
        "email_verified": False,
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

    email_delivery = {"status": "not_sent"}
    try:
        email_delivery = await _create_and_send_verification(driver_id, user_id, normalized_email, data.name)
    except EmailDeliveryError as exc:
        email_delivery = {"status": "failed", "message": str(exc)}

    return {
        "message": "Driver created",
        "driver_id": driver_id,
        "password": "driver123",
        "email_delivery": email_delivery,
    }


@router.post("/{driver_id}/verify-email")
async def verify_driver_email(driver_id: str, data: DriverEmailVerification, current_user: dict = Depends(get_current_user)):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if current_user["role"] == "driver" and current_user.get("driver_id") != driver_id:
        raise HTTPException(status_code=403, detail="Nu poți verifica alt livrator")
    if current_user["role"] not in ["admin", "driver"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    expires_raw = driver.get("email_verification_expires_at")
    code_hash = driver.get("email_verification_code_hash")
    if not code_hash or not expires_raw:
        raise HTTPException(status_code=400, detail="Nu există cod activ")
    expires_at = datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Cod expirat. Cere retrimiterea codului.")
    if not verify_password(data.code.strip(), code_hash):
        raise HTTPException(status_code=400, detail="Cod invalid")

    verified_at = datetime.now(timezone.utc).isoformat()
    update = {
        "email_verified": True,
        "email_verified_at": verified_at,
        "email_verification_code_hash": None,
        "email_verification_expires_at": None,
    }
    await db.drivers.update_one({"id": driver_id}, {"$set": update})
    await db.users.update_one({"id": driver["user_id"]}, {"$set": update})
    return {"message": "Email verificat", "email_verified": True}


@router.post("/{driver_id}/resend-verification")
async def resend_driver_verification(driver_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    if driver.get("email_verified"):
        return {"message": "Emailul este deja verificat", "email_verified": True}
    try:
        email_delivery = await _create_and_send_verification(driver_id, driver["user_id"], driver["email"], driver["name"])
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"message": "Cod retrimis", "email_delivery": email_delivery}


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
