import os
import re
import secrets
import threading
import traceback
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory, render_template, url_for
from flask_cors import CORS
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
from bson.objectid import ObjectId


from database import mongo, init_database, to_json, get_user_by_email_or_username, get_user_by_email_with_collection, get_user_by_id, get_user_by_role_and_identifier
from flask import redirect

load_dotenv()

app = Flask(
    __name__,
    template_folder='../frontend',
    static_folder='../frontend',
    static_url_path='')

@app.route('/api/test-db', methods=['GET'])
def test_db():
    try:
        mongo.db.command('ping')
        return jsonify({"status": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config.update(
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=os.getenv('FLASK_ENV') == 'production', 
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_PATH='/',
    PERMANENT_SESSION_LIFETIME=timedelta(hours=2),
    SESSION_REFRESH_EACH_REQUEST=True
)

CORS(app, supports_credentials=True, origins=os.getenv("CORS_ORIGINS", "*").split(","))
app.url_map.strict_slashes = False

# Mail Configuration
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

mail = Mail(app)

# ========================= CSRF PROTECTION =========================
@app.after_request
def set_csrf_cookie(response):
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(16)
    response.set_cookie('csrf_token', session['csrf_token'], samesite='Lax', secure=app.config['SESSION_COOKIE_SECURE'])
    return response

@app.before_request
def check_csrf():
    if request.method in ['POST', 'PUT', 'DELETE']:
        if request.path.startswith('/api/'):
            # Allow login and public APIs without CSRF
            if request.path in ['/api/login', '/api/register', '/api/verify-otp', '/api/forgot-password', '/api/resend-otp']:
                return
                
            token_in_header = request.headers.get('X-CSRF-Token')
            token_in_session = session.get('csrf_token')
            
            if not token_in_header or token_in_header != token_in_session:
                return jsonify({'error': 'CSRF token missing or invalid'}), 400

def send_async_email(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            print(f"[ERROR] Async Mail Send Failed: {e}")

def send_email_in_background(msg):
    thread = threading.Thread(target=send_async_email, args=(app, msg))
    thread.start()

# ========================= HELPERS & DECORATORS =========================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            if request.path.startswith('/api/'):
                return jsonify({'error': 'Authentication required. Please login again.'}), 401
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'role' not in session or session['role'] not in roles:
                if request.path.startswith('/api/'):
                    return jsonify({'error': 'Access Denied: Unauthorized role'}), 403
                return render_template('403.html'), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def check_brute_force(identifier):
    """Check if the account is currently locked."""
    lock = mongo.db.login_locks.find_one({'identifier': identifier})
    if lock:
        if datetime.now(timezone.utc) < lock['unlock_at']:
            remaining = (lock['unlock_at'] - datetime.now(timezone.utc)).seconds // 60
            return True, f"Account locked. Try again in {remaining} minutes."
        else:
            mongo.db.login_locks.delete_one({'identifier': identifier})
    return False, None

def record_failed_login(identifier):
    """Increment failed attempts and lock if necessary."""
    res = mongo.db.failed_logins.find_one_and_update(
        {'identifier': identifier},
        {'$inc': {'attempts': 1}, '$set': {'last_attempt': datetime.now(timezone.utc)}},
        upsert=True,
        return_document=True
    )
    if res['attempts'] >= 5:
        mongo.db.login_locks.update_one(
            {'identifier': identifier},
            {'$set': {'unlock_at': datetime.now(timezone.utc) + timedelta(minutes=15)}},
            upsert=True
        )
        mongo.db.failed_logins.delete_one({'identifier': identifier})
        return True
    return False

def reset_failed_logins(identifier):
    mongo.db.failed_logins.delete_one({'identifier': identifier})
    mongo.db.login_locks.delete_one({'identifier': identifier})

@app.errorhandler(403)
def forbidden(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': '403 Forbidden'}), 403
    return render_template('403.html'), 403

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': '404 Not Found'}), 404
    return render_template('404.html'), 404

@app.errorhandler(500)
def server_error(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': '500 Internal Server Error'}), 500
    return render_template('500.html'), 500

def log_activity(user_id, action, details=None):
    try:
        mongo.db.activity_logs.insert_one({

            'user_id': user_id,
            'action': action,
            'details': details,
            'timestamp': datetime.now(timezone.utc)
        })
    except Exception as e:
        print(f"[ERROR] Failed to log activity: {e}")

# ========================= AUTH API =========================

@app.route('/api/register', methods=['POST'])
def register():
    data = sanitize_data(request.get_json())
    if not data or not all(k in data for k in ('name', 'email', 'password', 'role')):
        return jsonify({'error': 'Missing required fields'}), 400

    role = data.get('role')
    if role not in ('student', 'warden'):
        return jsonify({'error': 'Unauthorized: Invalid registration role'}), 403
    email = data.get('email', '').lower()
    if not email or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    if get_user_by_email_or_username(email):
        return jsonify({'error': 'Account with this email already exists'}), 400

    # Create user document
    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    user_doc = {
        'full_name': data['name'],
        'email': email,
        'password_hash': generate_password_hash(data['password']),
        'role': role,
        'is_verified': False,
        'otp': otp,
        'otp_expiry': otp_expiry,
        'is_active': True,
        'created_at': datetime.now(timezone.utc)
    }

    if role == 'student':
        hostel_name = data.get('hostelId')
        # Try to find hostel name if hostelId is an ObjectId
        if ObjectId.is_valid(hostel_name):
            h = mongo.db.hostels.find_one({'_id': ObjectId(hostel_name)})
            if h: hostel_name = h['name']
            
        user_doc.update({
            'student_id': data.get('studentId'),
            'department': data.get('department'),
            'course': data.get('course'),
            'hostel_name': hostel_name,
            'room_number': data.get('roomNumber'),
            'parent_phone': data.get('parentPhone'),
            'status': 'active'
        })
        collection = mongo.db.students
    elif role == 'warden':
        hostel_name = data.get('hostelId')
        if ObjectId.is_valid(hostel_name):
            h = mongo.db.hostels.find_one({'_id': ObjectId(hostel_name)})
            if h: hostel_name = h['name']
            
        user_doc.update({
            'hostel_assigned': hostel_name,
            'phone': data.get('phone')
        })
        collection = mongo.db.wardens
    else:
        collection = mongo.db.admins

    try:
        collection.insert_one(user_doc)
        

        
        # Send OTP Email
        try:
            # User Verification Email
            msg = Message("Verify your Email - BGSBU Hostel Leave System", recipients=[email])
            msg.body = f"Hello {data['name']},\n\nYour verification OTP is: {otp}. It expires in 10 minutes."
            send_email_in_background(msg)
            
            # Admin Notification Email
            admin_msg = Message(f"New {role.capitalize()} Registration Alert", recipients=["bgsbuhosteladmin@gmail.com"])
            admin_msg.body = f"A new {role} has registered on the portal.\n\nName: {data['name']}\nEmail: {email}\nRole: {role.capitalize()}\n\nPlease log in to the admin dashboard to manage this account."
            send_email_in_background(admin_msg)
            
        except Exception as e:
            print(f"[ERROR] Mail queueing failed: {e}")
            
        return jsonify({'message': 'Registration successful. OTP sent to your email.'}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/forgot-password', methods=['POST'])
def forgot_password():
    try:
        data = sanitize_data(request.get_json())
        email = data.get('email', '').lower()
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        user, collection = get_user_by_email_with_collection(email)
        if not user:
            return jsonify({'error': 'No account found with this email'}), 404
            
        otp = "".join(secrets.choice("0123456789") for _ in range(6))
        otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        collection.update_one({'_id': user['_id']}, {'$set': {'otp': otp, 'otp_expiry': otp_expiry}})
        
        try:
            msg = Message("Reset your Password - BGSBU Hostel Leave System", recipients=[email])
            msg.body = f"Hello {user['full_name']},\n\nYour password reset OTP is: {otp}. It expires in 10 minutes.\n\nIf you did not request this, please ignore this email."
            send_email_in_background(msg)
            print(f"[AUTH] Forgot password OTP sent to {email}: {otp}")
            return jsonify({'message': 'OTP sent to your email'}), 200
        except Exception as e:
            print(f"[ERROR] Forgot password mail queueing failed for {email}: {e}")
            return jsonify({'error': 'Failed to send reset email'}), 500
            
    except Exception as e:
        print(f"[ERROR] Forgot password failed: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/reset-password', methods=['POST'])
def reset_password():
    try:
        data = sanitize_data(request.get_json())
        email = data.get('email', '').lower()
        otp = data.get('otp')
        new_password = data.get('password')
        
        if not all([email, otp, new_password]):
            return jsonify({'error': 'Missing required fields'}), 400
            
        user, collection = get_user_by_email_with_collection(email)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        stored_otp = user.get('otp')
        expiry = user.get('otp_expiry')
        now = datetime.now(timezone.utc)
        
        print(f"[DEBUG] Reset Password Attempt - Email: {email}")
        print(f"[DEBUG] Received OTP: {otp}, Stored OTP: {stored_otp}")
        
        if not stored_otp or stored_otp != otp:
            print(f"[AUTH] Invalid reset code for {email}")
            return jsonify({'error': 'Invalid reset code'}), 400
            
        if expiry:
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            if expiry < now:
                print(f"[AUTH] Expired reset code for {email}. Expiry: {expiry}, Now: {now}")
                return jsonify({'error': 'Reset code has expired'}), 400
            
        # Update password
        hashed_password = generate_password_hash(new_password)
        collection.update_one({'_id': user['_id']}, {
            '$set': {
                'password_hash': hashed_password,
                'is_verified': True, # Mark as verified if they reset password
                'updated_at': now
            },
            '$unset': {'otp': "", 'otp_expiry': ""}
        })
        
        log_activity(str(user['_id']), 'reset_password', 'Password reset via email')
        return jsonify({'message': 'Password reset successfully'}), 200
        
    except Exception as e:
        print(f"[ERROR] Reset password failed: {e}")
        return jsonify({'error': 'Internal server error during reset'}), 500

@app.route('/api/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json()
    email = data.get('email', '').lower()
    
    user, collection = get_user_by_email_with_collection(email)
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    otp_expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    collection.update_one({'_id': user['_id']}, {'$set': {'otp': otp, 'otp_expiry': otp_expiry}})
    
    try:
        msg = Message("Your New OTP - BGSBU Hostel Leave System", recipients=[email])
        msg.body = f"Hello {user['full_name']},\n\nYour new verification OTP is: {otp}. It expires in 10 minutes."
        send_email_in_background(msg)
        print(f"[AUTH] Resend OTP to {email}: {otp}")
        return jsonify({'message': 'New OTP sent'}), 200
    except Exception as e:
        print(f"[ERROR] Resend OTP mail failed for {email}: {e}")
        return jsonify({'error': 'Failed to send email'}), 500

@app.route('/api/verify-otp', methods=['POST'])
def verify_otp():
    try:
        data = request.get_json()
        email = data.get('email', '').lower()
        otp = data.get('otp')
        
        print(f"[DEBUG] Verify OTP Attempt - Email: {email}, OTP: {otp}")
        
        user, collection = get_user_by_email_with_collection(email)
        if not user:
            print(f"[AUTH] Verify OTP failed: User {email} not found")
            return jsonify({'error': 'User not found'}), 404
            
        stored_otp = user.get('otp')
        expiry = user.get('otp_expiry')
        now = datetime.now(timezone.utc)
        
        print(f"[DEBUG] Stored OTP: {stored_otp}, Expiry: {expiry}")
        
        if not stored_otp or stored_otp != str(otp):
            print(f"[AUTH] Invalid OTP for {email}. Expected: {stored_otp}, Got: {otp}")
            return jsonify({'error': 'Invalid or expired OTP'}), 400
            
        if expiry:
            # Ensure expiry is offset-aware for comparison
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            
            if expiry < now:
                print(f"[AUTH] OTP expired for {email}. Expiry: {expiry}, Now: {now}")
                return jsonify({'error': 'Invalid or expired OTP'}), 400
        
        # Success
        collection.update_one({'_id': user['_id']}, {'$set': {'is_verified': True}, '$unset': {'otp': "", 'otp_expiry': ""}})
        print(f"[AUTH] Email verified successfully for {email}")
        return jsonify({'message': 'Email verified successfully'}), 200
        
    except Exception as e:
        print(f"[ERROR] Verify OTP Exception: {e}")
        traceback.print_exc()
        return jsonify({'error': 'Internal server error during verification'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('username', '').lower() # Can be email or student_id
    password = data.get('password')
    role = data.get('role')
    
    if not role:
        return jsonify({'error': 'Role must be specified'}), 400
        
    # Brute force check
    is_locked, lock_msg = check_brute_force(identifier)
    if is_locked:
        return jsonify({'error': lock_msg}), 429
        
    user = get_user_by_role_and_identifier(role, identifier)
    if not user or not check_password_hash(user['password_hash'], password):
        record_failed_login(identifier)
        return jsonify({'error': 'Invalid credentials'}), 401
        
    reset_failed_logins(identifier)
        
    if not user.get('is_verified', False):
        return jsonify({'error': 'Email not verified'}), 403

    session.permanent = True
    session['user_id'] = str(user['_id'])
    session['role'] = user['role']
    session['user_name'] = user['full_name']
    
    log_activity(str(user['_id']), 'login')
    
    return jsonify({
        'message': 'Login successful',
        'user': {
            'id': str(user['_id']),
            'name': user['full_name'],
            'email': user['email'],
            'role': user['role']
        }
    }), 200

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'}), 200

@app.route('/api/verify-session', methods=['GET'])
def verify_session():
    if 'user_id' in session:
        return jsonify({
            'logged_in': True,
            'user_id': session['user_id'],
            'role': session.get('role')
        }), 200
    return jsonify({'logged_in': False}), 401

# ========================= PROFILE API =========================

@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    user = get_user_by_id(session['user_id'], session['role'])
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    res = {
        'id': str(user['_id']),
        'name': user['full_name'],
        'email': user['email'],
        'role': user['role']
    }
    
    if user['role'] == 'student':
        res.update({
            'student_id': user.get('student_id'),
            'hostel': user.get('hostel_name'),
            'room_number': user.get('room_number'),
            'department': user.get('department'),
            'parent_phone': user.get('parent_phone')
        })
    elif user['role'] == 'warden':
        res.update({
            'hostel': user.get('hostel_assigned'),
            'phone': user.get('phone')
        })
        
    return jsonify(res), 200

def sanitize_data(data):
    """Basic sanitization for string fields in JSON data."""
    if isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    if isinstance(data, list):
        return [sanitize_data(v) for v in data]
    if isinstance(data, str):
        # Prevent basic HTML injection
        return data.replace('<', '&lt;').replace('>', '&gt;')
    return data

# ========================= LEAVE REQUESTS API =========================

@app.route('/api/leave-requests', methods=['GET', 'POST'])
@login_required
def handle_leave_requests():
    if request.method == 'POST':
        if session['role'] != 'student':
            return jsonify({'error': 'Unauthorized: Only students can apply for leave'}), 403
            
        data = sanitize_data(request.get_json())
        student = get_user_by_id(session['user_id'], 'student')
        if not student:
            return jsonify({'error': 'Student record not found'}), 404
        
        # Validation
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        reason = data.get('reason')
        
        if not start_date or not end_date or not reason:
            return jsonify({'error': 'Missing required fields'}), 400
            
        leave_doc = {
            'student_id': session['user_id'],
            'student_name': student['full_name'],
            'student_meta': {
                'id': student['student_id'],
                'hostel': student['hostel_name'],
                'room': student['room_number'],
                'department': student.get('department', 'N/A'),
                'course': student.get('course', 'N/A'),
                'parent_phone': student['parent_phone']
            },
            'start_date': start_date,
            'end_date': end_date,
            'reason': reason,
            'emergency_contact': data.get('emergency_contact'),
            'status': 'pending',
            'submitted_at': datetime.now(timezone.utc),
            'is_deleted': False
        }
        
        mongo.db.leave_requests.insert_one(leave_doc)
        log_activity(session['user_id'], 'apply_leave', f"For {start_date} to {end_date}")
        return jsonify({'message': 'Leave request submitted successfully'}), 201

    # GET requests
    visibility = request.args.get('visibility', 'active')
    query = {'is_deleted': (visibility == 'hidden')}
    
    if session['role'] == 'student':
        query['student_id'] = session['user_id']
    elif session['role'] == 'warden':
        warden = get_user_by_id(session['user_id'], 'warden')
        query['student_meta.hostel'] = warden.get('hostel_assigned')
    elif session['role'] == 'admin':
        pass # Admin sees all
    
    # 6-month filter for history if requested
    if request.args.get('filter') == '6months':
        six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
        query['submitted_at'] = {'$gte': six_months_ago}
        
    leaves = list(mongo.db.leave_requests.find(query).sort('submitted_at', -1))
    
    res = []
    for l in leaves:
        res.append({
            'id': str(l['_id']),
            'student': {
                'name': l['student_name'],
                'student_id': l['student_meta']['id'],
                'hostel': l['student_meta']['hostel'],
                'department': l['student_meta'].get('department', '—'),
                'course': l['student_meta'].get('course', '—'),
                'room_number': l['student_meta']['room'],
                'parent_phone': l['student_meta']['parent_phone']
            },
            'start_date': l['start_date'],
            'end_date': l['end_date'],
            'reason': l['reason'],
            'status': l['status'],
            'submitted_at': l['submitted_at'].isoformat(),
            'remarks': l.get('remarks', ''),
            'reviewer': l.get('reviewer_name', ''),
            'reviewed_at': l.get('reviewed_at').isoformat() if l.get('reviewed_at') else None
        })
        
    return jsonify(res), 200

@app.route('/api/leave-requests/<string:request_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def handle_single_leave(request_id):
    try: obj_id = ObjectId(request_id)
    except: return jsonify({'error': 'Invalid request ID'}), 400
        
    leave = mongo.db.leave_requests.find_one({'_id': obj_id})
    if not leave:
        return jsonify({'error': 'Leave request not found'}), 404
        
    if request.method == 'PUT':
        if session['role'] not in ('warden', 'admin'):
            return jsonify({'error': 'Permission denied'}), 403
            
        data = sanitize_data(request.get_json())
        action = data.get('action') # approve/reject
        remarks = data.get('remarks', '')
        
        if action not in ('approve', 'reject'):
            return jsonify({'error': 'Invalid action'}), 400
            
        status = 'approved' if action == 'approve' else 'rejected'
        mongo.db.leave_requests.update_one(
            {'_id': obj_id},
            {'$set': {
                'status': status,
                'remarks': remarks,
                'reviewed_at': datetime.now(timezone.utc),
                'reviewer_id': session['user_id'],
                'reviewer_name': session['user_name'] if 'user_name' in session else session['role'].capitalize()
            }}
        )
        log_activity(session['user_id'], f'{action}_leave', f"ID: {request_id}")
        return jsonify({'message': f'Leave request {status}'}), 200

    if request.method == 'DELETE':
        # Check ownership
        if session['role'] == 'student' and leave['student_id'] != session['user_id']:
            return jsonify({'error': 'Access Denied: Not your record'}), 403
            
        # Soft delete
        mongo.db.leave_requests.update_one({'_id': obj_id}, {'$set': {'is_deleted': True}})
        log_activity(session['user_id'], 'delete_leave', f"ID: {request_id}")
        return jsonify({'message': 'Leave request moved to trash'}), 200

    return jsonify(to_json(leave)), 200

@app.route('/api/leave-requests/<string:request_id>/restore', methods=['PUT'])
@login_required
@role_required(['warden', 'admin'])
def restore_leave(request_id):
    try: obj_id = ObjectId(request_id)
    except: return jsonify({'error': 'Invalid ID'}), 400
    mongo.db.leave_requests.update_one({'_id': obj_id}, {'$set': {'is_deleted': False}})
    return jsonify({'message': 'Leave request restored'}), 200

@app.route('/api/leave-requests/bulk', methods=['DELETE'])
@login_required
@role_required(['admin'])
def bulk_delete_leaves():
    data = request.get_json()
    try:
        ids = [ObjectId(i) for i in data.get('request_ids', [])]
        mongo.db.leave_requests.delete_many({'_id': {'$in': ids}})
        return jsonify({'message': f'{len(ids)} records permanently deleted'}), 200
    except:
        return jsonify({'error': 'Invalid IDs provided'}), 400

@app.route('/api/leave-requests/bulk-approve', methods=['PUT'])
@login_required
@role_required(['warden', 'admin'])
def bulk_approve_leaves():
    data = request.get_json()
    ids = [ObjectId(i) for i in data.get('request_ids', [])]
    mongo.db.leave_requests.update_many(
        {'_id': {'$in': ids}},
        {'$set': {
            'status': 'approved',
            'reviewed_at': datetime.now(timezone.utc),
            'reviewer_id': session['user_id'],
            'reviewer_name': session['user_name'] if 'user_name' in session else session['role'].capitalize()
        }}
    )
    return jsonify({'message': f'{len(ids)} requests approved'}), 200

@app.route('/api/leave-requests/active', methods=['GET'])
@login_required
def get_active_leaves():
    # Students currently on leave (approved and today is between start and end)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    query = {
        'status': 'approved',
        'is_deleted': False,
        'start_date': {'$lte': today},
        'end_date': {'$gte': today}
    }
    
    if session['role'] == 'warden':
        warden = get_user_by_id(session['user_id'], 'warden')
        query['student_meta.hostel'] = warden.get('hostel_assigned')
        
    leaves = list(mongo.db.leave_requests.find(query))
    res = []
    for l in leaves:
        res.append({
            'student_name': l.get('student_name', 'Unknown'),
            'student_email': l.get('student_email', 'N/A'),
            'student_id': l.get('student_id', 'N/A'),
            'enrollment': l.get('student_meta', {}).get('id', 'N/A'),
            'room_number': l.get('student_meta', {}).get('room', 'N/A'),
            'department': l.get('student_meta', {}).get('department', 'N/A'),
            'course': l.get('student_meta', {}).get('course', 'N/A'),
            'hostel': l.get('student_meta', {}).get('hostel', 'N/A'),
            'end_date': l.get('end_date'),
            'parent_contact': l.get('student_meta', {}).get('parent_phone', 'N/A'),
            'student_phone': l.get('student_meta', {}).get('phone', 'N/A')
        })
    return jsonify(res), 200

# ========================= ADMIN / MANAGEMENT API =========================

@app.route('/api/public-stats', methods=['GET'])
def get_public_stats():
    # Publicly accessible stats for landing page
    return jsonify({
        'total_students': mongo.db.students.count_documents({'is_active': True}),
        'total_hostels': mongo.db.hostels.count_documents({}),
        'total_leaves': mongo.db.leave_requests.count_documents({'status': 'approved'}),
        'total_wardens': mongo.db.wardens.count_documents({})
    }), 200

@app.route('/api/contact-settings', methods=['GET', 'PUT'])
def handle_contact_settings():
    collection = mongo.db.contactSettings
    
    # Initialize if empty
    if collection.count_documents({}) == 0:
        collection.insert_one({
            'aboutText': 'The Hostel Leave Management System is a modern digital platform designed for Baba Ghulam Shah Badshah University. It simplifies the entire leave application process, enabling students to apply online while providing wardens and administrators with powerful tools to manage and track requests digitally.',
            'contacts': [
                {
                    'id': 1,
                    'hostelName': 'APJ Hostel',
                    'wardenName': 'Rukhsana Ma’am',
                    'phone': '6006451724',
                    'email': 'abc@gmail.com'
                }
            ]
        })

    if request.method == 'GET':
        settings = collection.find_one({}, {'_id': 0})
        return jsonify(settings), 200

    if request.method == 'PUT':
        if 'user_id' not in session or session.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized: Admin only'}), 403
            
        raw_data = request.get_json()
        if not raw_data:
            return jsonify({'error': 'No data provided'}), 400
            
        data = sanitize_data(raw_data)
        contacts = data.get('contacts', [])
        about_text = data.get('aboutText')

        if not about_text:
            return jsonify({'error': 'About Us Content is required'}), 400

        if not isinstance(contacts, list):
            return jsonify({'error': 'Contacts must be a list'}), 400

        # Validation for each contact
        for i, c in enumerate(contacts):
            h_name = c.get('hostelName')
            w_name = c.get('wardenName')
            phone = c.get('phone')
            email = c.get('email')
            
            if not all([h_name, w_name, phone, email]):
                return jsonify({'error': f'All fields are required in contact entry #{i+1}'}), 400
            
            if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
                return jsonify({'error': f'Invalid email format for {h_name or "entry " + str(i+1)}'}), 400
                
            if not re.match(r"^\d{10}$", phone):
                return jsonify({'error': f'Phone must be 10 digits for {h_name or "entry " + str(i+1)}'}), 400

        collection.update_one({}, {'$set': {
            'contacts': contacts,
            'aboutText': about_text,
            'updated_at': datetime.now(timezone.utc)
        }})
        return jsonify({'message': 'Contact settings updated successfully'}), 200

@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    res = {}
    if session['role'] == 'admin':
        res['total_students'] = mongo.db.students.count_documents({})
        res['total_wardens'] = mongo.db.wardens.count_documents({})
        res['total_hostels'] = mongo.db.hostels.count_documents({})
    elif session['role'] == 'warden':
        warden = get_user_by_id(session['user_id'], 'warden')
        hostel = warden.get('hostel_assigned')
        res['hostel_students'] = mongo.db.students.count_documents({'hostel_name': hostel})
        res['pending_requests'] = mongo.db.leave_requests.count_documents({
            'student_meta.hostel': hostel, 'status': 'pending', 'is_deleted': False
        })
        res['approved_today'] = mongo.db.leave_requests.count_documents({
            'student_meta.hostel': hostel, 'status': 'approved', 
            'reviewed_at': {'$gte': datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)}
        })
        res['hostel_requests'] = mongo.db.leave_requests.count_documents({
            'student_meta.hostel': hostel, 'is_deleted': False
        })
    return jsonify(res), 200

@app.route('/api/warden/stats', methods=['GET'])
@login_required
@role_required(['warden', 'admin'])
def get_warden_stats():
    warden = get_user_by_id(session['user_id'], session['role'])
    hostel = warden.get('hostel_assigned') or warden.get('hostel_name') # admin fallback
    
    stats = {
        'total_students': mongo.db.students.count_documents({'hostel_name': hostel}),
        'pending_requests': mongo.db.leave_requests.count_documents({
            'student_meta.hostel': hostel, 'status': 'pending', 'is_deleted': False
        }),
        'active_leaves': mongo.db.leave_requests.count_documents({
            'student_meta.hostel': hostel, 'status': 'approved',
            'start_date': {'$lte': datetime.now(timezone.utc).strftime('%Y-%m-%d')},
            'end_date': {'$gte': datetime.now(timezone.utc).strftime('%Y-%m-%d')}
        }),
        'hostel_name': hostel
    }
    return jsonify(stats), 200

@app.route('/api/leave-analytics', methods=['GET'])
@login_required
def get_leave_analytics():
    """
    Returns leave counts + total days for students over a given period.
    Query params:
      - months: int (1-6), default 1
      - q: optional name/ID search string (admin/warden only)
      - student_db_id: optional specific student mongo ID (admin/warden only)
    """
    try:
        months = min(max(int(request.args.get('months', 1)), 1), 6)
        q = request.args.get('q', '').strip().lower()
        student_db_id = request.args.get('student_db_id', '').strip()

        from_dt = datetime.now(timezone.utc) - timedelta(days=months * 30)
        from_date_str = from_dt.strftime('%Y-%m-%d')
        to_date_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        # Build leave query
        leave_query = {
            'is_deleted': False,
            'status': 'approved',
            '$or': [
                {'start_date': {'$gte': from_date_str}},
                {'end_date': {'$gte': from_date_str}}
            ]
        }

        role = session['role']

        if role == 'student':
            # Students only see their own data
            leave_query['student_id'] = session['user_id']
        elif role == 'warden':
            warden = get_user_by_id(session['user_id'], 'warden')
            leave_query['student_meta.hostel'] = warden.get('hostel_assigned')
            if student_db_id:
                leave_query['student_id'] = student_db_id
        elif role == 'admin':
            if student_db_id:
                leave_query['student_id'] = student_db_id

        leaves = list(mongo.db.leave_requests.find(leave_query).sort('start_date', 1))

        # Group leaves by student_id
        from collections import defaultdict
        student_map = defaultdict(lambda: {
            'name': '', 'student_id': '', 'hostel': '', 'department': '',
            'course': '', 'room_number': '', 'total_leaves': 0, 'total_days': 0, 'leaves': []
        })

        for lv in leaves:
            sid = lv['student_id']
            entry = student_map[sid]
            entry['name'] = lv.get('student_name', 'Unknown')
            sm = lv.get('student_meta', {})
            entry['student_id'] = sm.get('id', '—')
            entry['hostel'] = sm.get('hostel', '—')
            entry['department'] = sm.get('department', '—')
            entry['course'] = sm.get('course', '—')
            entry['room_number'] = sm.get('room', '—')

            # Calculate days in period
            try:
                start = datetime.strptime(max(lv['start_date'], from_date_str), '%Y-%m-%d')
                end = datetime.strptime(min(lv['end_date'], to_date_str), '%Y-%m-%d')
                days = max((end - start).days + 1, 1)
            except Exception:
                days = 1

            entry['total_leaves'] += 1
            entry['total_days'] += days
            entry['leaves'].append({
                'start_date': lv.get('start_date'),
                'end_date': lv.get('end_date'),
                'reason': lv.get('reason', ''),
                'status': lv.get('status'),
                'days': days,
                'remarks': lv.get('remarks', '')
            })

        # Convert to list and apply search filter
        results = list(student_map.values())

        if q:
            results = [r for r in results if q in r['name'].lower() or q in r['student_id'].lower()]

        # Sort by total days descending
        results.sort(key=lambda x: x['total_days'], reverse=True)

        return jsonify({
            'period_months': months,
            'from_date': from_date_str,
            'to_date': to_date_str,
            'students': results
        }), 200

    except Exception as e:
        print(f"[ERROR] leave-analytics: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/api/audit-logs', methods=['GET'])
@login_required
@role_required(['admin'])
def get_audit_logs():
    query = {}
    logs = list(mongo.db.activity_logs.find(query).sort('timestamp', -1).limit(50))
    res = []
    for l in logs:
        # Try to find user name across all roles
        uid = str(l.get('user_id', ''))
        user = get_user_by_id(uid, 'student') or get_user_by_id(uid, 'warden') or get_user_by_id(uid, 'admin')
        
        ts = l.get('timestamp')
        ts_str = ts.isoformat() if isinstance(ts, datetime) else str(ts) if ts else ''

        res.append({
            'timestamp': ts_str,
            'user': user['full_name'] if user else 'System',
            'action': l.get('action', 'unknown'),
            'details': l.get('details', '')
        })
    return jsonify(res), 200

@app.route('/api/hostels', methods=['GET', 'POST'])
def handle_hostels():
    if request.method == 'POST':
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': 'Access Denied: Admin only'}), 403
        data = sanitize_data(request.get_json())
        hostel_doc = {
            'name': data['name'],
            'type': data['type'],
            'capacity': data.get('capacity'),
            'location': data.get('location'),
            'is_active': True,
            'created_at': datetime.now(timezone.utc)
        }
        mongo.db.hostels.insert_one(hostel_doc)
        
        # Handle warden assignment if provided
        warden_id = data.get('warden_id')
        if warden_id:
            try:
                mongo.db.wardens.update_one(
                    {'_id': ObjectId(warden_id)},
                    {'$set': {'hostel_assigned': data['name']}}
                )
            except: pass
            
        return jsonify({'message': 'Hostel added'}), 201
        
    hostels = list(mongo.db.hostels.find())
    wardens = list(mongo.db.wardens.find())
    
    res = []
    for h in hostels:
        h_copy = to_json(h)
        # Match warden by hostel name
        warden = next((w for w in wardens if w.get('hostel_assigned') == h.get('name')), None)
        h_copy['warden_name'] = warden['full_name'] if warden else 'Not Assigned'
        res.append(h_copy)
        
    return jsonify(res), 200

@app.route('/api/hostels/<string:id>', methods=['PUT', 'DELETE'])
@login_required
@role_required(['admin'])
def handle_single_hostel(id):
    try: obj_id = ObjectId(id)
    except: return jsonify({'error': 'Invalid ID'}), 400

    if request.method == 'DELETE':
        mongo.db.hostels.delete_one({'_id': obj_id})
        return jsonify({'message': 'Hostel deleted'}), 200

    if request.method == 'PUT':
        data = sanitize_data(request.get_json())
        
        # Get current hostel to check name changes
        old_hostel = mongo.db.hostels.find_one({'_id': obj_id})
        if not old_hostel: return jsonify({'error': 'Hostel not found'}), 404
        
        new_name = data.get('name')
        
        update_data = {
            'name': new_name,
            'type': data.get('type'),
            'capacity': data.get('capacity'),
            'location': data.get('location')
        }
        update_data = {k: v for k, v in update_data.items() if v is not None}
        mongo.db.hostels.update_one({'_id': obj_id}, {'$set': update_data})
        
        # Sync name changes to wardens
        if new_name and new_name != old_hostel['name']:
            mongo.db.wardens.update_many(
                {'hostel_assigned': old_hostel['name']},
                {'$set': {'hostel_assigned': new_name}}
            )
            mongo.db.students.update_many(
                {'hostel_name': old_hostel['name']},
                {'$set': {'hostel_name': new_name}}
            )
            
        # Handle new warden assignment
        warden_id = data.get('warden_id')
        if warden_id:
            # Clear old warden assignment for this hostel
            mongo.db.wardens.update_many(
                {'hostel_assigned': new_name or old_hostel['name']},
                {'$set': {'hostel_assigned': None}}
            )
            # Set new warden
            try:
                mongo.db.wardens.update_one(
                    {'_id': ObjectId(warden_id)},
                    {'$set': {'hostel_assigned': new_name or old_hostel['name']}}
                )
            except: pass
        elif 'warden_id' in data and data['warden_id'] is None:
            # Explicitly unassign warden
            mongo.db.wardens.update_many(
                {'hostel_assigned': new_name or old_hostel['name']},
                {'$set': {'hostel_assigned': None}}
            )

        return jsonify({'message': 'Hostel updated'}), 200

@app.route('/api/rooms', methods=['GET'])
def get_rooms():
    hostel_id = request.args.get('hostel_id')
    query = {}
    if hostel_id:
        query['hostel_id'] = hostel_id
    rooms = list(mongo.db.hostel_rooms.find(query))
    return jsonify(to_json(rooms)), 200

@app.route('/api/students', methods=['GET', 'POST'])
@login_required
def handle_students():
    if request.method == 'POST':
        if session['role'] != 'admin': return jsonify({'error': 'Access Denied: Admin only'}), 403
        data = sanitize_data(request.get_json())
        name = data.get('name')
        email = data.get('email', '').lower()
        
        if not name or not email:
            return jsonify({'error': 'Name and email are required'}), 400
            
        if get_user_by_email_or_username(email):
            return jsonify({'error': 'Account with this email already exists'}), 400
            
        student_doc = {
            'full_name': name,
            'email': email,
            'password_hash': generate_password_hash(data.get('password', 'student123')),
            'student_id': data.get('studentId'),
            'department': data.get('department'),
            'course': data.get('course'),
            'hostel_name': data.get('hostel'),
            'room_number': data.get('roomNumber'),
            'parent_phone': data.get('parentPhone'),
            'role': 'student',
            'is_verified': True,
            'is_active': True,
            'created_at': datetime.now(timezone.utc)
        }
        mongo.db.students.insert_one(student_doc)
        return jsonify({'message': 'Student record created successfully'}), 201
        
    query = {}
    if session['role'] == 'warden':
        warden = get_user_by_id(session['user_id'], 'warden')
        query['hostel_name'] = warden.get('hostel_assigned')
        
    students = list(mongo.db.students.find(query))
    res = []
    for s in students:
        res.append({
            'id': str(s['_id']),
            'name': s['full_name'],
            'email': s['email'],
            'student_id': s.get('student_id'),
            'hostel': s.get('hostel_name'),
            'department': s.get('department', '—'),
            'course': s.get('course', '—'),
            'room_number': s.get('room_number'),
            'parent_phone': s.get('parent_phone'),
            'is_active': s.get('is_active', True)
        })
    return jsonify(res), 200

@app.route('/api/students/<string:id>', methods=['PUT', 'DELETE'])
@login_required
def handle_single_student(id):
    if session['role'] not in ('admin', 'warden'): return jsonify({'error': 'Denied'}), 403
    
    try:
        obj_id = ObjectId(id)
    except:
        return jsonify({'error': 'Invalid ID'}), 400

    if request.method == 'DELETE':
        mongo.db.students.delete_one({'_id': obj_id})
        return jsonify({'message': 'Student deleted'}), 200

    if request.method == 'PUT':
        data = sanitize_data(request.get_json())
        update_data = {
            'full_name': data.get('name'),
            'student_id': data.get('studentId'),
            'email': data.get('email', '').lower(),
            'department': data.get('department'),
            'course': data.get('course'),
            'hostel_name': data.get('hostel'),
            'room_number': data.get('roomNumber')
        }
        if data.get('parentPhone'): update_data['parent_phone'] = data.get('parentPhone')
        if data.get('password'): update_data['password_hash'] = generate_password_hash(data['password'])
        
        # Filter out None values
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        mongo.db.students.update_one({'_id': obj_id}, {'$set': update_data})
        return jsonify({'message': 'Student updated'}), 200

@app.route('/api/wardens', methods=['GET', 'POST'])
def handle_wardens():
    if request.method == 'POST':
        if 'user_id' not in session: return jsonify({'error': 'Authentication required'}), 401
        if session.get('role') != 'admin': return jsonify({'error': 'Access Denied: Admin only'}), 403
        data = sanitize_data(request.get_json())
        mongo.db.wardens.insert_one({
            'full_name': data['name'],
            'email': data['email'].lower(),
            'password_hash': generate_password_hash(data.get('password', 'warden123')),
            'hostel_assigned': data.get('hostel'),
            'phone': data.get('phone'),
            'role': 'warden',
            'is_verified': True,
            'is_active': True,
            'created_at': datetime.now(timezone.utc)
        })
        return jsonify({'message': 'Warden added'}), 201
        
    wardens = list(mongo.db.wardens.find())
    res = []
    for w in wardens:
        res.append({
            'id': str(w['_id']),
            'name': w['full_name'],
            'email': w['email'],
            'hostel': w.get('hostel_assigned'),
            'phone': w.get('phone', '—'),
            'is_active': w.get('is_active', True)
        })
    return jsonify(res), 200

@app.route('/api/wardens/<string:id>', methods=['PUT', 'DELETE'])
@login_required
@role_required(['admin'])
def handle_single_warden(id):
    try: obj_id = ObjectId(id)
    except: return jsonify({'error': 'Invalid ID'}), 400

    if request.method == 'DELETE':
        mongo.db.wardens.delete_one({'_id': obj_id})
        return jsonify({'message': 'Warden deleted'}), 200

    if request.method == 'PUT':
        data = sanitize_data(request.get_json())
        update_data = {
            'full_name': data.get('name'),
            'email': data.get('email'),
            'hostel_assigned': data.get('hostel'),
            'phone': data.get('phone'),
            'is_active': data.get('is_active')
        }
        if data.get('password'): update_data['password_hash'] = generate_password_hash(data['password'])
        update_data = {k: v for k, v in update_data.items() if v is not None}
        
        mongo.db.wardens.update_one({'_id': obj_id}, {'$set': update_data})
        return jsonify({'message': 'Warden updated'}), 200



@app.route('/api/settings', methods=['GET', 'PUT'])
@login_required
@role_required(['admin'])
def handle_settings():
    if request.method == 'PUT':
        data = sanitize_data(request.get_json())
        mongo.db.settings.update_one({}, {'$set': data}, upsert=True)
        return jsonify({'message': 'Settings updated'}), 200
        
    settings = mongo.db.settings.find_one({})
    if settings: settings.pop('_id', None)
    return jsonify(settings or {}), 200

# ========================= STATIC ASSETS =========================

@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/student-login')
def student_login_page():
    return send_from_directory('../frontend', 'student-login.html')

@app.route('/warden-login')
def warden_login_page():
    return send_from_directory('../frontend', 'warden-login.html')

@app.route('/admin-login')
def admin_login_page():
    return send_from_directory('../frontend', 'admin-login.html')

@app.route('/student-dashboard')
def student_dashboard():
    if 'user_id' not in session or session.get('role') != 'student':
        return redirect('/student-login')
    return send_from_directory('../frontend', 'student.html')

@app.route('/warden-dashboard')
def warden_dashboard():
    if 'user_id' not in session or session.get('role') != 'warden':
        return redirect('/warden-login')
    return send_from_directory('../frontend', 'warden.html')

@app.route('/admin-dashboard')
def admin_dashboard():
    if 'user_id' not in session or session.get('role') != 'admin':
        return redirect('/admin-login')
    return send_from_directory('../frontend', 'admin.html')

@app.route('/<path:path>')
def static_files(path):
    # Prevent direct access to .html dashboard files
    if path in ['student.html', 'warden.html', 'admin.html']:
        return redirect('/')
    return send_from_directory('../frontend', path)

# ========================= INITIALIZATION & MAIN =========================

def init_app():
    with app.app_context():
        if not init_database(app):
            print("[WARNING] Application starting without database connection...")
        
        # Create fixed admin if not exists
        try:
            if not mongo.db.admins.find_one({'role': 'admin'}):
                mongo.db.admins.insert_one({
                    'username': 'admin',
                    'full_name': 'System Administrator',
                    'email': 'admin@bgsbu.ac.in',
                    'password_hash': generate_password_hash('admin123'),
                    'role': 'admin',
                    'is_verified': True,
                    'is_active': True,
                    'created_at': datetime.now(timezone.utc)
                })
                print("[INFO] Default admin created: admin / admin123")
        except Exception as e:
            print(f"[ERROR] Failed to initialize admin: {e}")

# Call init_app globally so it runs when gunicorn loads the app
init_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

