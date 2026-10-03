from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class Email(BaseModel):
    id: str
    sender: str
    subject: str
    body: str
    timestamp: datetime
    read: bool = False
    category: Optional[str] = None
    action_items: Optional[List[Dict[str, Any]]] = None
    summary: Optional[str] = None

class PromptConfig(BaseModel):
    id: str
    name: str
    template: str  # User-facing simple prompt
    system_template: Optional[str] = None  # Backend detailed prompt (if None, uses template)
    description: str

class Draft(BaseModel):
    id: str
    email_id: Optional[str] = None # If replying to an email
    to: str
    subject: str
    body: str
    saved_at: datetime

class ChatRequest(BaseModel):
    query: str
    email_id: Optional[str] = None # Context can be a specific email or whole inbox

class GenerateDraftRequest(BaseModel):
    email_id: str
    instructions: Optional[str] = None

class ActionItem(BaseModel):
    task: str
    deadline: Optional[str] = None

class ActionItemList(BaseModel):
    items: List[ActionItem]
