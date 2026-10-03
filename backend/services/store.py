import json
import os
from typing import List, Dict
from models import Email, PromptConfig, Draft

PERSISTENCE_FILE = "persistence.json"

class Store:
    def __init__(self):
        self.emails: Dict[str, Email] = {}
        self.prompts: Dict[str, PromptConfig] = {}
        self.drafts: Dict[str, Draft] = {}

        # Try loading from disk first
        if not self.load_from_disk():
            # If no persistence file, initialize defaults
            self._init_default_prompts()

    def _init_default_prompts(self):
        defaults = [
            PromptConfig(
                id="categorize",
                name="Categorization",
                template="Categorize this email into one of: Important, To-Do, Newsletter, or Spam. Return only the category name.",
                system_template="""You are an email categorization expert. Analyze the email and classify it into EXACTLY ONE category.

Categories:
- Important: Urgent matters, executive communications, critical alerts, time-sensitive issues that need awareness but may not require immediate action from YOU
- To-Do: Emails that explicitly REQUEST ACTION from YOU - feedback needed, approval required, task assignment, meeting scheduling, form completion
- Newsletter: Marketing emails, promotional content, automated updates, subscriptions, weekly digests, informational bulletins
- Spam: Unwanted emails, phishing attempts, suspicious content, lottery scams, fake alerts

Key Distinction for To-Do:
- To-Do = "Please do X", "We need your Y", "Can you Z", "Action required from you"
- NOT To-Do = Status updates, FYI notifications, completed work reports, informational alerts

Rules:
1. Return ONLY the category name: Important, To-Do, Newsletter, or Spam
2. Do NOT include explanations, reasoning, or extra text
3. If email mentions work but doesn't ask YOU to do anything, it's NOT To-Do
4. JIRA/GitHub notifications about others' work = Important (unless they explicitly request your review)
5. Automated system alerts = Important
6. Marketing/promotional content = Newsletter or Spam

Your response must be a single word.""",
                description="Determines the category of an email."
            ),
            PromptConfig(
                id="action_items",
                name="Action Item Extraction",
                template="Extract actionable tasks from this email. Return a JSON list with 'task' and 'deadline' fields.",
                system_template="Extract tasks from the email. Return a JSON list of objects with 'task' and 'deadline' fields. If no tasks, return an empty list. Be precise and only extract items that require action from the recipient.",
                description="Extracts actionable tasks from email content."
            ),
            PromptConfig(
                id="auto_reply",
                name="Auto-Reply Draft",
                template="Draft a polite and professional reply to this email. If it is a meeting request, ask for an agenda. Keep it concise.",
                description="Generates a draft reply."
            )
        ]
        for p in defaults:
            self.prompts[p.id] = p
        self.save_to_disk()

    def load_from_disk(self) -> bool:
        if not os.path.exists(PERSISTENCE_FILE):
            return False
        try:
            with open(PERSISTENCE_FILE, "r") as f:
                data = json.load(f)
                self.emails = {k: Email(**v) for k, v in data.get("emails", {}).items()}
                self.prompts = {k: PromptConfig(**v) for k, v in data.get("prompts", {}).items()}
                self.drafts = {k: Draft(**v) for k, v in data.get("drafts", {}).items()}
            print(f"Loaded state from {PERSISTENCE_FILE}")
            return True
        except Exception as e:
            print(f"Error loading persistence file: {e}")
            return False

    def save_to_disk(self):
        data = {
            "emails": {k: v.dict() for k, v in self.emails.items()},
            "prompts": {k: v.dict() for k, v in self.prompts.items()},
            "drafts": {k: v.dict() for k, v in self.drafts.items()}
        }
        try:
            with open(PERSISTENCE_FILE, "w") as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Error saving persistence file: {e}")

    def add_email(self, email: Email):
        self.emails[email.id] = email
        self.save_to_disk()

    def get_all_emails(self) -> List[Email]:
        return list(self.emails.values())

    def get_email(self, email_id: str) -> Email:
        return self.emails.get(email_id)

    def update_email(self, email: Email):
        self.emails[email.id] = email
        self.save_to_disk()

    def get_prompt(self, prompt_id: str) -> PromptConfig:
        return self.prompts.get(prompt_id)
    
    def update_prompt(self, prompt: PromptConfig):
        self.prompts[prompt.id] = prompt
        self.save_to_disk()

    def get_all_prompts(self) -> List[PromptConfig]:
        return list(self.prompts.values())

    def save_draft(self, draft: Draft):
        self.drafts[draft.id] = draft
        self.save_to_disk()

    def get_all_drafts(self) -> List[Draft]:
        return list(self.drafts.values())

# Global store instance
store = Store()
