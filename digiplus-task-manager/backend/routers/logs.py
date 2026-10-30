import os
import json
import logging
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["Logs & Telemetry"])
logger = logging.getLogger()

@router.get("/logs")
async def get_system_logs():
    """
    Reads app_logs.json, parses each line as JSON, and returns
    the last 50 log entries reversed (newest first). Handles missing file.
    """
    log_file_path = "app_logs.json"
    if not os.path.exists(log_file_path):
        return []

    entries = []
    try:
        with open(log_file_path, "r", encoding="utf-8") as f:
            for line in f:
                line_str = line.strip()
                if not line_str:
                    continue
                try:
                    entries.append(json.loads(line_str))
                except json.JSONDecodeError:
                    continue
        # Last 50 entries, reversed (newest first)
        return entries[-50:][::-1]
    except Exception as e:
        logger.error({"message": "Failed to read system logs", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {str(e)}")

