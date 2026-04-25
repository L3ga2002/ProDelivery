from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from shapely.geometry import Point, Polygon
from database import db
from auth import get_current_user
from models.delivery_zone import DeliveryZone, DeliveryZoneCreate, DeliveryZoneUpdate, ZoneDetectRequest

router = APIRouter(prefix="/zones", tags=["zones"])

FIXED_ZONE_FEES = {1: 14.0, 2: 22.0, 3: 33.0}


def ensure_admin(current_user: dict) -> None:
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")


def build_shapely_polygon(coords):
    if len(coords) < 3:
        return None
    ring = [(c["lng"], c["lat"]) for c in coords]
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return Polygon(ring)


def build_zone_update_payload(data: DeliveryZoneUpdate, existing: dict) -> dict:
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.sector is not None:
        update_data["sector"] = data.sector
    if data.zone_level is not None:
        update_data["zone_level"] = data.zone_level
        update_data["fee"] = FIXED_ZONE_FEES.get(data.zone_level, existing.get("fee", 0))
    if data.name is not None:
        update_data["name"] = data.name
    if data.color is not None:
        update_data["color"] = data.color
    if data.fee is not None and data.zone_level is None:
        update_data["fee"] = data.fee
    if data.polygon is not None:
        update_data["polygon"] = [{"lat": coord.lat, "lng": coord.lng} for coord in data.polygon]
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    if data.sort_order is not None:
        update_data["sort_order"] = data.sort_order
    return update_data


def build_detect_response(zone: dict | None) -> dict:
    if zone:
        return {
            "zone_id": zone["id"],
            "zone_name": zone["name"],
            "sector": zone.get("sector"),
            "zone_level": zone.get("zone_level"),
            "fee": zone["fee"],
            "color": zone["color"],
        }

    return {
        "zone_id": None,
        "zone_name": "In afara zonelor",
        "sector": None,
        "zone_level": None,
        "fee": 0,
        "color": "#999999",
    }


@router.get("")
async def get_zones(current_user: dict = Depends(get_current_user)):
    zones = await db.delivery_zones.find({}, {"_id": 0}).sort("sort_order", 1).to_list(300)
    return zones


@router.get("/{zone_id}")
async def get_zone(zone_id: str, current_user: dict = Depends(get_current_user)):
    zone = await db.delivery_zones.find_one({"id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.post("")
async def create_zone(data: DeliveryZoneCreate, current_user: dict = Depends(get_current_user)):
    ensure_admin(current_user)

    zone = DeliveryZone(
        sector=data.sector,
        zone_level=data.zone_level,
        name=data.name,
        color=data.color,
        fee=FIXED_ZONE_FEES.get(data.zone_level, data.fee),
        polygon=data.polygon,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    doc = zone.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    doc["polygon"] = [{"lat": c.lat, "lng": c.lng} for c in zone.polygon]
    await db.delivery_zones.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{zone_id}")
async def update_zone(zone_id: str, data: DeliveryZoneUpdate, current_user: dict = Depends(get_current_user)):
    ensure_admin(current_user)

    existing = await db.delivery_zones.find_one({"id": zone_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Zone not found")

    update_data = build_zone_update_payload(data, existing)

    await db.delivery_zones.update_one({"id": zone_id}, {"$set": update_data})
    updated = await db.delivery_zones.find_one({"id": zone_id}, {"_id": 0})
    return updated


@router.delete("/{zone_id}")
async def delete_zone(zone_id: str, current_user: dict = Depends(get_current_user)):
    ensure_admin(current_user)

    result = await db.delivery_zones.delete_one({"id": zone_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zone not found")
    return {"message": "Zone deleted"}


@router.post("/detect")
async def detect_zone(data: ZoneDetectRequest, current_user: dict = Depends(get_current_user)):
    point = Point(data.lng, data.lat)
    zones = await db.delivery_zones.find({"is_active": True}, {"_id": 0}).to_list(100)
    matches = []

    for zone in zones:
        coords = zone.get("polygon", [])
        poly = build_shapely_polygon(coords)
        if poly and poly.contains(point):
            matches.append((poly.area, zone))

    if matches:
        _, best_zone = sorted(matches, key=lambda item: item[0])[0]
        return build_detect_response(best_zone)

    return build_detect_response(None)
