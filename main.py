from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.routes.auth import router as auth_router
from app.routes.calendar import router as calendar_router
from app.routes.dashboard import router as dashboard_router
from app.routes.finance import router as finance_router
from app.routes.habits import router as habits_router
from app.routes.notes import router as notes_router
from app.routes.projects import router as projects_router
from app.routes.tasks import router as tasks_router

app = FastAPI(
    title="LifeOS",
    description="Personal Management System",
    version="0.2.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
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
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(habits_router)
app.include_router(notes_router)
app.include_router(calendar_router)
app.include_router(finance_router)
app.include_router(dashboard_router)
