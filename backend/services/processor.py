from typing import List
from services.store import store
from services.llm_engine import process_email_with_prompt
from models import Email

async def process_inbox():
    """
    Iterates through all emails in the store and processes them if they haven't been processed.
    """
    emails = store.get_all_emails()
    prompts = store.get_all_prompts()
    
    categorize_prompt = next((p for p in prompts if p.id == "categorize"), None)
    action_prompt = next((p for p in prompts if p.id == "action_items"), None)
    
    if not categorize_prompt or not action_prompt:
        print("Error: Default prompts not found.")
        return

    # Clear existing categories and action items to force re-processing
    print("Clearing existing categories and action items...")
    for email in emails:
        email.category = None
        email.action_items = []
    
    for email in emails:
        try:
            print(f"Processing email: {email.id}")
            
            # Categorize
            category = await process_email_with_prompt(
                email.body, 
                categorize_prompt.template, 
                output_json=False,
                system_template=categorize_prompt.system_template
            )
            if category:
                # Use the LLM response directly without validation
                email.category = category.strip()
                
            # Extract action items ONLY for To-Do and Important emails
            if email.category in ["To-Do", "Important"]:
                action_items = await process_email_with_prompt(
                    email.body, 
                    action_prompt.template, 
                    output_json=True,
                    system_template=action_prompt.system_template
                )
                if action_items:
                    if isinstance(action_items, list) and len(action_items) > 0:
                        email.action_items = action_items
                    else:
                        email.action_items = []
            else:
                # For Newsletter and Spam, no action items
                email.action_items = []
            
            store.update_email(email)
            print(f"Finished processing {email.id}: category={email.category}")
        except Exception as e:
            print(f"Error processing email {email.id}: {e}")

async def process_single_email(email_id: str):
    """Process a single email by ID."""
    email = store.get_email(email_id)
    if not email:
        return
        
    prompts = store.get_all_prompts()
    categorize_prompt = next((p for p in prompts if p.id == "categorize"), None)
    action_prompt = next((p for p in prompts if p.id == "action_items"), None)
    
    if categorize_prompt:
        category = await process_email_with_prompt(
            email.body, 
            categorize_prompt.template, 
            output_json=False,
            system_template=categorize_prompt.system_template
        )
        if category:
            # Use the LLM response directly without validation
            email.category = category.strip()

    # Extract action items ONLY for To-Do and Important emails
    if email.category in ["To-Do", "Important"]:
        if action_prompt:
            action_items = await process_email_with_prompt(
                email.body, 
                action_prompt.template, 
                output_json=True,
                system_template=action_prompt.system_template
            )
            if action_items:
                if isinstance(action_items, list) and len(action_items) > 0:
                    email.action_items = action_items
                else:
                    email.action_items = []
    else:
        # For Newsletter and Spam, no action items
        email.action_items = []

    store.update_email(email)
