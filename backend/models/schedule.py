from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import uuid


class TimeSlot(BaseModel):
    start: str  # "08:00"
    end: str    # "16:00"
    added_by: str = "driver"  # "driver" or "admin"


class ScheduleCreate(BaseModel):
    driver_id: str
    week_start: str  # ISO date string of Monday, e.g. "2026-03-02"
    slots: Dict[str, List[TimeSlot]]  # {"monday": [{"start": "08:00", "end": "16:00"}], ...}
    source: str = "driver"  # "driver" or "admin"


class ScheduleUpdate(BaseModel):
    slots: Dict[str, List[TimeSlot]]
    source: str = "driver"


class AutoGenerateScheduleRequest(BaseModel):
    week_start: str
    days: List[str]
    start_hour: str
    end_hour: str
    total_slots: int
    slot_type: str = "normal"
    repeat_weeks: int = 1


class BulkDeleteScheduleRequest(BaseModel):
    week_start: str
    days: List[str]
    start_hour: str
    end_hour: str
    added_by: str = "auto"


class ClonePreviousWeekRequest(BaseModel):
    week_start: str
    preview_only: bool = True


class Schedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    driver_id: str
    week_start: str
    slots: Dict[str, List[TimeSlot]] = {}
    total_hours: float = 0.0
    # Future: ranking-based calendar opening
    ranking_priority: Optional[int] = None
