from fastapi import FastAPI

app = FastAPI(
     title="LifeOS",
     description="Personal Management System",
    version="0.1.0"
)


@app.get("/")
def home ():
    return {
        "project": "LifeOS",
        "status": "online",
        "messag": "Welcome to LifeOS!"
    }


@app.get("/health")
def health_cheack():
    return {
        "status": "healthy"
    }
