import logging
from bson import ObjectId
from fastapi import APIRouter, Request, HTTPException

from schemas import TaskStatusUpdate, ReassignRequest
from database import get_database

router = APIRouter(prefix="/api", tags=["Tasks & Lifecycle"])
logger = logging.getLogger()

def resolve_db(request: Request):
    db = get_database()
    if db is None and hasattr(request.app.state, "mongodb"):
        return request.app.state.mongodb
    return db

@router.get("/tasks")
async def get_all_tasks(request: Request):
    """
    Fetches all documents from knowledge_base MongoDB collection,
    extracts the action_items arrays, and returns them as a flat JSON list
    with doc_id and task_index for interactive lifecycle management.
    """
    db = resolve_db(request)
    if db is None:
        return []

    tasks = []
    try:
        cursor = db["knowledge_base"].find().sort("created_at", -1)
        async for doc in cursor:
            action_items = doc.get("action_items", [])
            doc_id = str(doc.get("_id", ""))
            source_type = doc.get("source_type", "meeting")
            for idx, item in enumerate(action_items):
                tasks.append({
                    "doc_id": doc_id,
                    "task_index": idx,
                    "source_type": source_type,
                    "description": item.get("description", ""),
                    "owner": item.get("owner", "Unassigned"),
                    "due_date": item.get("due_date", "None"),
                    "status": item.get("status", "Open"),
                })
        return tasks
    except Exception as e:
        logger.error({"message": "Failed to fetch tasks from MongoDB", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")

@router.put("/tasks/{doc_id}")
async def update_task_status(doc_id: str, payload: TaskStatusUpdate, request: Request):
    """
    Updates a specific action item's status within the action_items array
    of the corresponding document in MongoDB, enabling full lifecycle tracking.
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")

    if not ObjectId.is_valid(doc_id):
        raise HTTPException(status_code=400, detail="Invalid MongoDB document ID.")

    valid_statuses = ["Open", "In Progress", "Closed"]
    normalized_status = payload.status.strip()
    if normalized_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(valid_statuses)}"
        )

    try:
        update_field = f"action_items.{payload.task_index}.status"
        result = await db["knowledge_base"].update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {update_field: normalized_status}}
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Document not found.")

        logger.info({
            "message": "Task status updated successfully",
            "correlation_id": correlation_id,
            "doc_id": doc_id,
            "task_index": payload.task_index,
            "new_status": normalized_status,
        })

        return {
            "status": "success",
            "doc_id": doc_id,
            "task_index": payload.task_index,
            "new_status": normalized_status,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error({
            "message": "Failed to update task status in MongoDB",
            "correlation_id": correlation_id,
            "error": str(e),
        })
        raise HTTPException(status_code=500, detail=f"Database update failed: {str(e)}")

@router.post("/reassign")
async def reassign_team_tasks(payload: ReassignRequest, request: Request):
    """
    Finds all documents containing action_items assigned to old_owner
    where status is not 'Closed', updates those items to new_owner, and saves.
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")

    old_owner_clean = payload.old_owner.strip()
    new_owner_clean = payload.new_owner.strip()

    if not old_owner_clean or not new_owner_clean:
        raise HTTPException(status_code=400, detail="old_owner and new_owner cannot be empty.")

    try:
        cursor = db["knowledge_base"].find({"action_items": {"$exists": True}})
        reassigned_tasks_count = 0
        documents_updated_count = 0

        async for doc in cursor:
            action_items = doc.get("action_items", [])
            modified = False
            for item in action_items:
                owner = item.get("owner", "").strip()
                status = item.get("status", "").strip()
                # Case-insensitive match on owner, and status not closed
                if owner.lower() == old_owner_clean.lower() and status.lower() != "closed":
                    item["owner"] = new_owner_clean
                    modified = True
                    reassigned_tasks_count += 1

            if modified:
                await db["knowledge_base"].update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"action_items": action_items}}
                )
                documents_updated_count += 1

        logger.info({
            "message": "Team offboarding work transferred successfully",
            "correlation_id": correlation_id,
            "old_owner": old_owner_clean,
            "new_owner": new_owner_clean,
            "reassigned_tasks": reassigned_tasks_count,
            "documents_updated": documents_updated_count,
        })

        return {
            "status": "success",
            "old_owner": old_owner_clean,
            "new_owner": new_owner_clean,
            "reassigned_tasks": reassigned_tasks_count,
            "documents_updated": documents_updated_count,
        }
    except Exception as e:
        logger.error({
            "message": "Failed to reassign team tasks",
            "correlation_id": correlation_id,
            "error": str(e),
        })
        raise HTTPException(status_code=500, detail=f"Failed to reassign tasks: {str(e)}")

@router.get("/profile/{username}")
async def get_developer_profile(username: str, request: Request):
    """
    Returns personal developer profile data:
    1. Action items where owner matches username.
    2. Chronological history of developer_handoff documents associated with user.
    """
    db = resolve_db(request)
    if db is None:
        return {
            "username": username,
            "assigned_tasks": [],
            "handoff_history": [],
            "metrics": {"total_assigned": 0, "open_tasks": 0, "in_progress_tasks": 0, "closed_tasks": 0, "total_handoffs": 0}
        }

    clean_user = username.strip()
    clean_user_lower = clean_user.lower()

    assigned_tasks = []
    handoff_history = []
    shared_summaries = []

    try:
        # Fetch all documents sorted newest first
        cursor = db["knowledge_base"].find().sort("created_at", -1)

        async for doc in cursor:
            doc_id = str(doc.get("_id", ""))
            source_type = doc.get("source_type", "meeting")
            action_items = doc.get("action_items", [])
            author = doc.get("author", "")
            raw_text = doc.get("raw_text", "")
            created_at = doc.get("created_at")
            created_at_str = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or "")

            # 1. Check for assigned action items
            for idx, item in enumerate(action_items):
                item_owner = item.get("owner", "").strip()
                if item_owner.lower() == clean_user_lower:
                    assigned_tasks.append({
                        "doc_id": doc_id,
                        "task_index": idx,
                        "source_type": source_type,
                        "description": item.get("description", ""),
                        "owner": item_owner,
                        "due_date": item.get("due_date", "None"),
                        "status": item.get("status", "Open"),
                        "created_at": created_at_str,
                    })

            # 2. Check for developer_handoff documents associated with this user
            if source_type == "developer_handoff":
                is_associated = (
                    author.lower() == clean_user_lower
                    or any(item.get("owner", "").strip().lower() == clean_user_lower for item in action_items)
                    or clean_user_lower in raw_text.lower()
                    or clean_user_lower in ["developer", "admin", "manager"]  # fallback for generic role view
                )

                if is_associated:
                    handoff_history.append({
                        "id": doc_id,
                        "source_type": source_type,
                        "author": author or clean_user,
                        "summary": doc.get("summary", ""),
                        "decisions": doc.get("decisions", []),
                        "action_items": action_items,
                        "raw_text": raw_text,
                        "created_at": created_at_str,
                    })

            # 3. Check for summaries passed / shared to this employee
            shared_with = doc.get("shared_with", [])
            if any(s.strip().lower() == clean_user_lower for s in shared_with):
                shares_for_user = [
                    sh for sh in doc.get("shares_history", [])
                    if sh.get("target", "").strip().lower() == clean_user_lower
                ]
                shared_summaries.append({
                    "id": doc_id,
                    "source_type": source_type,
                    "author": author or "Team",
                    "filename": doc.get("filename"),
                    "summary": doc.get("summary", ""),
                    "decisions": doc.get("decisions", []),
                    "action_items": action_items,
                    "created_at": created_at_str,
                    "shares_history": shares_for_user,
                    "latest_message": shares_for_user[-1].get("message", "") if shares_for_user else "",
                    "sender": shares_for_user[-1].get("sender", "Manager") if shares_for_user else "Manager",
                })

        return {
            "username": clean_user,
            "assigned_tasks": assigned_tasks,
            "handoff_history": handoff_history,
            "shared_summaries": shared_summaries,
            "metrics": {
                "total_assigned": len(assigned_tasks),
                "open_tasks": sum(1 for t in assigned_tasks if t.get("status", "").lower() == "open"),
                "in_progress_tasks": sum(1 for t in assigned_tasks if t.get("status", "").lower() == "in progress"),
                "closed_tasks": sum(1 for t in assigned_tasks if t.get("status", "").lower() == "closed"),
                "total_handoffs": len(handoff_history),
                "total_shared_summaries": len(shared_summaries),
            }
        }
    except Exception as e:
        logger.error({"message": "Failed to fetch developer profile", "username": username, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to fetch profile: {str(e)}")


