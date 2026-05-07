from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid


class Restaurant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    latitude: float = 46.567
    longitude: float = 26.913
    location_source: Optional[str] = None


class RestaurantCreate(BaseModel):
    name: str
    address: str
    phone: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    latitude: float = 46.567
    longitude: float = 26.913
    location_source: Optional[str] = None


class RestaurantAvailabilityRequest(BaseModel):
    lat: float
    lng: float
