import os
import uuid
import logging
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from pythonjsonlogger import jsonlogger

from database import connect_db, close_db, MONGODB_URI
from routers.ingest import router as ingest_router
from routers.tasks import router as tasks_router
from routers.logs import router as logs_router
from routers.team import router as team_router

# Load environment variables
load_dotenv()

# Setup File Logging with correlation ID format
logger = logging.getLogger()
logger.handlers.clear()
log_handler = logging.FileHandler("app_logs.json")
formatter = jsonlogger.JsonFormatter(
    fmt="%(asctime)s %(levelname)s %(correlation_id)s %(name)s %(message)s"
)
log_handler.setFormatter(formatter)
logger.addHandler(log_handler)
logger.setLevel(logging.INFO)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info({"message": "Starting DigiPlus Task Manager Backend", "correlation_id": "system"})
    
    # Initialize MongoDB connection
    app.state.mongodb = connect_db()
    
    # Initialize Google Gemini SDK
    if GEMINI_API_KEY and "your_gemini" not in GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
    
    yield
    
    # Clean shutdown
    close_db()
    logger.info({"message": "Shutting down DigiPlus Task Manager Backend", "correlation_id": "system"})

# FastAPI Application
app = FastAPI(
    title="DigiPlus Task Manager Enterprise API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Correlation-ID", "Content-Disposition"],
)

# Correlation ID Middleware
@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    correlation_id = str(uuid.uuid4())
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["X-Correlation-ID"] = correlation_id
    return response

# Include Modular Routers
app.include_router(ingest_router)
app.include_router(tasks_router)
app.include_router(logs_router)
app.include_router(team_router)

@app.get("/")
async def root():
    return {
        "message": "Welcome to DigiPlus Task Manager Enterprise API",
        "status": "online",
        "version": "2.0.0",
        "modules": ["ingest", "tasks", "logs"]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "mongodb_configured": bool(MONGODB_URI and "your_mongodb" not in MONGODB_URI),
        "gemini_configured": bool(GEMINI_API_KEY and "your_gemini" not in GEMINI_API_KEY),
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
