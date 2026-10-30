import os
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "digiplus_task_manager")

client: Optional[AsyncIOMotorClient] = None

def get_database() -> Optional[AsyncIOMotorDatabase]:
    """Returns the active MongoDB database instance, connecting if needed."""
    global client
    if client is None and MONGODB_URI and "your_mongodb" not in MONGODB_URI:
        try:
            client = AsyncIOMotorClient(MONGODB_URI)
        except Exception as e:
            logger.error({"message": "Failed to connect to MongoDB", "error": str(e)})
            return None
    if client is not None:
        return client[DB_NAME]
    return None

def connect_db() -> Optional[AsyncIOMotorDatabase]:
    """Explicitly initializes the MongoDB client during app startup."""
    global client
    if MONGODB_URI and "your_mongodb" not in MONGODB_URI:
        try:
            client = AsyncIOMotorClient(MONGODB_URI)
            logger.info({"message": "Connected to MongoDB Atlas", "database": DB_NAME})
            return client[DB_NAME]
        except Exception as e:
            logger.error({"message": "Error connecting to MongoDB Atlas", "error": str(e)})
            return None
    return None

def close_db() -> None:
    """Closes the MongoDB connection client."""
    global client
    if client:
        client.close()
        client = None
        logger.info({"message": "Closed MongoDB connection"})

