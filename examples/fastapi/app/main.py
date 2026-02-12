from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .database import get_db
from .models import Task
from .schemas import TaskCreate, TaskUpdate, TaskResponse

app = FastAPI(title="Task Manager API", version="1.0.0")


@app.get("/api/tasks", response_model=list[TaskResponse])
async def list_tasks(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List all tasks with optional status filter."""
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    return query.offset(skip).limit(limit).all()


@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get a specific task by ID."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/tasks", response_model=TaskResponse, status_code=201)
async def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task."""
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


@app.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
