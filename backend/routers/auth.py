from fastapi import APIRouter, HTTPException, Depends
from database import db
from auth import hash_password, verify_password, create_token, get_current_user
from models.user import User, UserCreate, UserLogin
from models.driver import Driver

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        phone=user_data.phone,
        restaurant_id=user_data.restaurant_id
    )

    doc = user.model_dump()
    doc["password_hash"] = hash_password(user_data.password)
    doc["created_at"] = doc["created_at"].isoformat()

    await db.users.insert_one(doc)

    if user_data.role == "driver":
        driver = Driver(
            user_id=user.id,
            name=user.name,
            phone=user_data.phone or ""
        )
        await db.drivers.insert_one(driver.model_dump())

    return {"message": "User registered", "user_id": user.id}


@router.post("/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user)

    driver_id = None
    if user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if driver:
            driver_id = driver["id"]

    restaurant_name = None
    if user["role"] == "restaurant" and user.get("restaurant_id"):
        restaurant = await db.restaurants.find_one({"id": user["restaurant_id"]}, {"_id": 0})
        if restaurant:
            restaurant_name = restaurant["name"]

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "driver_id": driver_id,
            "restaurant_id": user.get("restaurant_id"),
            "restaurant_name": restaurant_name
        }
    }


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
