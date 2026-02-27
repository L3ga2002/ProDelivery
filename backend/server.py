from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'delivery-platform-secret-key-2024')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Delivery Platform API")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ============ MODELS ============

class UserBase(BaseModel):
    email: str
    name: str
    role: str  # admin, driver, restaurant
    phone: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Driver(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    is_active: bool = False
    latitude: float = 44.4268
    longitude: float = 26.1025
    current_order_id: Optional[str] = None

class Restaurant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    latitude: float = 44.4268
    longitude: float = 26.1025

class OrderItem(BaseModel):
    name: str
    quantity: int
    price: float

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    restaurant_id: str
    restaurant_name: str
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_address: str
    items: List[OrderItem] = []
    total_amount: float
    payment_type: str  # CASH or CARD
    notes: Optional[str] = None
    status: str = "NEW"  # NEW, ASSIGNED, ACCEPTED, PICKED_UP, DELIVERED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderCreate(BaseModel):
    restaurant_id: str
    customer_name: str
    customer_phone: str
    customer_address: str
    items: List[OrderItem] = []
    total_amount: float
    payment_type: str = "CASH"
    notes: Optional[str] = None

class AssignOrder(BaseModel):
    driver_id: str

class UpdateOrderStatus(BaseModel):
    status: str

# ============ AUTH HELPERS ============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_data: dict) -> str:
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "role": user_data["role"],
        "name": user_data["name"],
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        phone=user_data.phone
    )
    
    doc = user.model_dump()
    doc["password_hash"] = hash_password(user_data.password)
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.users.insert_one(doc)
    
    # If driver, create driver profile
    if user_data.role == "driver":
        driver = Driver(
            user_id=user.id,
            name=user.name,
            phone=user_data.phone or ""
        )
        driver_doc = driver.model_dump()
        await db.drivers.insert_one(driver_doc)
    
    return {"message": "User registered", "user_id": user.id}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user)
    
    # If driver, get driver_id
    driver_id = None
    if user["role"] == "driver":
        driver = await db.drivers.find_one({"user_id": user["id"]}, {"_id": 0})
        if driver:
            driver_id = driver["id"]
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "driver_id": driver_id
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ============ DRIVERS ENDPOINTS ============

@api_router.get("/drivers", response_model=List[Driver])
async def get_drivers(current_user: dict = Depends(get_current_user)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    return drivers

@api_router.get("/drivers/{driver_id}")
async def get_driver(driver_id: str, current_user: dict = Depends(get_current_user)):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

@api_router.put("/drivers/{driver_id}/location")
async def update_driver_location(driver_id: str, latitude: float, longitude: float, current_user: dict = Depends(get_current_user)):
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"latitude": latitude, "longitude": longitude}}
    )
    return {"message": "Location updated"}

@api_router.put("/drivers/{driver_id}/status")
async def update_driver_status(driver_id: str, is_active: bool, current_user: dict = Depends(get_current_user)):
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {"is_active": is_active}}
    )
    return {"message": "Status updated"}

# ============ RESTAURANTS ENDPOINTS ============

@api_router.get("/restaurants", response_model=List[Restaurant])
async def get_restaurants(current_user: dict = Depends(get_current_user)):
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(100)
    return restaurants

@api_router.post("/restaurants")
async def create_restaurant(restaurant: Restaurant, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    doc = restaurant.model_dump()
    await db.restaurants.insert_one(doc)
    return restaurant

# ============ ORDERS ENDPOINTS ============

@api_router.get("/orders")
async def get_orders(current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    # Convert datetime strings back
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order.get('updated_at'), str):
            order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    return orders

@api_router.get("/orders/driver/{driver_id}")
async def get_driver_orders(driver_id: str, current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find(
        {"driver_id": driver_id, "status": {"$nin": ["DELIVERED"]}},
        {"_id": 0}
    ).to_list(100)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.post("/orders")
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    # Get restaurant info
    restaurant = await db.restaurants.find_one({"id": order_data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    # Generate order number
    count = await db.orders.count_documents({})
    order_number = f"CMD-{count + 1:04d}"
    
    order = Order(
        order_number=order_number,
        restaurant_id=order_data.restaurant_id,
        restaurant_name=restaurant["name"],
        customer_name=order_data.customer_name,
        customer_phone=order_data.customer_phone,
        customer_address=order_data.customer_address,
        items=order_data.items,
        total_amount=order_data.total_amount,
        payment_type=order_data.payment_type,
        notes=order_data.notes
    )
    
    doc = order.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    
    await db.orders.insert_one(doc)
    return order

@api_router.put("/orders/{order_id}/assign")
async def assign_order(order_id: str, data: AssignOrder, current_user: dict = Depends(get_current_user)):
    # Get driver info
    driver = await db.drivers.find_one({"id": data.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "driver_id": data.driver_id,
            "driver_name": driver["name"],
            "status": "ASSIGNED",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update driver's current order
    await db.drivers.update_one(
        {"id": data.driver_id},
        {"$set": {"current_order_id": order_id}}
    )
    
    return {"message": "Order assigned"}

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, data: UpdateOrderStatus, current_user: dict = Depends(get_current_user)):
    valid_statuses = ["NEW", "ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    update_data = {
        "status": data.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # If delivered, clear driver's current order
    if data.status == "DELIVERED":
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order and order.get("driver_id"):
            await db.drivers.update_one(
                {"id": order["driver_id"]},
                {"$set": {"current_order_id": None}}
            )
    
    return {"message": "Status updated"}

# ============ SEED DATA ============

@api_router.post("/seed")
async def seed_data():
    """Seed demo data for testing"""
    
    # Clear existing data
    await db.users.delete_many({})
    await db.drivers.delete_many({})
    await db.restaurants.delete_many({})
    await db.orders.delete_many({})
    
    # Create admin user
    admin = User(
        id="admin-001",
        email="admin@delivery.ro",
        name="Administrator",
        role="admin"
    )
    admin_doc = admin.model_dump()
    admin_doc["password_hash"] = hash_password("admin123")
    admin_doc["created_at"] = admin_doc["created_at"].isoformat()
    await db.users.insert_one(admin_doc)
    
    # Create driver users and profiles
    drivers_data = [
        {"id": "driver-001", "name": "Ion Popescu", "phone": "0722111222", "lat": 44.4368, "lng": 26.0925, "active": True},
        {"id": "driver-002", "name": "Maria Ionescu", "phone": "0722333444", "lat": 44.4168, "lng": 26.1125, "active": True},
        {"id": "driver-003", "name": "Andrei Popa", "phone": "0722555666", "lat": 44.4468, "lng": 26.0825, "active": False},
        {"id": "driver-004", "name": "Elena Dumitrescu", "phone": "0722777888", "lat": 44.4068, "lng": 26.1225, "active": True},
    ]
    
    for d in drivers_data:
        user = User(
            id=f"user-{d['id']}",
            email=f"{d['id']}@delivery.ro",
            name=d["name"],
            role="driver",
            phone=d["phone"]
        )
        user_doc = user.model_dump()
        user_doc["password_hash"] = hash_password("driver123")
        user_doc["created_at"] = user_doc["created_at"].isoformat()
        await db.users.insert_one(user_doc)
        
        driver = Driver(
            id=d["id"],
            user_id=user.id,
            name=d["name"],
            phone=d["phone"],
            is_active=d["active"],
            latitude=d["lat"],
            longitude=d["lng"]
        )
        await db.drivers.insert_one(driver.model_dump())
    
    # Create restaurants
    restaurants_data = [
        {"id": "rest-001", "name": "Pizza Roma", "address": "Str. Victoriei 45, București", "phone": "021111222", "lat": 44.4308, "lng": 26.1005},
        {"id": "rest-002", "name": "Burger House", "address": "Bd. Unirii 78, București", "phone": "021333444", "lat": 44.4228, "lng": 26.0985},
        {"id": "rest-003", "name": "Sushi Master", "address": "Calea Dorobanți 120, București", "phone": "021555666", "lat": 44.4508, "lng": 26.0895},
    ]
    
    for r in restaurants_data:
        restaurant = Restaurant(**r)
        await db.restaurants.insert_one(restaurant.model_dump())
    
    # Create demo orders
    orders_data = [
        {
            "order_number": "CMD-0001",
            "restaurant_id": "rest-001",
            "restaurant_name": "Pizza Roma",
            "customer_name": "Alexandru Marinescu",
            "customer_phone": "0744123456",
            "customer_address": "Str. Lipscani 23, Ap. 5, București",
            "items": [{"name": "Pizza Margherita", "quantity": 2, "price": 35.0}, {"name": "Cola 500ml", "quantity": 2, "price": 8.0}],
            "total_amount": 86.0,
            "payment_type": "CASH",
            "notes": "Etaj 3, sună la interfon 5",
            "status": "NEW"
        },
        {
            "order_number": "CMD-0002",
            "restaurant_id": "rest-002",
            "restaurant_name": "Burger House",
            "customer_name": "Cristina Voicu",
            "customer_phone": "0755234567",
            "customer_address": "Bd. Magheru 50, București",
            "items": [{"name": "Burger Classic", "quantity": 1, "price": 28.0}, {"name": "Cartofi Prăjiți", "quantity": 1, "price": 12.0}],
            "total_amount": 40.0,
            "payment_type": "CARD",
            "notes": "",
            "status": "NEW"
        },
        {
            "order_number": "CMD-0003",
            "restaurant_id": "rest-003",
            "restaurant_name": "Sushi Master",
            "customer_name": "Mihai Rădulescu",
            "customer_phone": "0766345678",
            "customer_address": "Str. Primăverii 15, București",
            "items": [{"name": "Sushi Set 24 piese", "quantity": 1, "price": 95.0}],
            "total_amount": 95.0,
            "payment_type": "CASH",
            "notes": "Să sune când ajunge jos",
            "status": "NEW"
        },
    ]
    
    for o in orders_data:
        order = Order(**o)
        doc = order.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await db.orders.insert_one(doc)
    
    return {"message": "Demo data seeded successfully"}

# ============ ROOT ============

@api_router.get("/")
async def root():
    return {"message": "Delivery Platform API v1.0", "status": "running"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
