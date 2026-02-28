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
    restaurant_id: Optional[str] = None
    restaurant_name: Optional[str] = None

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str
    phone: Optional[str] = None
    restaurant_id: Optional[str] = None

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
    total_deliveries: int = 0
    total_earnings: float = 0

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
    source: str = "S"  # S=Site, G=Glovo, W=Wolt, B=Bolt
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
    status: str = "NEW"  # NEW, PREPARING, READY, ASSIGNED, ACCEPTED, PICKED_UP, DELIVERED
    preparation_time: Optional[int] = None
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
    source: str = "S"

class AssignOrder(BaseModel):
    driver_id: str

class UpdateOrderStatus(BaseModel):
    status: str

class PreparationTime(BaseModel):
    preparation_time: int

class DriverCreate(BaseModel):
    name: str
    phone: str
    email: str

class RestaurantCreate(BaseModel):
    name: str
    address: str
    phone: str
    latitude: float = 44.4268
    longitude: float = 26.1025

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
        "restaurant_id": user_data.get("restaurant_id"),
        "restaurant_name": user_data.get("restaurant_name"),
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
        phone=user_data.phone,
        restaurant_id=user_data.restaurant_id
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
    
    # If restaurant, get restaurant name
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

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ============ DRIVERS ENDPOINTS ============

@api_router.get("/drivers")
async def get_drivers(current_user: dict = Depends(get_current_user)):
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(100)
    return drivers

@api_router.get("/drivers/{driver_id}")
async def get_driver(driver_id: str, current_user: dict = Depends(get_current_user)):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

@api_router.post("/drivers")
async def create_driver(data: DriverCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Create user
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
        "latitude": 44.4268 + (hash(data.name) % 100) / 1000,
        "longitude": 26.1025 + (hash(data.phone) % 100) / 1000,
        "current_order_id": None,
        "total_deliveries": 0,
        "total_earnings": 0
    }
    await db.drivers.insert_one(driver_doc)
    
    return {"message": "Driver created", "driver_id": driver_id, "password": "driver123"}

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

@api_router.get("/restaurants")
async def get_restaurants(current_user: dict = Depends(get_current_user)):
    restaurants = await db.restaurants.find({}, {"_id": 0}).to_list(100)
    return restaurants

@api_router.post("/restaurants")
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
    
    # Create restaurant user
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

# ============ ORDERS ENDPOINTS ============

@api_router.get("/orders")
async def get_orders(current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
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

@api_router.get("/orders/restaurant/{restaurant_id}")
async def get_restaurant_orders(restaurant_id: str, current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
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
    
    # Generate order number with source prefix
    count = await db.orders.count_documents({})
    order_number = f"{order_data.source}.{count + 1:04d}"
    
    order = Order(
        order_number=order_number,
        source=order_data.source,
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
    driver = await db.drivers.find_one({"id": data.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Check current order status
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    new_status = "ASSIGNED"
    if order and order.get("status") == "READY":
        new_status = "ASSIGNED"
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "driver_id": data.driver_id,
            "driver_name": driver["name"],
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.drivers.update_one(
        {"id": data.driver_id},
        {"$set": {"current_order_id": order_id}}
    )
    
    return {"message": "Order assigned"}

@api_router.put("/orders/{order_id}/preparing")
async def set_preparing(order_id: str, data: PreparationTime, current_user: dict = Depends(get_current_user)):
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "PREPARING",
            "preparation_time": data.preparation_time,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Order preparing"}

@api_router.put("/orders/{order_id}/ready")
async def set_ready(order_id: str, current_user: dict = Depends(get_current_user)):
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "READY",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Order ready"}

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, data: UpdateOrderStatus, current_user: dict = Depends(get_current_user)):
    valid_statuses = ["NEW", "PREPARING", "READY", "ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    update_data = {
        "status": data.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # If delivered, update driver stats
    if data.status == "DELIVERED":
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order and order.get("driver_id"):
            await db.drivers.update_one(
                {"id": order["driver_id"]},
                {
                    "$set": {"current_order_id": None},
                    "$inc": {"total_deliveries": 1, "total_earnings": order.get("total_amount", 0) * 0.1}
                }
            )
    
    return {"message": "Status updated"}

# ============ STATS ============

@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    total_orders = await db.orders.count_documents({})
    active_orders = await db.orders.count_documents({"status": {"$nin": ["DELIVERED"]}})
    delivered_orders = await db.orders.count_documents({"status": "DELIVERED"})
    active_drivers = await db.drivers.count_documents({"is_active": True})
    total_drivers = await db.drivers.count_documents({})
    total_restaurants = await db.restaurants.count_documents({})
    
    # Revenue
    pipeline = [
        {"$match": {"status": "DELIVERED"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    return {
        "total_orders": total_orders,
        "active_orders": active_orders,
        "delivered_orders": delivered_orders,
        "active_drivers": active_drivers,
        "total_drivers": total_drivers,
        "total_restaurants": total_restaurants,
        "total_revenue": total_revenue
    }

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
        {"id": "driver-005", "name": "Bogdan Stanescu", "phone": "0722999000", "lat": 44.4200, "lng": 26.0950, "active": True},
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
    
    # Create restaurants with users
    restaurants_data = [
        {"id": "rest-001", "name": "Pizza Roma", "address": "Str. Victoriei 45, București", "phone": "021111222", "lat": 44.4308, "lng": 26.1005},
        {"id": "rest-002", "name": "Burger House", "address": "Bd. Unirii 78, București", "phone": "021333444", "lat": 44.4228, "lng": 26.0985},
        {"id": "rest-003", "name": "Sushi Master", "address": "Calea Dorobanți 120, București", "phone": "021555666", "lat": 44.4508, "lng": 26.0895},
        {"id": "rest-004", "name": "La Mama", "address": "Str. Academiei 33, București", "phone": "021777888", "lat": 44.4350, "lng": 26.1050},
        {"id": "rest-005", "name": "KFC Express", "address": "Bd. Magheru 25, București", "phone": "021999111", "lat": 44.4400, "lng": 26.0970},
    ]
    
    for r in restaurants_data:
        restaurant = Restaurant(**r)
        await db.restaurants.insert_one(restaurant.model_dump())
        
        # Create restaurant user
        rest_user = User(
            id=f"user-{r['id']}",
            email=f"{r['id']}@delivery.ro",
            name=r["name"],
            role="restaurant",
            phone=r["phone"],
            restaurant_id=r["id"],
            restaurant_name=r["name"]
        )
        rest_user_doc = rest_user.model_dump()
        rest_user_doc["password_hash"] = hash_password("restaurant123")
        rest_user_doc["created_at"] = rest_user_doc["created_at"].isoformat()
        await db.users.insert_one(rest_user_doc)
    
    # Create demo orders - 100 orders
    import random
    
    first_names = ["Alexandru", "Maria", "Ion", "Elena", "Andrei", "Ana", "Mihai", "Cristina", "Bogdan", "Diana", 
                   "Vlad", "Ioana", "George", "Raluca", "Dan", "Adriana", "Florin", "Simona", "Radu", "Laura",
                   "Stefan", "Gabriela", "Marius", "Alina", "Cosmin", "Monica", "Adrian", "Daniela", "Ciprian", "Roxana"]
    
    last_names = ["Popescu", "Ionescu", "Popa", "Dumitrescu", "Stan", "Gheorghe", "Stoica", "Marin", "Constantin", "Dinu",
                  "Radu", "Marinescu", "Voicu", "Matei", "Florea", "Rusu", "Munteanu", "Mihai", "Nistor", "Tudor"]
    
    streets = ["Str. Victoriei", "Bd. Unirii", "Calea Dorobanți", "Str. Academiei", "Bd. Magheru", "Str. Lipscani",
               "Calea Victoriei", "Str. Primăverii", "Bd. Dacia", "Str. Polonă", "Bd. Carol I", "Str. Franceza",
               "Bd. Regina Elisabeta", "Str. Smârdan", "Calea Moșilor", "Str. Batiștei", "Bd. Aviatorilor"]
    
    food_items = {
        "rest-001": [  # Pizza Roma
            {"name": "Pizza Margherita", "price": 35.0},
            {"name": "Pizza Quattro Stagioni", "price": 45.0},
            {"name": "Pizza Diavola", "price": 42.0},
            {"name": "Pizza Carbonara", "price": 48.0},
            {"name": "Tiramisu", "price": 20.0},
            {"name": "Cola 500ml", "price": 8.0},
            {"name": "Fanta 500ml", "price": 8.0},
        ],
        "rest-002": [  # Burger House
            {"name": "Burger Classic", "price": 28.0},
            {"name": "Burger BBQ", "price": 32.0},
            {"name": "Cheeseburger", "price": 30.0},
            {"name": "Cartofi Prăjiți", "price": 12.0},
            {"name": "Onion Rings", "price": 15.0},
            {"name": "Milkshake", "price": 18.0},
        ],
        "rest-003": [  # Sushi Master
            {"name": "Sushi Set 24 piese", "price": 95.0},
            {"name": "Sushi Set 12 piese", "price": 55.0},
            {"name": "Sashimi Salmon", "price": 45.0},
            {"name": "Ramen", "price": 38.0},
            {"name": "Edamame", "price": 15.0},
            {"name": "Miso Soup", "price": 12.0},
        ],
        "rest-004": [  # La Mama
            {"name": "Ciorbă de burtă", "price": 25.0},
            {"name": "Sarmale", "price": 30.0},
            {"name": "Mici 10 buc", "price": 35.0},
            {"name": "Papanași", "price": 22.0},
            {"name": "Plăcintă cu brânză", "price": 18.0},
        ],
        "rest-005": [  # KFC Express
            {"name": "Bucket 8 Crispy", "price": 75.0},
            {"name": "Wings 6 buc", "price": 28.0},
            {"name": "Strips 5 buc", "price": 32.0},
            {"name": "Twister", "price": 25.0},
            {"name": "Cartofi mari", "price": 12.0},
            {"name": "Pepsi 1L", "price": 10.0},
        ],
    }
    
    notes_options = [
        "", "", "", "",  # 40% fără note
        "Etaj 3, sună la interfon",
        "Să sune când ajunge jos",
        "Fără ardei iute",
        "Livrare la poartă",
        "Bloc nou, intrarea din spate",
        "Apartament la parter",
        "Să aducă și șervețele extra",
        "Fără ceapă",
        "Plată exact, nu am rest",
    ]
    
    sources = ["S", "G", "W", "B"]  # Site, Glovo, Wolt, Bolt
    source_weights = [30, 35, 25, 10]  # Distribution
    
    restaurants_ids = ["rest-001", "rest-002", "rest-003", "rest-004", "rest-005"]
    restaurant_names = {
        "rest-001": "Pizza Roma",
        "rest-002": "Burger House",
        "rest-003": "Sushi Master",
        "rest-004": "La Mama",
        "rest-005": "KFC Express"
    }
    
    for i in range(1, 101):
        source = random.choices(sources, weights=source_weights)[0]
        restaurant_id = random.choice(restaurants_ids)
        
        # Generate customer
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        customer_name = f"{first_name} {last_name}"
        customer_phone = f"07{random.randint(20, 99)}{random.randint(100000, 999999)}"
        customer_address = f"{random.choice(streets)} {random.randint(1, 150)}, Ap. {random.randint(1, 50)}, București"
        
        # Generate items
        available_items = food_items[restaurant_id]
        num_items = random.randint(1, 4)
        selected_items = random.sample(available_items, min(num_items, len(available_items)))
        items = []
        total = 0
        for item in selected_items:
            qty = random.randint(1, 3)
            items.append({"name": item["name"], "quantity": qty, "price": item["price"]})
            total += item["price"] * qty
        
        payment_type = random.choice(["CASH", "CASH", "CARD"])  # 66% cash
        notes = random.choice(notes_options)
        
        order_data = {
            "order_number": f"{source}.{i:04d}",
            "source": source,
            "restaurant_id": restaurant_id,
            "restaurant_name": restaurant_names[restaurant_id],
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "customer_address": customer_address,
            "items": items,
            "total_amount": total,
            "payment_type": payment_type,
            "notes": notes,
            "status": "NEW"
        }
        
        order = Order(**order_data)
        doc = order.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        await db.orders.insert_one(doc)
    
    return {
        "message": "Demo data seeded successfully - 100 orders created",
        "credentials": {
            "admin": {"email": "admin@delivery.ro", "password": "admin123"},
            "drivers": {"email": "driver-001@delivery.ro", "password": "driver123"},
            "restaurants": {"email": "rest-001@delivery.ro", "password": "restaurant123"}
        },
        "data": {
            "orders": 100,
            "drivers": 5,
            "restaurants": 5
        }
    }

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
