import io
import json
import time
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form, Response
from bson import ObjectId
import google.generativeai as genai
from PyPDF2 import PdfReader

from schemas import IngestRequest, StructuredRecap
from database import get_database

router = APIRouter(prefix="/api", tags=["Ingestion"])
logger = logging.getLogger()

def resolve_db(request: Request):
    db = get_database()
    if db is None and hasattr(request.app.state, "mongodb"):
        return request.app.state.mongodb
    return db

async def process_text_with_gemini(raw_text: str, source_type: str, correlation_id: str) -> tuple[StructuredRecap, float]:
    start_time = time.perf_counter()
    logger.info({
        "message": "Starting AI processing",
        "correlation_id": correlation_id,
        "source_type": source_type,
    })

    try:
        model = genai.GenerativeModel(
            model_name="gemini-3.8-flash",
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=StructuredRecap,
            ),
        )
        prompt = (
            f"You are an expert AI enterprise intelligence assistant analyzing {source_type} content.\n"
            f"Extract a concise summary, key architectural/business decisions, and actionable tasks with owners and deadlines.\n\n"
            f"CRITICAL: You MUST return a JSON object containing exactly three keys: summary, decisions, and action_items. "
            f"If there are no decisions or action items found in the text, you must return an empty array [] for those keys. Never omit the keys.\n\n"
            f"Content:\n{raw_text}"
        )
        response = await model.generate_content_async(prompt)
        ai_latency = time.perf_counter() - start_time

        # Robust validation ensuring no missing keys even if text has no action items or decisions
        try:
            parsed_json = json.loads(response.text)
            if not isinstance(parsed_json, dict):
                parsed_json = {}
            if "summary" not in parsed_json or parsed_json["summary"] is None:
                parsed_json["summary"] = "Summary unavailable"
            if "decisions" not in parsed_json or parsed_json["decisions"] is None:
                parsed_json["decisions"] = []
            if "action_items" not in parsed_json or parsed_json["action_items"] is None:
                parsed_json["action_items"] = []
            recap = StructuredRecap.model_validate(parsed_json)
        except Exception:
            recap = StructuredRecap.model_validate_json(response.text)

        logger.info({
            "message": "AI processing succeeded",
            "correlation_id": correlation_id,
            "ai_latency_seconds": round(ai_latency, 4),
        })
        return recap, ai_latency
    except Exception as exc:
        ai_latency = time.perf_counter() - start_time
        logger.error({
            "message": "AI processing failed",
            "correlation_id": correlation_id,
            "ai_latency_seconds": round(ai_latency, 4),
            "error": str(exc),
        })
        raise HTTPException(
            status_code=500,
            detail=f"AI processing failed: {str(exc)}",
        )

@router.post("/ingest")
async def ingest_notes(payload: IngestRequest, request: Request):
    correlation_id = getattr(request.state, "correlation_id", "unknown")
    recap, _ = await process_text_with_gemini(payload.raw_text, payload.source_type, correlation_id)

    doc_to_save = {
        "source_type": payload.source_type,
        "author": payload.author or "Anonymous",
        "raw_text": payload.raw_text,
        "summary": recap.summary,
        "decisions": recap.decisions,
        "action_items": [item.model_dump() for item in recap.action_items],
        "created_at": datetime.now(timezone.utc),
    }

    db = resolve_db(request)
    doc_id = None
    if db is not None:
        try:
            result = await db["knowledge_base"].insert_one(doc_to_save)
            doc_id = str(result.inserted_id)
        except Exception as db_err:
            logger.error({
                "message": "Failed to persist document to MongoDB",
                "correlation_id": correlation_id,
                "error": str(db_err),
            })
            raise HTTPException(
                status_code=500,
                detail=f"Database persistence failed: {str(db_err)}",
            )
    else:
        logger.warning({
            "message": "MongoDB is not configured; document was not persisted to knowledge_base",
            "correlation_id": correlation_id,
        })

    return {
        "id": doc_id,
        "source_type": payload.source_type,
        "summary": recap.summary,
        "decisions": recap.decisions,
        "action_items": recap.action_items,
        "created_at": doc_to_save["created_at"].isoformat(),
    }

@router.post("/upload")
async def upload_pdf(
    request: Request,
    file: UploadFile = File(...),
    source_type: str = Form("meeting")
):
    """
    Accepts an UploadFile (PDF), extracts text using PyPDF2,
    processes it through gemini-3.8-flash structured summarization,
    and persists the result to MongoDB knowledge_base.
    """
    correlation_id = getattr(request.state, "correlation_id", "unknown")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    try:
        content = await file.read()
        reader = PdfReader(io.BytesIO(content))
        extracted_pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_pages.append(text)
        extracted_text = "\n".join(extracted_pages).strip()
    except Exception as e:
        logger.error({
            "message": "Failed to parse PDF file",
            "correlation_id": correlation_id,
            "filename": file.filename,
            "error": str(e)
        })
        raise HTTPException(status_code=400, detail=f"Unable to parse PDF: {str(e)}")

    if not extracted_text:
        raise HTTPException(status_code=400, detail="The PDF contains no readable text content.")

    logger.info({
        "message": "PDF text extracted successfully",
        "correlation_id": correlation_id,
        "filename": file.filename,
        "extracted_chars": len(extracted_text)
    })

    recap, _ = await process_text_with_gemini(extracted_text, source_type, correlation_id)

    doc_to_save = {
        "source_type": source_type,
        "filename": file.filename,
        "raw_text": extracted_text,
        "summary": recap.summary,
        "decisions": recap.decisions,
        "action_items": [item.model_dump() for item in recap.action_items],
        "created_at": datetime.now(timezone.utc),
    }

    db = resolve_db(request)
    doc_id = None
    if db is not None:
        try:
            result = await db["knowledge_base"].insert_one(doc_to_save)
            doc_id = str(result.inserted_id)
        except Exception as db_err:
            logger.error({
                "message": "Failed to persist PDF summary to MongoDB",
                "correlation_id": correlation_id,
                "error": str(db_err),
            })
            raise HTTPException(status_code=500, detail=f"Database persistence failed: {str(db_err)}")

    return {
        "id": doc_id,
        "filename": file.filename,
        "source_type": source_type,
        "summary": recap.summary,
        "decisions": recap.decisions,
        "action_items": recap.action_items,
        "created_at": doc_to_save["created_at"].isoformat(),
    }

@router.get("/notes")
async def get_all_notes(request: Request):
    """
    Fetches all meeting notes and developer handoffs, sorted newest first.
    Includes summary, decisions, action_items, author, created_at, shared_with.
    """
    db = resolve_db(request)
    if db is None:
        return []

    try:
        cursor = db["knowledge_base"].find().sort("created_at", -1)
        notes = []
        async for doc in cursor:
            created_at = doc.get("created_at")
            created_at_str = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or "")
            notes.append({
                "id": str(doc.get("_id", "")),
                "source_type": doc.get("source_type", "meeting"),
                "author": doc.get("author", "Anonymous"),
                "filename": doc.get("filename"),
                "summary": doc.get("summary", ""),
                "decisions": doc.get("decisions", []),
                "action_items": doc.get("action_items", []),
                "shared_with": doc.get("shared_with", []),
                "shares_history": doc.get("shares_history", []),
                "raw_text": doc.get("raw_text", ""),
                "created_at": created_at_str,
            })
        return notes
    except Exception as e:
        logger.error({"message": "Failed to fetch meeting notes", "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Failed to fetch notes: {str(e)}")

@router.get("/notes/{doc_id}")
async def get_note_by_id(doc_id: str, request: Request):
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")
    if not ObjectId.is_valid(doc_id):
        raise HTTPException(status_code=400, detail="Invalid note ID.")
    try:
        doc = await db["knowledge_base"].find_one({"_id": ObjectId(doc_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Meeting note not found.")
        created_at = doc.get("created_at")
        created_at_str = created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at or "")
        return {
            "id": str(doc.get("_id", "")),
            "source_type": doc.get("source_type", "meeting"),
            "author": doc.get("author", "Anonymous"),
            "filename": doc.get("filename"),
            "summary": doc.get("summary", ""),
            "decisions": doc.get("decisions", []),
            "action_items": doc.get("action_items", []),
            "shared_with": doc.get("shared_with", []),
            "shares_history": doc.get("shares_history", []),
            "raw_text": doc.get("raw_text", ""),
            "created_at": created_at_str,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/{doc_id}/download")
async def download_note_summary(doc_id: str, request: Request):
    """
    Downloads the meeting summary and action items formatted as a Markdown document.
    """
    db = resolve_db(request)
    if db is None:
        raise HTTPException(status_code=500, detail="Database is not connected.")
    if not ObjectId.is_valid(doc_id):
        raise HTTPException(status_code=400, detail="Invalid note ID.")

    doc = await db["knowledge_base"].find_one({"_id": ObjectId(doc_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Meeting note not found.")

    created_at = doc.get("created_at")
    created_str = created_at.strftime("%Y-%m-%d %H:%M UTC") if hasattr(created_at, "strftime") else str(created_at or "")
    source_type = doc.get("source_type", "meeting").replace("_", " ").title()
    author = doc.get("author", "Team")
    summary = doc.get("summary", "No summary available.")
    decisions = doc.get("decisions", [])
    action_items = doc.get("action_items", [])

    lines = [
        f"# {source_type} Summary",
        f"**Date:** {created_str}",
        f"**Author:** {author}",
        "",
        "## Executive Summary",
        summary,
        "",
        "## Key Decisions",
    ]
    if decisions:
        for d in decisions:
            lines.append(f"- {d}")
    else:
        lines.append("- None noted.")

    lines.extend(["", "## Action Items"])
    if action_items:
        for item in action_items:
            owner = item.get("owner", "Unassigned")
            due = item.get("due_date", "None")
            status = item.get("status", "Open")
            desc = item.get("description", "")
            lines.append(f"- [{status}] **{desc}** (Owner: {owner} | Due: {due})")
    else:
        lines.append("- No action items recorded.")

    content = "\n".join(lines)
    filename = f"summary_{doc_id}.md"

    return Response(
        content=content,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


