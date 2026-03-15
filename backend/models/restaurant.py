from pydantic import BaseModel, Field, ConfigDict
import uuid


class Restaurant(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: str
    latitude: float = 46.567
    longitude: float = 26.913


class RestaurantCreate(BaseModel):
    name: str
    address: str
    phone: str
    latitude: float = 46.567
    longitude: float = 26.913
