from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone
import uuid


class OrderItem(BaseModel):
    name: str
    quantity: int
    price: float


class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    source: str = "S"
    restaurant_id: str
    restaurant_name: str
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    customer_name: str
    customer_phone: str
    customer_address: str
    items: List[OrderItem] = []
    total_amount: float
    payment_type: str
    notes: Optional[str] = None
    status: str = "NEW"
    zone: Optional[str] = None
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
    cancellation_reason: Optional[str] = None


class PreparationTime(BaseModel):
    preparation_time: int
