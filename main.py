from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database.connection import create_tables
from app.routes.tasks import router as tasks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title="LifeOS",
    description="Personal Management System",
    version="0.2.0",
    lifespan=lifespan
)


@app.get("/")
def home():
    return {
        "project": "LifeOS",
        "status": "online",
        "message": "Welcome to LifeOS!"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


app.include_router(tasks_router)
