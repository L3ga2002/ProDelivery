from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
import uuid
from shapely.geometry import Point, Polygon
from database import db
from auth import hash_password, get_current_user
from models.restaurant import RestaurantCreate, RestaurantAvailabilityRequest

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("")
async def get_restaurants(current_user: dict = Depends(get_current_user)):
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(100)
    return restaurants


def build_shapely_polygon(coords):
    if len(coords) < 3:
        return None
    ring = [(c["lng"], c["lat"]) for c in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return Polygon(ring)


async def restaurant_covers_point(restaurant_id: str, point: Point) -> bool:
    zones = await db.delivery_zones.find(
        {"restaurant_id": restaurant_id, "is_active": True},
        {"_id": 0, "polygon": 1},
    ).to_list(300)
    for zone in zones:
        poly = build_shapely_polygon(zone.get("polygon", []))
        if poly and poly.contains(point):
            return True
    return False


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
        "contact_name": data.contact_name,
        "email": data.email,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "location_source": data.location_source,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.restaurants.insert_one(restaurant_doc)
    restaurant_doc.pop("_id", None)

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
        "restaurant": restaurant_doc,
        "login_email": email,
        "password": "restaurant123"
    }


@router.post("/available")
async def get_available_restaurants(
    data: RestaurantAvailabilityRequest,
    current_user: dict = Depends(get_current_user),
):
    point = Point(data.lng, data.lat)
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(1000)
    available = []
    for restaurant in restaurants:
        if await restaurant_covers_point(restaurant["id"], point):
            available.append(restaurant)
    return {"restaurants": available, "count": len(available)}
