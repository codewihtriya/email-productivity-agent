from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
from models import Email, PromptConfig, Draft, GenerateDraftRequest
from services.store import store
from services.ingestion import load_mock_data
from services.processor import process_inbox, process_single_email
from services.llm_engine import chat_with_email, generate_draft_reply, chat_with_inbox
from models import ChatRequest

app = FastAPI(title="Email Productivity Agent API")

# Get frontend URL from environment or use default
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Local development
        FRONTEND_URL,              # Production frontend
        "https://*.vercel.app",    # All Vercel preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    from services.ingestion import start_file_watcher
    load_mock_data()
    start_file_watcher()

@app.get("/")
def read_root():
    return {"message": "Email Productivity Agent API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "Email Agent API is running"}

@app.get("/emails", response_model=List[Email])
def get_emails():
    return store.get_all_emails()

@app.post("/emails", response_model=Email)
def create_email(email: Email):
    """Add a new email to the inbox"""
    store.add_email(email)
    return email

@app.get("/emails/{email_id}", response_model=Email)
def get_email(email_id: str):
    email = store.get_email(email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return email

@app.get("/prompts", response_model=List[PromptConfig])
def get_prompts():
    return store.get_all_prompts()

@app.put("/prompts/{prompt_id}")
def update_prompt(prompt_id: str, prompt: PromptConfig):
    if prompt_id != prompt.id:
        raise HTTPException(status_code=400, detail="Prompt ID mismatch")
    store.update_prompt(prompt)
    return {"message": "Prompt updated"}

@app.post("/ingest")
async def trigger_ingest():
    # In a real app, this might trigger fetching from an IMAP server
    # Here we just reload mock data or reset
    load_mock_data()
    return {"message": "Ingestion triggered"}

@app.post("/process")
async def trigger_process():
    print("=" * 50)
    print("PROCESS INBOX TRIGGERED")
    print("=" * 50)
    await process_inbox()
    print("=" * 50)
    print("PROCESS INBOX COMPLETED")
    print("=" * 50)
    return {"message": "Inbox processing completed"}

@app.post("/process/{email_id}")
async def trigger_process_email(email_id: str):
    await process_single_email(email_id)
    return {"message": f"Processing started for {email_id}"}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    if request.email_id:
        email = store.get_email(request.email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        response = await chat_with_email(email.body, request.query)
        return {"response": response}
    else:
        # Chat with whole inbox
        emails = store.get_all_emails()
        # Construct a summary context
        inbox_summary = "Inbox Overview:\n"
        for email in emails:
            inbox_summary += f"- From: {email.sender}, Subject: {email.subject}, Category: {email.category or 'Uncategorized'}\n"
            if email.summary:
                inbox_summary += f"  Summary: {email.summary}\n"
            elif len(email.body) < 200:
                inbox_summary += f"  Body: {email.body}\n"
            else:
                inbox_summary += f"  Body Preview: {email.body[:200]}...\n"
        
        response = await chat_with_inbox(inbox_summary, request.query)
        return {"response": response}

@app.get("/drafts", response_model=List[Draft])
def get_drafts():
    return store.get_all_drafts()

@app.post("/drafts", response_model=Draft)
def create_draft(draft: Draft):
    store.save_draft(draft)
    return draft

@app.put("/drafts/{draft_id}", response_model=Draft)
def update_draft(draft_id: str, draft: Draft):
    if draft_id != draft.id:
        raise HTTPException(status_code=400, detail="Draft ID mismatch")
    store.save_draft(draft)
    return draft

@app.delete("/drafts/{draft_id}")
def delete_draft(draft_id: str):
    # Add delete method to store
    if store.drafts.get(draft_id):
        del store.drafts[draft_id]
        store.save_to_disk()
        return {"message": "Draft deleted"}
    raise HTTPException(status_code=404, detail="Draft not found")

@app.post("/drafts/generate")
async def generate_draft(request: GenerateDraftRequest):
    email = store.get_email(request.email_id)
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    
    draft_body = await generate_draft_reply(email.body, request.instructions)
    return {"draft_body": draft_body}
