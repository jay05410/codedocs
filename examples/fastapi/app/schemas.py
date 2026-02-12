from pydantic import BaseModel, Field
from datetime import datetime


class TaskCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    status: str = "pending"
    priority: int = 0
    assignee_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: int | None = None
    is_completed: bool | None = None
    assignee_id: int | None = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str | None
    status: str
    priority: int
    is_completed: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}
