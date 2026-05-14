import os
from flask_pymongo import PyMongo
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from dotenv import load_dotenv
from datetime import datetime, timezone

# Load environment variables
load_dotenv()

mongo = PyMongo()

def init_database(app):
    """Initializes MongoDB Atlas connection."""
    app.config["MONGO_URI"] = os.getenv("MONGO_URI")
    
    try:
        mongo.init_app(app)
        # Force a connection to verify
        mongo.db.command('ping')
        print("-------------------------------------------------")
        print("MongoDB Atlas Connected Successfully")
        print("-------------------------------------------------")
        
        # Initialize Collections
        create_collections(mongo.db)
        return True
    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        print("-------------------------------------------------")
        print(f"MongoDB Atlas Connection Failed: {e}")
        print("-------------------------------------------------")
        return False

def create_collections(db):
    """Ensures all required collections exist."""
    required_collections = [
        'students', 'wardens', 'admins', 'leave_requests', 
        'notifications', 'qr_passes', 'outing_requests',
        'hostels', 'hostel_rooms', 'activity_logs', 'settings',
        'failed_logins', 'login_locks'
    ]
    
    existing_collections = db.list_collection_names()
    for col in required_collections:
        if col not in existing_collections:
            db.create_collection(col)
            print(f"[INFO] Created collection: {col}")

    # Create Indexes
    db.students.create_index('email', unique=True)
    db.students.create_index('student_id', unique=True)
    db.wardens.create_index('email', unique=True)
    db.admins.create_index('email', unique=True)
    db.admins.create_index('username', unique=True)
    db.hostels.create_index('name', unique=True)
    
    # Security Indexes
    db.failed_logins.create_index('identifier', unique=True)
    db.login_locks.create_index('identifier', unique=True)
    db.login_locks.create_index('unlock_at', expireAfterSeconds=0)

    # Seed default settings if empty
    if db.settings.count_documents({}) == 0:
        db.settings.insert_one({
            'max_leave_duration': '14',
            'auto_approve_short_leaves': 'false',
            'email_notifications': 'true',
            'maintenance_mode': 'false',
            'updated_at': datetime.now(timezone.utc)
        })

def to_json(data):
    """Converts MongoDB document(s) to JSON-serializable dict/list."""
    if data is None:
        return None
    if isinstance(data, list):
        return [to_json(item) for item in data]
    
    # Convert _id to id string
    if '_id' in data:
        data['id'] = str(data.pop('_id'))
    
    # Handle datetimes
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
        elif isinstance(value, dict):
            data[key] = to_json(value)
        elif isinstance(value, list):
            data[key] = [to_json(i) if isinstance(i, dict) else i for i in value]
            
    return data

def get_user_by_email_or_username(identifier):
    """Searches for a user across all role collections."""
    student = mongo.db.students.find_one({'$or': [{'email': identifier}, {'student_id': identifier}]})
    if student: return student
    warden = mongo.db.wardens.find_one({'email': identifier})
    if warden: return warden
    admin = mongo.db.admins.find_one({'$or': [{'email': identifier}, {'username': identifier}]})
    return admin

def get_user_by_role_and_identifier(role, identifier):
    """Searches for a user strictly within their role collection."""
    if role == 'student':
        return mongo.db.students.find_one({'$or': [{'email': identifier}, {'student_id': identifier}]})
    elif role == 'warden':
        return mongo.db.wardens.find_one({'email': identifier})
    elif role == 'admin':
        return mongo.db.admins.find_one({'$or': [{'email': identifier}, {'username': identifier}]})
    return None

def get_user_by_email_with_collection(email):
    """Gets user and the collection they belong to."""
    student = mongo.db.students.find_one({'email': email})
    if student: return student, mongo.db.students
    warden = mongo.db.wardens.find_one({'email': email})
    if warden: return warden, mongo.db.wardens
    admin = mongo.db.admins.find_one({'email': email})
    if admin: return admin, mongo.db.admins
    return None, None

def get_user_by_id(user_id_str, role):
    """Gets a user by string ObjectId from the appropriate collection."""
    from bson.objectid import ObjectId
    try:
        obj_id = ObjectId(user_id_str)
        if role == 'student': return mongo.db.students.find_one({'_id': obj_id})
        if role == 'warden': return mongo.db.wardens.find_one({'_id': obj_id})
        if role == 'admin': return mongo.db.admins.find_one({'_id': obj_id})
    except:
        pass
    return None

