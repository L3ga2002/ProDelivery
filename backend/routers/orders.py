from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from shapely.geometry import Point, Polygon
from database import db
from auth import get_current_user
from models.order import Order, OrderCreate, AssignOrder, UpdateOrderStatus, PreparationTime

router = APIRouter(prefix="/orders", tags=["orders"])


def build_shapely_polygon(coords):
    if len(coords) < 3:
        return None
    ring = [(c["lng"], c["lat"]) for c in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return Polygon(ring)


async def detect_delivery_zone(lat: float | None, lng: float | None):
    if lat is None or lng is None:
        return None

    point = Point(lng, lat)
    zones = await db.delivery_zones.find({"is_active": True}, {"_id": 0}).to_list(200)
    matches = []
    for zone in zones:
        poly = build_shapely_polygon(zone.get("polygon", []))
        if poly and poly.contains(point):
            matches.append((poly.area, zone))
    if matches:
        return sorted(matches, key=lambda item: item[0])[0][1]
    return None


@router.get("")
async def get_orders(current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    for order in orders:
        if isinstance(order.get('created_at'), str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order.get('updated_at'), str):
            order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    return orders


@router.get("/driver/{driver_id}")
async def get_driver_orders(driver_id: str, current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find(
        {"driver_id": driver_id, "status": {"$nin": ["DELIVERED"]}},
        {"_id": 0}
    ).to_list(100)
    return orders


@router.get("/restaurant/{restaurant_id}")
async def get_restaurant_orders(restaurant_id: str, current_user: dict = Depends(get_current_user)):
    orders = await db.orders.find(
        {"restaurant_id": restaurant_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return orders


@router.get("/{order_id}")
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("")
async def create_order(order_data: OrderCreate, current_user: dict = Depends(get_current_user)):
    restaurant = await db.restaurants.find_one({"id": order_data.restaurant_id}, {"_id": 0})
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    count = await db.orders.count_documents({})
    order_number = f"{order_data.source}.{count + 1:04d}"

    detected_zone = await detect_delivery_zone(order_data.customer_latitude, order_data.customer_longitude)
    subtotal_amount = order_data.subtotal_amount if order_data.subtotal_amount is not None else order_data.total_amount
    delivery_fee = detected_zone.get("fee", 0) if detected_zone else (order_data.delivery_fee or 0)
    total_amount = round(subtotal_amount + delivery_fee, 2)

    order = Order(
        order_number=order_number,
        source=order_data.source,
        restaurant_id=order_data.restaurant_id,
        restaurant_name=restaurant["name"],
        customer_name=order_data.customer_name,
        customer_phone=order_data.customer_phone,
        customer_address=order_data.customer_address,
        customer_latitude=order_data.customer_latitude,
        customer_longitude=order_data.customer_longitude,
        items=order_data.items,
        subtotal_amount=subtotal_amount,
        delivery_fee=delivery_fee,
        total_amount=total_amount,
        payment_type=order_data.payment_type,
        notes=order_data.notes,
        zone=detected_zone.get("name") if detected_zone else None,
        delivery_zone_id=detected_zone.get("id") if detected_zone else None,
        delivery_zone_name=detected_zone.get("name") if detected_zone else None,
        delivery_sector=detected_zone.get("sector") if detected_zone else None,
        delivery_zone_level=detected_zone.get("zone_level") if detected_zone else None,
    )

    doc = order.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()

    await db.orders.insert_one(doc)
    return order


@router.put("/{order_id}/assign")
async def assign_order(order_id: str, data: AssignOrder, current_user: dict = Depends(get_current_user)):
    driver = await db.drivers.find_one({"id": data.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

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


@router.put("/{order_id}/preparing")
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


@router.put("/{order_id}/ready")
async def set_ready(order_id: str, current_user: dict = Depends(get_current_user)):
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": "READY",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Order ready"}


@router.put("/{order_id}/status")
async def update_order_status(order_id: str, data: UpdateOrderStatus, current_user: dict = Depends(get_current_user)):
    valid_statuses = ["NEW", "PREPARING", "READY", "ASSIGNED", "ACCEPTED", "PICKED_UP", "DELIVERED", "CANCELLED"]
    if data.status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    if data.status == "CANCELLED" and not data.cancellation_reason:
        raise HTTPException(status_code=400, detail="Cancellation reason is required")

    update_data = {
        "status": data.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if data.status == "CANCELLED" and data.cancellation_reason:
        update_data["cancellation_reason"] = data.cancellation_reason
        update_data["cancelled_by"] = current_user.get("role", "unknown")

    await db.orders.update_one({"id": order_id}, {"$set": update_data})

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

    if data.status == "CANCELLED":
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        if order and order.get("driver_id"):
            await db.drivers.update_one(
                {"id": order["driver_id"]},
                {"$set": {"current_order_id": None}}
            )

    return {"message": "Status updated"}
