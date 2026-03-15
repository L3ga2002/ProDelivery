from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
from database import db
from auth import hash_password, get_current_user
from models.restaurant import RestaurantCreate

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("")
async def get_restaurants(current_user: dict = Depends(get_current_user)):
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(100)
    return restaurants


@router.post("")
async def create_restaurant(data: RestaurantCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")

    restaurant_id = str(uuid.uuid4())

    restaurant_doc = {
        "id": restaurant_id,
        "name": data.name,
        "address": data.address,
        "phone": data.phone,
        "latitude": data.latitude,
        "longitude": data.longitude
    }
    await db.restaurants.insert_one(restaurant_doc)

    user_id = str(uuid.uuid4())
    email = f"restaurant-{restaurant_id[:8]}@delivery.ro"

    user_doc = {
        "id": user_id,
        "email": email,
        "name": data.name,
        "role": "restaurant",
        "phone": data.phone,
        "restaurant_id": restaurant_id,
        "restaurant_name": data.name,
        "password_hash": hash_password("restaurant123"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)

    return {
        "message": "Restaurant created",
        "restaurant_id": restaurant_id,
        "login_email": email,
        "password": "restaurant123"
    }
