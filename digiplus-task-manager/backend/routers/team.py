import logging
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Request, HTTPException

from schemas import (
    EmployeeCreate,
    EmployeeStatusUpdate,
    PassSummaryRequest,
    CycleCreate,
    CycleStatusUpdate,
)
from database import get_database

router = APIRouter(prefix="/api", tags=["Team & Work Cycles"])
logger = logging.getLogger()

DEFAULT_EMPLOYEES = [
    {"name": "David", "role": "Senior Fullstack Engineer", "department": "Engineering", "status": "Active"},
    {"name": "Sarah", "role": "Backend Engineer", "department": "Engineering", "status": "Active"},
    {"name": "Elena Rostova", "role": "Security Architect", "department": "Security", "status": "Active"},
    {"name": "Bob", "role": "Frontend Developer", "department": "Engineering", "status": "Active"},
    {"name": "Alice", "role": "QA Lead", "department": "Quality Assurance", "status": "Active"},
    {"name": "Charlie", "role": "DevOps Engineer", "department": "Infrastructure", "status": "Inactive"},
]

def resolve_db(request: Request):
    db = get_database()
    if db is None and hasattr(request.app.state, "mongodb"):
        return request.app.state.mongodb
    return db

# -------------------------------------------------------------
# EMPLOYEE MANAGEMENT (Active & Inactive)
# -------------------------------------------------------------

@router.get("/employees")
async def get_all_employees(request: Request):
    """
    Returns list of all employees with their Active/Inactive status.
    Seeds default employees if the collection is empty.
    """
    db = resolve_db(request)
    if db is None:
        # Fallback in-memory list if DB not connected
        return [
            {"id": f"seed-{idx}", "name": emp["name"], "role": emp["role"], "department": emp["department"], "status": emp["status"], "created_at": "2026-10-30T00:00:00Z"}
            for idx, emp in enumerate(DEFAULT_EMPLOYEES)
        ]

    try:
        count = await db["employees"].count_documents({})
        if count == 0:
            seed_docs = [
                {
                    **emp,
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
                for emp in DEFAULT_EMPLOYEES
            ]
            await db["employees"].insert_many(seed_docs)

        cursor = db["employees"].find().sort("name", 1)
        employees = []
        async for doc in cursor:
            employees.append({
                "id": str(doc.get("_id", "")),
                "name": doc.get("name", "Unknown"),
                "role": doc.get("role", "Developer"),
                "department": doc.get("department", "Engineering"),
                "status": doc.get("status", "Active"),
                "created_at": doc.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(doc.get("created_at"), "isoformat") else str(doc.get("created_at", "")),
            })
        return employees
    except Exception as e:
        logger.error({"message": "Failed to fetch employees", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to fetch employees: {str(e)}")

@router.post("/employees")
async def add_employee(payload: EmployeeCreate, request: Request):
    """
    Adds a new employee with specified status (Active or Inactive).
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")

    clean_name = payload.name.strip()
    clean_status = payload.status.strip().title()
    if clean_status not in ["Active", "Inactive"]:
        clean_status = "Active"

    try:
        # Check if already exists
        existing = await db["employees"].find_one({"name": {"$regex": f"^{clean_name}$", "$options": "i"}})
        if existing:
            raise HTTPException(status_code=400, detail=f"Employee '{clean_name}' already exists.")

        doc = {
            "name": clean_name,
            "role": payload.role.strip() or "Developer",
            "department": payload.department.strip() or "Engineering",
            "status": clean_status,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        res = await db["employees"].insert_one(doc)

        logger.info({
            "message": "New employee created",
            "correlation_id": correlation_id,
            "name": clean_name,
            "status": clean_status,
        })

        return {
            "id": str(res.inserted_id),
            "name": clean_name,
            "role": doc["role"],
            "department": doc["department"],
            "status": clean_status,
            "created_at": doc["created_at"].isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error({"message": "Failed to add employee", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to add employee: {str(e)}")

@router.put("/employees/{emp_id}/status")
async def update_employee_status(emp_id: str, payload: EmployeeStatusUpdate, request: Request):
    """
    Toggles an employee's status between Active and Inactive.
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")

    if not ObjectId.is_valid(emp_id):
        raise HTTPException(status_code=400, detail="Invalid employee ID.")

    clean_status = payload.status.strip().title()
    if clean_status not in ["Active", "Inactive"]:
        raise HTTPException(status_code=400, detail="Status must be 'Active' or 'Inactive'.")

    try:
        result = await db["employees"].update_one(
            {"_id": ObjectId(emp_id)},
            {"$set": {"status": clean_status, "updated_at": datetime.now(timezone.utc)}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Employee not found.")

        logger.info({
            "message": "Employee status updated",
            "correlation_id": correlation_id,
            "emp_id": emp_id,
            "new_status": clean_status,
        })

        return {"id": emp_id, "status": clean_status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error({"message": "Failed to update employee status", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to update employee status: {str(e)}")

# -------------------------------------------------------------
# WORK CYCLES & LIFECYCLE MANAGEMENT
# -------------------------------------------------------------

@router.get("/cycles")
async def get_work_cycles(request: Request):
    """
    Returns all work cycles / lifecycles.
    Seeds default cycle if empty.
    """
    db = resolve_db(request)
    if db is None:
        return [
            {
                "id": "seed-cycle-1",
                "name": "Cycle 1: Core Platform & Launch",
                "goal": "Deliver task tracking, AI summarization, and team telemetry",
                "status": "Active",
                "start_date": "2026-10-15",
                "end_date": "2026-11-15",
            }
        ]

    try:
        count = await db["cycles"].count_documents({})
        if count == 0:
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            next_month_str = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
            seed_cycle = {
                "name": "Cycle 1: Core Platform & Launch",
                "goal": "Deliver task tracking, AI summarization, and team telemetry",
                "status": "Active",
                "start_date": today_str,
                "end_date": next_month_str,
                "created_at": datetime.now(timezone.utc),
            }
            await db["cycles"].insert_one(seed_cycle)

        cursor = db["cycles"].find().sort("created_at", -1)
        cycles = []
        async for doc in cursor:
            cycles.append({
                "id": str(doc.get("_id", "")),
                "name": doc.get("name", "Untitled Cycle"),
                "goal": doc.get("goal", ""),
                "status": doc.get("status", "Active"),
                "start_date": doc.get("start_date", ""),
                "end_date": doc.get("end_date", ""),
                "created_at": doc.get("created_at", datetime.now(timezone.utc)).isoformat() if hasattr(doc.get("created_at"), "isoformat") else str(doc.get("created_at", "")),
            })
        return cycles
    except Exception as e:
        logger.error({"message": "Failed to fetch work cycles", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to fetch work cycles: {str(e)}")

@router.post("/cycles")
async def start_work_cycle(payload: CycleCreate, request: Request):
    """
    Starts a new work cycle (lifecycle).
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")

    clean_name = payload.name.strip()
    clean_status = payload.status.strip().title()
    if clean_status not in ["Active", "Planning", "Completed"]:
        clean_status = "Active"

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    end_str = (datetime.now(timezone.utc) + timedelta(days=21)).strftime("%Y-%m-%d")

    doc = {
        "name": clean_name,
        "goal": (payload.goal or "").strip(),
        "status": clean_status,
        "start_date": (payload.start_date or today_str).strip(),
        "end_date": (payload.end_date or end_str).strip(),
        "created_at": datetime.now(timezone.utc),
    }

    try:
        # If new cycle is Active, optionally mark others as Completed or keep
        res = await db["cycles"].insert_one(doc)

        logger.info({
            "message": "New work cycle started",
            "correlation_id": correlation_id,
            "cycle_name": clean_name,
            "status": clean_status,
        })

        return {
            "id": str(res.inserted_id),
            "name": clean_name,
            "goal": doc["goal"],
            "status": clean_status,
            "start_date": doc["start_date"],
            "end_date": doc["end_date"],
            "created_at": doc["created_at"].isoformat(),
        }
    except Exception as e:
        logger.error({"message": "Failed to create work cycle", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to create cycle: {str(e)}")

@router.put("/cycles/{cycle_id}/status")
async def update_cycle_status(cycle_id: str, payload: CycleStatusUpdate, request: Request):
    """
    Updates a cycle's lifecycle status (Active, Planning, Completed).
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")

    if not ObjectId.is_valid(cycle_id):
        raise HTTPException(status_code=400, detail="Invalid cycle ID.")

    clean_status = payload.status.strip().title()
    if clean_status not in ["Active", "Planning", "Completed"]:
        raise HTTPException(status_code=400, detail="Status must be 'Active', 'Planning', or 'Completed'.")

    try:
        res = await db["cycles"].update_one(
            {"_id": ObjectId(cycle_id)},
            {"$set": {"status": clean_status, "updated_at": datetime.now(timezone.utc)}}
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=404, detail="Cycle not found.")

        logger.info({
            "message": "Work cycle status updated",
            "correlation_id": correlation_id,
            "cycle_id": cycle_id,
            "status": clean_status,
        })

        return {"id": cycle_id, "status": clean_status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error({"message": "Failed to update cycle status", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to update cycle status: {str(e)}")

# -------------------------------------------------------------
# PASS / SHARE MEETING SUMMARY TO ANOTHER EMPLOYEE
# -------------------------------------------------------------

@router.post("/notes/pass-summary")
async def pass_summary_to_employee(payload: PassSummaryRequest, request: Request):
    """
    Allows a manager to pass/share a meeting note summary to another employee.
    The note is marked with shared_with: [target_employee], making it visible
    in that employee's profile and dashboard.
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")

    if not ObjectId.is_valid(payload.doc_id):
        raise HTTPException(status_code=400, detail="Invalid note ID.")

    target = payload.target_employee.strip()
    sender = payload.sender_name.strip() if payload.sender_name else "Manager"
    msg = (payload.message or "").strip()

    if not target:
        raise HTTPException(status_code=400, detail="Target employee name cannot be empty.")

    try:
        share_record = {
            "target": target,
            "sender": sender,
            "message": msg,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Add target to shared_with array and append to shares history
        result = await db["knowledge_base"].update_one(
            {"_id": ObjectId(payload.doc_id)},
            {
                "$addToSet": {"shared_with": target},
                "$push": {"shares_history": share_record},
            }
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Meeting note document not found.")

        logger.info({
            "message": "Meeting summary passed to employee",
            "correlation_id": correlation_id,
            "doc_id": payload.doc_id,
            "sender": sender,
            "target": target,
        })

        return {
            "status": "success",
            "message": f"Summary successfully passed to {target}",
            "doc_id": payload.doc_id,
            "target_employee": target,
            "sender": sender,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error({"message": "Failed to pass summary to employee", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to pass summary: {str(e)}")

