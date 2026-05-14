## Project Structure

```
bgsbu-hostel-leave-system/
├── frontend/
│   ├── index.html          # Landing page
│   ├── login.html          # Login page
│   ├── register.html       # Registration page
│   ├── admin.html          # Admin dashboard
│   ├── warden.html         # Warden dashboard
│   ├── style.css           # Main stylesheet
│   └── script.js           # Client-side JavaScript
├── backend/
│   ├── app.py              # Flask application
│   └── requirements.txt    # Python dependencies
├── run_servers.bat         # Windows server runner
└── README.md               # This file
```

## Features

### 🎓 Student Features
- User registration and authentication
- Leave request submission with date selection
- Request status tracking
- Emergency contact information

### 👨‍🏫 Warden Features
- Hostel-specific leave request management
- Approve/reject leave requests
- Contact students directly
- View current leave statuses
- Quick actions for common tasks

### 👨‍💼 Admin Features
- System-wide student management
- User account creation and modification
- System settings configuration
- Analytics and reporting
- Bulk operations

## Technology Stack

### Backend
- **Python Flask** - Web framework
- **SQLAlchemy** - Database ORM
- **SQLite** - Database (easily replaceable with PostgreSQL/MySQL)
- **Flask-CORS** - Cross-origin resource sharing

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with responsive design
- **Vanilla JavaScript** - Client-side functionality
- **Fetch API** - HTTP requests

## Installation & Setup

### Prerequisites
- Python 3.8 or higher
- pip (Python package manager)

### 1. Clone/Download the Project
```bash
cd /path/to/your/project
```

### 2. Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
cd ..
```

### 3. Initialize the Database
The database will be automatically created when you first run the application.

### 4. Run the Backend Server
```bash
cd backend
python app.py
```
The backend will start on `http://localhost:5000`

### 5. Run the Frontend Server
In a separate terminal:
```bash
cd frontend
python -m http.server 8000
```
The frontend will be available at `http://localhost:8000`

## Default Accounts

### Admin Account
- **Username:** admin@bgsbu.edu
- **Password:** admin123

### Warden Account
- **Username:** warden@bgsbu.edu
- **Password:** warden123

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `GET /api/profile` - Get user profile

### Leave Requests
- `POST /api/leave-requests` - Create leave request
- `GET /api/leave-requests` - Get leave requests (filtered by role)
- `PUT /api/leave-requests/<id>` - Update leave request status

### Admin Only
- `GET /api/students` - Get all students
- `POST /api/students` - Add new student
- `PUT /api/students/<id>` - Update student
- `DELETE /api/students/<id>` - Delete student
- `GET /api/stats` - Get system statistics
- `GET /api/settings` - Get system settings
- `PUT /api/settings` - Update system settings

## Database Schema

### Users Table
- id (Primary Key)
- username (Unique)
- email (Unique)
- password_hash
- full_name
- student_id (Unique, nullable)
- hostel
- room_number
- role (student/warden/admin)
- created_at
- is_active

### Leave Requests Table
- id (Primary Key)
- student_id (Foreign Key)
- start_date
- end_date
- reason
- status (pending/approved/rejected)
- emergency_contact
- submitted_at
- reviewed_at
- reviewed_by (Foreign Key)
- remarks

### System Settings Table
- id (Primary Key)
- setting_key (Unique)
- setting_value
- updated_at

## Security Features

- Password hashing with Werkzeug
- Session-based authentication
- Role-based access control
- Input validation and sanitization
- CORS protection
- SQL injection prevention

## Development

### Adding New Features
1. Update the database models in `app.py`
2. Add new API endpoints
3. Update the frontend JavaScript to call new endpoints
4. Update HTML templates as needed

### Database Migrations
When you modify the database models:
1. Delete the `hostel_leave_system.db` file
2. Restart the Flask application (it will recreate the database)

## Production Deployment

### Environment Variables
Create a `.env` file with:
```
SECRET_KEY=your-production-secret-key
DATABASE_URL=your-database-url
FLASK_ENV=production
```

### Database
Replace SQLite with PostgreSQL/MySQL for production:
```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:password@localhost/dbname'
```

### Security
- Change default admin/warden passwords
- Use HTTPS in production
- Implement proper session management
- Add rate limiting
- Enable CSRF protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions, please contact the development team at BGSBU Rajouri.