from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import uuid


class Driver(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    is_active: bool = False
    latitude: float = 46.567
    longitude: float = 26.913
    current_order_id: Optional[str] = None
    total_deliveries: int = 0
    total_earnings: float = 0


class DriverCreate(BaseModel):
    name: str
    phone: str
    email: str
