from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Literal, Optional
from datetime import datetime, timezone
import uuid


class Driver(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    phone: str
    email: Optional[str] = None
    vehicle_type: Literal["scooter", "car"] = "scooter"
    email_verified: bool = False
    is_active: bool = False
    latitude: float = 46.567
    longitude: float = 26.913
    current_order_id: Optional[str] = None
    total_deliveries: int = 0
    total_earnings: float = 0
    punctuality_rate: float = 0.85
    joined_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class DriverCreate(BaseModel):
    name: str
    phone: str
    email: EmailStr
    vehicle_type: Literal["scooter", "car"] = "scooter"


class DriverEmailVerification(BaseModel):
    code: str
