# BGSBU Hostel Leave Management System

A modern, full-stack digital platform designed for Baba Ghulam Shah Badshah University (BGSBU) to simplify the hostel leave application process. This system allows students to apply for leave online while providing wardens and administrators with powerful tools to manage and track requests.

## 🚀 Key Features

### 🎓 For Students
- **Digital Applications:** Apply for leave from anywhere with a few clicks.
- **Real-time Tracking:** Monitor the status of your leave requests (Pending, Approved, Rejected).
- **Email Notifications:** Receive instant OTPs for verification and password resets.
- **Profile Management:** Keep your room and hostel information up to date.

### 👨‍🏫 For Wardens
- **Hostel-Specific Dashboard:** Manage requests only for your assigned hostel.
- **Quick Approvals:** Approve or reject requests with optional remarks.
- **Live Statistics:** See who is currently on leave and when they are expected back.
- **Direct Contact:** Access student and parent contact information easily.

### 👨‍💼 For Administrators
- **Full System Control:** Manage all hostels, students, and wardens.
- **Global Analytics:** View system-wide stats and activity logs.
- **Content Management:** Update "About Us" and contact details dynamically.
- **Bulk Operations:** Perform mass approvals or data cleaning.

---

## 🛠️ Technology Stack

### Backend
- **Python Flask:** Robust web framework.
- **MongoDB Atlas:** Scalable NoSQL cloud database.
- **PyMongo:** For seamless MongoDB integration.
- **Flask-Mail:** Automated email communication.
- **Gunicorn:** Production-grade WSGI server.

### Frontend
- **HTML5 & CSS3:** Responsive, glassmorphic UI design.
- **Vanilla JavaScript:** Fast and lightweight client-side logic.
- **Fetch API:** Asynchronous communication with the Flask backend.

---

## 📂 Project Structure

```text
├── backend/
│   ├── app.py              # Main Flask application logic
│   ├── database.py         # MongoDB connection & schema init
│   ├── render.yaml         # Render Blueprint configuration
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # Landing page
│   ├── student.html        # Student dashboard
│   ├── warden.html         # Warden dashboard
│   ├── admin.html          # Admin dashboard
│   ├── script.js           # Shared frontend logic
│   └── style.css           # Modern UI styling
└── .gitignore              # Files to ignore in Git
```

---

## ⚙️ Setup & Deployment

### Local Development
1. **Clone the repository:**
   ```bash
   git clone https://github.com/FadilSadiqSeh/Hostel-Leave-Management-System.git
   ```
2. **Install dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```
3. **Configure environment:** Create a `.env` file in the `backend` folder with your `MONGO_URI` and email credentials.
4. **Run the server:**
   ```bash
   python app.py
   ```

### Production (Render)
This project is configured for **Render Blueprint** deployment.
1. Push this code to GitHub.
2. In Render, select **New +** > **Blueprint**.
3. Connect your repository. Render will automatically detect the `backend/render.yaml` and set up your Web Service.
4. Deploy the `frontend` folder as a **Static Site**.

---

## 🔐 Default Credentials
- **Admin:** `admin@bgsbu.ac.in` / `admin123`
- **Warden/Student:** Register via the portal and verify via Email OTP.

---

## 🛡️ Security Features
- **OTP Verification:** Mandatory email verification for all new accounts.
- **CSRF Protection:** Secure state-changing API requests.
- **Password Hashing:** Industry-standard security using `werkzeug`.
- **Brute Force Protection:** Automatic account locking after failed attempts.

---

## 📜 License
This project is developed for BGSBU. All rights reserved.