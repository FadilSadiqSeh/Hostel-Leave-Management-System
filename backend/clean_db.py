import os
from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

if not MONGO_URI:
    print("Error: MONGO_URI not found in .env file.")
    exit(1)

client = MongoClient(MONGO_URI)
db = client.get_database()

print("Connected to database:", db.name)

collections_to_clean = [
    'students', 'wardens', 'admins', 'leave_requests', 
    'notifications', 'qr_passes', 'outing_requests',
    'hostels', 'hostel_rooms', 'activity_logs', 'settings'
]

for col in collections_to_clean:
    print(f"Cleaning collection: {col}...")
    db[col].delete_many({})
    print(f"Collection {col} cleaned.")

print("\nAll dummy data removed.")

# Create the official admin account
admin_email = "bgsbuhosteladmin@gmail.com"
admin_password = "AdminHostal@12345"

admin_doc = {
    "username": "bgsbuadmin",
    "email": admin_email,
    "password_hash": generate_password_hash(admin_password),
    "role": "admin",
    "full_name": "System Administrator",
    "is_verified": True,
    "created_at": datetime.utcnow()
}

db.admins.insert_one(admin_doc)
print(f"\nOfficial admin account created:\nEmail: {admin_email}\nRole: Admin")

# Re-initialize default settings
db.settings.insert_one({
    'max_leave_duration': '14',
    'auto_approve_short_leaves': 'false',
    'email_notifications': 'true',
    'maintenance_mode': 'false',
    'updated_at': datetime.utcnow()
})
print("Default settings re-initialized.")

print("\nDatabase cleanup and setup complete.")
