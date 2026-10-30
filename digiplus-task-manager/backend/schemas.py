from typing import List, Optional
from pydantic import BaseModel, Field

class ActionItem(BaseModel):
    description: str = Field(description="Clear description of the task")
    owner: str = Field(description="Name of the person assigned, or 'Unassigned'")
    due_date: str = Field(description="Deadline in YYYY-MM-DD format if mentioned, otherwise 'None'")
    status: str = Field(description="Current status: Open, In Progress, or Closed")

class StructuredRecap(BaseModel):
    summary: str = Field(description="A concise catch-up brief or developer handoff summary")
    decisions: List[str] = Field(description="List of key decisions made or technical choices")
    action_items: List[ActionItem] = Field(description="List of action items and tasks")

class IngestRequest(BaseModel):
    raw_text: str = Field(description="Raw text, meeting notes, transcript, or developer handoff content")
    source_type: str = Field(default="meeting", description="Source type (e.g. meeting, developer_handoff)")
    author: Optional[str] = Field(default=None, description="Author or developer username submitting the note")

class TaskStatusUpdate(BaseModel):
    task_index: int = Field(..., ge=0, description="Index of the action item within the parent document")
    status: str = Field(..., description="New status: Open, In Progress, or Closed")

class ReassignRequest(BaseModel):
    old_owner: str = Field(..., min_length=1, description="Departing employee name")
    new_owner: str = Field(..., min_length=1, description="Target assignee name")

class EmployeeCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Full name of employee")
    role: str = Field(default="Developer", description="Role/Designation e.g. Developer, QA, Designer")
    department: str = Field(default="Engineering", description="Department name")
    status: str = Field(default="Active", description="Status: Active or Inactive")

class EmployeeStatusUpdate(BaseModel):
    status: str = Field(..., description="New status: Active or Inactive")

class PassSummaryRequest(BaseModel):
    doc_id: str = Field(..., description="ID of the meeting note or summary document")
    target_employee: str = Field(..., min_length=1, description="Name of the employee to pass summary to")
    sender_name: str = Field(default="Manager", description="Name of the person passing the summary")
    message: Optional[str] = Field(default="", description="Optional message or note for the employee")

class CycleCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Cycle or sprint name e.g. Sprint 14, Q4 Lifecycle")
    goal: Optional[str] = Field(default="", description="Cycle objective or target deliverable")
    start_date: Optional[str] = Field(default="", description="Start date YYYY-MM-DD")
    end_date: Optional[str] = Field(default="", description="End date YYYY-MM-DD")
    status: str = Field(default="Active", description="Cycle status: Active, Planning, or Completed")

class CycleStatusUpdate(BaseModel):
    status: str = Field(..., description="New cycle status: Active, Planning, or Completed")


