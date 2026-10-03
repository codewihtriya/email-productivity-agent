import os
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser, JsonOutputParser, PydanticOutputParser
from typing import Dict, Any, List
import json
from models import ActionItemList

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables.")

# Initialize OpenAI Model
llm = ChatOpenAI(model="gpt-4o", openai_api_key=OPENAI_API_KEY, temperature=0)

async def process_email_with_prompt(email_content: str, prompt_template: str, output_json: bool = False, system_template: str = None) -> Any:
    """
    Process an email using a specific prompt template.
    Combines system_template (formatting rules) with user template (categorization logic).
    """
    # Combine both templates: system rules + user logic
    if system_template:
        # Use system template for formatting rules, append user template for custom logic
        actual_template = system_template + "\n\nAdditional Instructions:\n" + prompt_template
    else:
        actual_template = prompt_template
    
    prompt = ChatPromptTemplate.from_template(actual_template + "\n\nEmail Content:\n{email_content}")
    
    if output_json:
        parser = PydanticOutputParser(pydantic_object=ActionItemList)
        # Append format instructions to prompt
        prompt = ChatPromptTemplate.from_template(prompt_template + "\n\n{format_instructions}\n\nEmail Content:\n{email_content}")
        chain = prompt | llm | parser
        input_data = {"email_content": email_content, "format_instructions": parser.get_format_instructions()}
    else:
        chain = prompt | llm | StrOutputParser()
        input_data = {"email_content": email_content}
    
    try:
        result = await chain.ainvoke(input_data)
        if output_json and isinstance(result, ActionItemList):
             return [item.dict() for item in result.items]
        return result
    except Exception as e:
        print(f"Error processing email: {e}")
        return None

async def chat_with_inbox(inbox_summary: str, user_query: str) -> str:
    """
    Chat with the entire inbox context.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful email assistant. Answer the user's question based on the following inbox summary."),
        ("user", "Inbox Summary:\n{inbox_summary}\n\nQuestion: {user_query}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        return await chain.ainvoke({"inbox_summary": inbox_summary, "user_query": user_query})
    except Exception as e:
        return f"Error: {str(e)}"

async def chat_with_email(email_content: str, user_query: str) -> str:
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful email assistant. Answer the user's question based on the following email content."),
        ("user", "Email Content:\n{email_content}\n\nQuestion: {user_query}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        return await chain.ainvoke({"email_content": email_content, "user_query": user_query})
    except Exception as e:
        return f"Error: {str(e)}"

async def generate_draft_reply(email_content: str, instructions: str = None) -> str:
    """
    Generate a draft reply for an email.
    """
    if not instructions:
        instructions = "Draft a polite and professional reply to this email. Keep it concise."
        
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful email assistant. Your goal is to draft email replies."),
        ("user", "Email Content:\n{email_content}\n\nInstructions: {instructions}\n\nDraft Reply:")
    ])
    
    chain = prompt | llm | StrOutputParser()
    
    try:
        return await chain.ainvoke({"email_content": email_content, "instructions": instructions})
    except Exception as e:
        return f"Error generating draft: {str(e)}"
