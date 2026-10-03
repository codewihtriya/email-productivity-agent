import json
import os
from typing import List
from models import Email
from services.store import store
from datetime import datetime
import threading
import time

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mock_inbox.json")

def load_mock_data():
    """Loads mock emails from JSON file into the store."""
    if not os.path.exists(DATA_PATH):
        print(f"Warning: Mock data file not found at {DATA_PATH}")
        return

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Clear existing emails before reloading
    store.emails.clear()
    
    for item in data:
        # Convert timestamp string to datetime object
        try:
            item['timestamp'] = datetime.fromisoformat(item['timestamp'].replace('Z', '+00:00'))
        except ValueError:
            pass # Keep as is or handle error
            
        email = Email(**item)
        store.add_email(email)
    
    print(f"Loaded {len(data)} emails into store.")

def watch_mock_data():
    """Watch the mock_inbox.json file and reload when it changes."""
    if not os.path.exists(DATA_PATH):
        return
    
    last_modified = os.path.getmtime(DATA_PATH)
    
    while True:
        time.sleep(2)  # Check every 2 seconds
        try:
            current_modified = os.path.getmtime(DATA_PATH)
            if current_modified != last_modified:
                print("📧 Detected changes in mock_inbox.json - reloading emails...")
                load_mock_data()
                last_modified = current_modified
        except Exception as e:
            print(f"Error watching file: {e}")

def start_file_watcher():
    """Start the file watcher in a background thread."""
    watcher_thread = threading.Thread(target=watch_mock_data, daemon=True)
    watcher_thread.start()
    print("🔄 File watcher started - mock_inbox.json will auto-reload on changes")
