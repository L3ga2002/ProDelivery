from fastapi import APIRouter
import random
from database import db
from auth import hash_password
from models.user import User
from models.driver import Driver
from models.restaurant import Restaurant
from models.order import Order

router = APIRouter(tags=["seed"])


@router.post("/seed")
async def seed_data():
    await db.users.delete_many({})
    await db.drivers.delete_many({})
    await db.restaurants.delete_many({})
    await db.orders.delete_many({})
    await db.emergency_slots.delete_many({})
    await db.schedules.delete_many({})
    await db.delivery_zones.delete_many({})

    # Admin
    admin = User(id="admin-001", email="admin@delivery.ro", name="Administrator", role="admin")
    admin_doc = admin.model_dump()
    admin_doc["password_hash"] = hash_password("admin123")
    admin_doc["created_at"] = admin_doc["created_at"].isoformat()
    await db.users.insert_one(admin_doc)

    # Drivers
    drivers_data = [
        {"id": "driver-001", "name": "Ion Popescu", "phone": "0722111222", "lat": 46.5690, "lng": 26.9100, "active": True},
        {"id": "driver-002", "name": "Maria Ionescu", "phone": "0722333444", "lat": 46.5640, "lng": 26.9180, "active": True},
        {"id": "driver-003", "name": "Andrei Popa", "phone": "0722555666", "lat": 46.5730, "lng": 26.9050, "active": False},
        {"id": "driver-004", "name": "Elena Dumitrescu", "phone": "0722777888", "lat": 46.5580, "lng": 26.9220, "active": True},
        {"id": "driver-005", "name": "Bogdan Stanescu", "phone": "0722999000", "lat": 46.5710, "lng": 26.9150, "active": True},
    ]

    for d in drivers_data:
        user = User(
            id=f"user-{d['id']}", email=f"{d['id']}@delivery.ro",
            name=d["name"], role="driver", phone=d["phone"]
        )
        user_doc = user.model_dump()
        user_doc["password_hash"] = hash_password("driver123")
        user_doc["created_at"] = user_doc["created_at"].isoformat()
        await db.users.insert_one(user_doc)

        driver = Driver(
            id=d["id"], user_id=user.id, name=d["name"],
            phone=d["phone"], is_active=d["active"],
            latitude=d["lat"], longitude=d["lng"]
        )
        await db.drivers.insert_one(driver.model_dump())

    # Restaurants
    restaurants_data = [
        {"id": "rest-001", "name": "Trattoria Da Vinci", "address": "Calea Mărășești 12, Bacău", "phone": "0234111222", "latitude": 46.5670, "longitude": 26.9135},
        {"id": "rest-002", "name": "La Cuptor Bacău", "address": "Str. Republicii 34, Bacău", "phone": "0234333444", "latitude": 46.5720, "longitude": 26.9070},
        {"id": "rest-003", "name": "Sushi Room", "address": "Str. 9 Mai 18, Bacău", "phone": "0234555666", "latitude": 46.5610, "longitude": 26.9200},
        {"id": "rest-004", "name": "Burger Craft", "address": "Bd. Unirii 56, Bacău", "phone": "0234777888", "latitude": 46.5750, "longitude": 26.9165},
        {"id": "rest-005", "name": "Casa Moldoveanu", "address": "Str. Mihai Eminescu 8, Bacău", "phone": "0234999111", "latitude": 46.5630, "longitude": 26.9060},
    ]

    for r in restaurants_data:
        restaurant = Restaurant(**r)
        await db.restaurants.insert_one(restaurant.model_dump())

        rest_user = User(
            id=f"user-{r['id']}", email=f"{r['id']}@delivery.ro",
            name=r["name"], role="restaurant", phone=r["phone"],
            restaurant_id=r["id"], restaurant_name=r["name"]
        )
        rest_user_doc = rest_user.model_dump()
        rest_user_doc["password_hash"] = hash_password("restaurant123")
        rest_user_doc["created_at"] = rest_user_doc["created_at"].isoformat()
        await db.users.insert_one(rest_user_doc)

    # Delivery Zones for Bacau
    default_zones = [
        {
            "id": "zone-centru",
            "name": "Zona 1 - Centru",
            "color": "#22c55e",
            "fee": 5.0,
            "is_active": True,
            "sort_order": 1,
            "polygon": [
                {"lat": 46.5730, "lng": 26.9050},
                {"lat": 46.5730, "lng": 26.9220},
                {"lat": 46.5620, "lng": 26.9220},
                {"lat": 46.5620, "lng": 26.9050},
            ],
        },
        {
            "id": "zone-semicentral",
            "name": "Zona 2 - Semicentral",
            "color": "#3b82f6",
            "fee": 8.0,
            "is_active": True,
            "sort_order": 2,
            "polygon": [
                {"lat": 46.5800, "lng": 26.8950},
                {"lat": 46.5800, "lng": 26.9320},
                {"lat": 46.5550, "lng": 26.9320},
                {"lat": 46.5550, "lng": 26.8950},
            ],
        },
        {
            "id": "zone-periferie",
            "name": "Zona 3 - Periferie",
            "color": "#f59e0b",
            "fee": 12.0,
            "is_active": True,
            "sort_order": 3,
            "polygon": [
                {"lat": 46.5900, "lng": 26.8800},
                {"lat": 46.5900, "lng": 26.9450},
                {"lat": 46.5450, "lng": 26.9450},
                {"lat": 46.5450, "lng": 26.8800},
            ],
        },
        {
            "id": "zone-extins",
            "name": "Zona 4 - Extins",
            "color": "#ef4444",
            "fee": 15.0,
            "is_active": True,
            "sort_order": 4,
            "polygon": [
                {"lat": 46.6050, "lng": 26.8600},
                {"lat": 46.6050, "lng": 26.9600},
                {"lat": 46.5300, "lng": 26.9600},
                {"lat": 46.5300, "lng": 26.8600},
            ],
        },
    ]

    from datetime import datetime, timezone
    for z in default_zones:
        z["created_at"] = datetime.now(timezone.utc).isoformat()
        z["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.delivery_zones.insert_one(z)

    # Orders (100)
    first_names = ["Alexandru", "Maria", "Ion", "Elena", "Andrei", "Ana", "Mihai", "Cristina", "Bogdan", "Diana",
                   "Vlad", "Ioana", "George", "Raluca", "Dan", "Adriana", "Florin", "Simona", "Radu", "Laura",
                   "Stefan", "Gabriela", "Marius", "Alina", "Cosmin", "Monica", "Adrian", "Daniela", "Ciprian", "Roxana"]

    last_names = ["Popescu", "Ionescu", "Popa", "Dumitrescu", "Stan", "Gheorghe", "Stoica", "Marin", "Constantin", "Dinu",
                  "Radu", "Marinescu", "Voicu", "Matei", "Florea", "Rusu", "Munteanu", "Mihai", "Nistor", "Tudor"]

    streets = ["Calea Mărășești", "Str. Republicii", "Str. 9 Mai", "Bd. Unirii", "Str. Mihai Eminescu",
               "Str. Nicolae Bălcescu", "Str. Vasile Alecsandri", "Str. George Bacovia", "Calea Romanului",
               "Str. Alexandru cel Bun", "Str. Letea", "Str. Ștefan cel Mare", "Aleea Parcului",
               "Str. Mărășești", "Str. Pictor Aman", "Str. Costache Negri", "Str. Tecuciului"]

    food_items = {
        "rest-001": [
            {"name": "Pizza Margherita", "price": 35.0}, {"name": "Pizza Quattro Stagioni", "price": 45.0},
            {"name": "Pizza Diavola", "price": 42.0}, {"name": "Paste Carbonara", "price": 38.0},
            {"name": "Tiramisu", "price": 22.0}, {"name": "Bruschette", "price": 18.0}, {"name": "Cola 500ml", "price": 8.0},
        ],
        "rest-002": [
            {"name": "Ciorbă de burtă", "price": 25.0}, {"name": "Sarmale cu mămăligă", "price": 32.0},
            {"name": "Mici 10 buc", "price": 35.0}, {"name": "Tochitura moldovenească", "price": 38.0},
            {"name": "Papanași", "price": 22.0}, {"name": "Plăcintă cu brânză", "price": 18.0},
        ],
        "rest-003": [
            {"name": "Sushi Set 24 piese", "price": 95.0}, {"name": "Sushi Set 12 piese", "price": 55.0},
            {"name": "Sashimi Salmon", "price": 45.0}, {"name": "Ramen Tonkotsu", "price": 42.0},
            {"name": "Edamame", "price": 15.0}, {"name": "Gyoza 8 buc", "price": 28.0},
        ],
        "rest-004": [
            {"name": "Burger Classic", "price": 28.0}, {"name": "Burger BBQ Smoky", "price": 35.0},
            {"name": "Cheeseburger Deluxe", "price": 32.0}, {"name": "Cartofi Prăjiți", "price": 14.0},
            {"name": "Onion Rings", "price": 16.0}, {"name": "Milkshake Oreo", "price": 20.0},
        ],
        "rest-005": [
            {"name": "Ciorbă rădăuțeană", "price": 28.0}, {"name": "Frigărui de porc", "price": 35.0},
            {"name": "Ceafă la grătar", "price": 42.0}, {"name": "Salată moldovenească", "price": 18.0},
            {"name": "Cozonac de casă", "price": 15.0}, {"name": "Vin de casă 500ml", "price": 25.0},
        ],
    }

    notes_options = [
        "", "", "", "",
        "Etaj 3, sună la interfon", "Să sune când ajunge jos", "Fără ardei iute",
        "Livrare la poartă", "Bloc nou, intrarea din spate", "Apartament la parter",
        "Să aducă și șervețele extra", "Fără ceapă", "Plată exact, nu am rest",
    ]

    sources = ["S", "G", "W", "B"]
    source_weights = [30, 35, 25, 10]
    restaurants_ids = ["rest-001", "rest-002", "rest-003", "rest-004", "rest-005"]
    restaurant_names = {
        "rest-001": "Trattoria Da Vinci", "rest-002": "La Cuptor Bacău",
        "rest-003": "Sushi Room", "rest-004": "Burger Craft", "rest-005": "Casa Moldoveanu"
    }

    for i in range(1, 101):
        source = random.choices(sources, weights=source_weights)[0]
        restaurant_id = random.choice(restaurants_ids)

        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        customer_name = f"{first_name} {last_name}"
        customer_phone = f"07{random.randint(20, 99)}{random.randint(100000, 999999)}"
        customer_address = f"{random.choice(streets)} {random.randint(1, 150)}, Ap. {random.randint(1, 50)}, Bacău"

        available_items = food_items[restaurant_id]
        num_items = random.randint(1, 4)
        selected_items = random.sample(available_items, min(num_items, len(available_items)))
        items = []
        total = 0
        for item in selected_items:
            qty = random.randint(1, 3)
            items.append({"name": item["name"], "quantity": qty, "price": item["price"]})
            total += item["price"] * qty

        payment_type = random.choice(["CASH", "CASH", "CARD"])
        notes = random.choice(notes_options)

        # Assign zone based on restaurant location (temporary until Task 2.2)
        zone_map = {"rest-001": "Zona 1", "rest-002": "Zona 2", "rest-003": "Zona 3", "rest-004": "Zona 4", "rest-005": "Zona 1"}
        zone = zone_map.get(restaurant_id, "Zona 1")

        # Assign some orders to drivers for stats
        driver_id = None
        driver_name = None
        status = "NEW"
        if i <= 40:  # First 40 orders delivered
            driver_idx = (i - 1) % 5
            d = drivers_data[driver_idx]
            driver_id = d["id"]
            driver_name = d["name"]
            status = "DELIVERED"

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
            "status": status,
            "zone": zone,
            "driver_id": driver_id,
            "driver_name": driver_name,
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
        "data": {"orders": 100, "drivers": 5, "restaurants": 5}
    }
