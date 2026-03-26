from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os
import logging

from database import db, client
from routers import auth, drivers, restaurants, orders, stats, seed, schedules, emergency_slots

app = FastAPI(title="Delivery Platform API")

# API prefix wrapper
from fastapi import APIRouter
api_router = APIRouter(prefix="/api")

# Include all sub-routers into the api_router
api_router.include_router(auth.router)
api_router.include_router(drivers.router)
api_router.include_router(restaurants.router)
api_router.include_router(orders.router)
api_router.include_router(stats.router)
api_router.include_router(seed.router)
api_router.include_router(schedules.router)
api_router.include_router(emergency_slots.router)


@api_router.get("/")
async def root():
    return {"message": "Delivery Platform API v2.0", "status": "running"}


app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
