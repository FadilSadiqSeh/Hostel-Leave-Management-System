// ===================== CONFIG =====================
const isDevServer = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
const API_URL = isDevServer 
    ? `http://${window.location.hostname}:5000`
    : 'https://hostel-leave-management-system-qrt2.onrender.com';

const ALL_DEPARTMENTS = [
    "B.Tech", "M.Tech", "MCA", "BCA", "Integrated MCA", 
    "B.Sc. Data Science & Artificial Intelligence", "M.Sc. (IT)", 
    "M.Sc. Mathematics", "B.Sc. Mathematics", "M.Sc. Physics", 
    "B.Sc. (Hons) Physics", "Diploma Engineering", "BBA", "MBA", "MBA-HTM", 
    "M.A. Economics", "B.A. (Hons) Economics", "B.A. (Hons) Arabic", 
    "M.A. Arabic", "M.A. Islamic Studies", "M.A. Urdu", "B.A. (Hons) Urdu", 
    "M.A. English", "B.A. (Hons) English", "M.A. Persian", "B.A. (Hons) Persian", 
    "M.A. Gojri", "B.A. (Hons) Gojri", "M.A. Pahari", "B.A. (Hons) Pahari", 
    "M.A. Education", "B.A. (Hons) Education", "M.Sc. Environmental Sciences", 
    "B.Sc. Environmental Sciences", "M.Sc. Biotechnology", "B.Sc. Biotechnology", 
    "M.Sc. Botany", "B.Sc. Botany", "M.Sc. Zoology", "B.Sc. Zoology", 
    "M.Sc. Microbiology", "B.A. (Hons) History", "B.A. (Hons) Sociology", 
    "B.A. (Hons) Political Science & International Relations"
];

if (window.location.protocol === 'file:') {
    alert("CRITICAL ERROR: You are opening this HTML file directly. The application requires a web server to function properly. Please open " + API_URL + " in your browser instead.");
}

// ===================== HELPERS =====================
function getCurrentUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
}
function isLoggedIn() { return !!localStorage.getItem('user'); }

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// --- Date Formatting Helpers ---
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // Return as is if invalid
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const h = String(hours).padStart(2, '0');

    return `${d}/${m}/${y} ${h}:${minutes} ${ampm}`;
}

function showMsg(msg, type = 'info') {
    document.querySelectorAll('.message-notification').forEach(el => el.remove());
    const d = document.createElement('div');
    d.className = 'message-notification';
    d.textContent = msg;
    Object.assign(d.style, {
        position: 'fixed', top: '20px', right: '20px', padding: '14px 20px',
        borderRadius: '8px', fontWeight: '500', zIndex: '9999', maxWidth: '320px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)', animation: 'slideInRight .3s ease-out',
        background: type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--warning)',
        color: '#fff'
    });
    document.body.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; setTimeout(() => d.remove(), 300); }, 4000);
}

function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = 'block';
    setTimeout(() => el.classList.add('show'), 10);
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.style.display = 'none', 300);
}

function showConfirm(title, message, onConfirm) {
    const modalId = 'confirm-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal confirm-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 id="confirm-title">Confirm Action</h3>
                    <span class="modal-close" onclick="closeModal('${modalId}')">&times;</span>
                </div>
                <div class="modal-body">
                    <p id="confirm-message" style="margin-bottom: 20px; color: var(--text-main); font-size: 0.95rem;"></p>
                    <div class="modal-actions" style="justify-content: flex-end; gap: 10px;">
                        <button class="btn btn-secondary" onclick="closeModal('${modalId}')">Cancel</button>
                        <button class="btn btn-danger" id="confirm-yes-btn">Yes, Delete</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);
    }

    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const confirmBtn = document.getElementById('confirm-yes-btn');
    // Clear previous listeners
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
        onConfirm();
        closeModal(modalId);
    });

    openModal(modalId);
}

async function apiFetch(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    
    // Auto-attach CSRF token for state-changing requests
    const method = opts.method ? opts.method.toUpperCase() : 'GET';
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
        const csrfToken = getCookie('csrf_token');
        if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
    }

    const res = await fetch(`${API_URL}/api${path}`, {
        credentials: 'include',
        headers,
        ...opts
    });

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error("Non-JSON Response:", text);
        throw new Error("Server error. Check terminal.");
    }

    if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem('user');
            const page = window.location.pathname.split('/').pop() || 'index.html';
            const authPages = ['index.html', 'login.html', 'register.html', 'student-login.html', 'warden-login.html', 'admin-login.html'];
            if (!authPages.includes(page)) {
                window.location.href = 'index.html';
            }
        }
        const errMsg = data.message || data.error || 'Status ' + res.status;
        console.error(`[API ERROR] ${opts.method || 'GET'} ${API_URL}/api${path} returned ${res.status}:`, data);
        throw new Error(errMsg);
    }
    return data;
}

async function loadPublicStats() {
    const statsContainer = document.getElementById('live-stats');
    if (!statsContainer) return;

    try {
        const stats = await apiFetch('/public-stats');
        const setVal = (id, val) => { 
            const el = document.getElementById(id); 
            if (el) el.textContent = val.toLocaleString() + (id === 'stat-students' ? '+' : ''); 
        };
        setVal('stat-students', stats.total_students || 0);
        setVal('stat-hostels', stats.total_hostels || 0);
        setVal('stat-leaves', stats.total_leaves || 0);
        setVal('stat-wardens', stats.total_wardens || 0);
        
        // Also load contact settings while we are on the index page
        await loadContactSettings();
    } catch (err) {
        console.warn("Public stats failed:", err);
    }
}

async function loadContactSettings() {
    const container = document.getElementById('contact-details-container');
    if (!container) return;

    try {
        const data = await apiFetch('/contact-settings');
        if (!data || !data.contacts) return;

        // Update About Section
        const aboutEl = document.getElementById('about-description');
        if (aboutEl) aboutEl.textContent = data.aboutText || '';

        let html = '';
        data.contacts.forEach(c => {
            html += `
                <div class="contact-card" style="background: var(--bg-card); padding: 35px 25px; border-radius: 20px; border: 1px solid var(--glass-border); display: flex; flex-direction: column; gap: 15px; transition: var(--transition);">
                    <div style="display: flex; align-items: center; gap: 15px; border-bottom: 1px solid var(--glass-border); padding-bottom: 15px; margin-bottom: 5px;">
                        <div style="font-size: 2rem; filter: drop-shadow(0 0 10px var(--primary-glow));">🏠</div>
                        <div style="text-align: left;">
                            <h4 style="color: var(--text-dim); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Hostel Name</h4>
                            <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${c.hostelName}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 1.2rem;">🛡️</span>
                            <div>
                                <small style="display: block; color: var(--text-dim); font-size: 0.65rem; text-transform: uppercase;">Warden</small>
                                <span style="font-weight: 600; font-size: 0.95rem;">${c.wardenName}</span>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 1.2rem;">📞</span>
                            <div>
                                <small style="display: block; color: var(--text-dim); font-size: 0.65rem; text-transform: uppercase;">Phone</small>
                                <a href="tel:${c.phone}" style="color: var(--primary-hover); font-weight: 600; font-size: 0.95rem; text-decoration: none;">${c.phone}</a>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 1.2rem;">✉️</span>
                            <div>
                                <small style="display: block; color: var(--text-dim); font-size: 0.65rem; text-transform: uppercase;">Email</small>
                                <a href="mailto:${c.email}" style="color: var(--primary-hover); font-weight: 600; font-size: 0.95rem; text-decoration: none; word-break: break-all;">${c.email}</a>
                            </div>
                        </div>
                    </div>
                </div>`;
        });
        container.innerHTML = html;
    } catch (err) {
        console.error("Failed to load contact settings:", err);
    }
}

function createContactRow(c = {}) {
    const row = document.createElement('div');
    row.className = 'contact-settings-row';
    row.style = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; padding: 25px; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 12px; position: relative; margin-bottom: 10px;';
    
    row.innerHTML = `
        <div class="form-group">
            <label style="font-size: 11px; color: var(--text-dim);">Hostel Name</label>
            <input type="text" class="form-input row-hostel" placeholder="e.g. Hostel 1" value="${c.hostelName || ''}" required style="width: 100%;">
        </div>
        <div class="form-group">
            <label style="font-size: 11px; color: var(--text-dim);">Warden Name</label>
            <input type="text" class="form-input row-warden" placeholder="e.g. Mr. John" value="${c.wardenName || ''}" required style="width: 100%;">
        </div>
        <div class="form-group">
            <label style="font-size: 11px; color: var(--text-dim);">Phone Number</label>
            <input type="tel" class="form-input row-phone" placeholder="10-digit number" maxlength="10" value="${c.phone || ''}" required style="width: 100%;">
        </div>
        <div class="form-group">
            <label style="font-size: 11px; color: var(--text-dim);">Email Address</label>
            <input type="email" class="form-input row-email" placeholder="abc@gmail.com" value="${c.email || ''}" required style="width: 100%;">
        </div>
        <button class="btn-remove-row" title="Remove Contact" style="position: absolute; top: -10px; right: -10px; background: var(--danger); color: #fff; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10;">&times;</button>
    `;

    row.querySelector('.btn-remove-row').addEventListener('click', () => {
        if (document.querySelectorAll('.contact-settings-row').length > 1) {
            row.remove();
        } else {
            showMsg('At least one contact is required', 'warning');
        }
    });

    return row;
}

async function initContactSettingsAdmin() {
    const listContainer = document.getElementById('contact-list-admin');
    if (!listContainer) return;

    try {
        const data = await apiFetch('/contact-settings');
        if (data) {
            document.getElementById('set-about-text').value = data.aboutText || '';
            if (data.contacts && data.contacts.length > 0) {
                listContainer.innerHTML = '';
                data.contacts.forEach(c => listContainer.appendChild(createContactRow(c)));
            } else {
                listContainer.appendChild(createContactRow());
            }
        }
    } catch (err) {
        console.error("Failed to fetch settings:", err);
        listContainer.appendChild(createContactRow());
    }

    document.getElementById('add-contact-row-btn')?.addEventListener('click', () => {
        listContainer.appendChild(createContactRow());
    });

    document.getElementById('save-contact-settings')?.addEventListener('click', async () => {
        const aboutText = document.getElementById('set-about-text').value.trim();
        const contactRows = document.querySelectorAll('.contact-settings-row');
        const contacts = [];

        for (const row of contactRows) {
            const contact = {
                hostelName: row.querySelector('.row-hostel').value.trim(),
                wardenName: row.querySelector('.row-warden').value.trim(),
                phone: row.querySelector('.row-phone').value.trim(),
                email: row.querySelector('.row-email').value.trim()
            };

            if (!contact.hostelName || !contact.wardenName || !contact.phone || !contact.email) {
                showMsg('Please fill all fields for all contacts', 'error');
                return;
            }
            contacts.push(contact);
        }

        if (!aboutText) {
            showMsg('About text is required', 'error');
            return;
        }

        try {
            const res = await apiFetch('/contact-settings', {
                method: 'PUT',
                body: JSON.stringify({ aboutText, contacts })
            });
            if (res.message) {
                showMsg(res.message, 'success');
            } else if (res.error) {
                showMsg(res.error, 'error');
            }
        } catch (err) {
            showMsg(err.message || 'Failed to update contact settings', 'error');
        }
    });
}

// ===================== AUTH =====================
async function handleLogin(e) {
    e.preventDefault();
    const roleInput = document.getElementById('login-role');
    const role = roleInput ? roleInput.value : 'student';
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) { showMsg('Please fill all fields', 'error'); return; }
    try {
        showMsg('Signing in…', 'info');
        const data = await apiFetch('/login', { method: 'POST', body: JSON.stringify({ username, password, role }) });
        localStorage.setItem('user', JSON.stringify(data.user));
        showMsg('Login successful! Redirecting…', 'success');
        setTimeout(() => {
            const redirectPath = isDevServer ? `${data.user.role}.html` : `/${data.user.role}-dashboard`;
            window.location.href = redirectPath;
        }, 900);
    } catch (err) {
        if (err.message === 'Email not verified') {
            const emailField = document.getElementById('otp-email-hidden');
            if (emailField) emailField.value = username;
            sessionStorage.setItem('pending_otp_email', username);
            
            const contextField = document.getElementById('otp-context');
            if (contextField) contextField.value = 'verify';
            
            const resetGroup = document.getElementById('reset-password-group');
            if (resetGroup) resetGroup.style.display = 'none';

            // Update UI for Verification context
            const otpMsg = document.getElementById('otp-message');
            const otpBtn = document.getElementById('otp-submit-btn');
            if (otpMsg) otpMsg.textContent = 'Enter the 6-digit code sent to your email to verify your account';
            if (otpBtn) otpBtn.textContent = 'Verify Account';

            toggleForm('otp-container');
            showMsg('Please verify your email first.', 'info');
        } else {
            showMsg(err.message, 'error');
            console.error("Login Error:", err);
        }
    }
}

async function checkSession() {
    try {
        const data = await apiFetch('/verify-session');
        if (!data.logged_in) throw new Error('Session invalid');
        return data;
    } catch (err) {
        console.warn("[Auth] Session check failed:", err.message);
        localStorage.removeItem('user');
        return null;
    }
}

function toggleForm(id) {
    document.querySelectorAll('.auth-card').forEach(el => el.style.display = 'none');
    
    // Clear any temporary success banners
    const banner = document.getElementById('reg-success-banner');
    if (banner) banner.style.display = 'none';

    const target = document.getElementById(id);
    if (target) {
        target.style.display = 'block';
        // Auto-focus first input for better UX
        const firstInp = target.querySelector('input');
        if (firstInp) firstInp.focus();
    }
}

function toggleRegFields() {
    const role = document.getElementById('reg-role').value;
    const studentFields = document.getElementById('student-reg-fields');
    const wardenFields = document.getElementById('warden-reg-fields');

    if (role === 'student') {
        studentFields.style.display = 'block';
        wardenFields.style.display = 'none';
    } else if (role === 'warden') {
        studentFields.style.display = 'none';
        wardenFields.style.display = 'block';
    } else {
        // admin
        studentFields.style.display = 'none';
        wardenFields.style.display = 'none';
    }
    // Clear all field errors when switching roles
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('#register-form input, #register-form select').forEach(el => el.classList.remove('input-error'));
}

// ---- Field-level error helpers ----
function setFieldError(errId, msg) {
    const el = document.getElementById(errId);
    if (el) { el.textContent = msg; }
}
function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('#register-form .input-error').forEach(el => el.classList.remove('input-error'));
}
function markError(inputId, errId, msg) {
    const inp = document.getElementById(inputId);
    if (inp) inp.classList.add('input-error');
    setFieldError(errId, msg);
}

// ---- Dynamic Room Loader ----
async function loadRoomsForHostel(hostelId) {
    const roomSel = document.getElementById('reg-room');
    const roomSpinner = document.getElementById('room-spinner');
    const errSpan = document.getElementById('err-reg-room');
    
    // If it's a text input (manual entry), don't try to load rooms
    if (!roomSel || roomSel.tagName !== 'SELECT') return;

    // Always clear previous rooms and error state first
    roomSel.innerHTML = '';
    if (errSpan) errSpan.textContent = '';

    if (!hostelId) {
        roomSel.innerHTML = '<option value="">Select a Hostel first</option>';
        roomSel.disabled = true;
        return;
    }

    // Show loading state
    roomSel.disabled = true;
    roomSel.innerHTML = '<option value="">Loading rooms\u2026</option>';
    if (roomSpinner) roomSpinner.style.display = 'inline-block';

    const url = `${API_URL}/api/rooms?hostel_id=${encodeURIComponent(hostelId)}`;
    console.log(`[Rooms] Fetching: ${url}`);

    try {
        // Use plain fetch — /api/rooms is public, no auth required
        const res = await fetch(url, { credentials: 'include' });

        if (!res.ok) {
            const text = await res.text();
            console.error(`[Rooms] HTTP ${res.status}:`, text);
            throw new Error(`Server returned ${res.status}`);
        }

        const rooms = await res.json();
        console.log(`[Rooms] Received ${rooms.length} rooms for hostel_id=${hostelId}`, rooms);

        // Clear and repopulate
        roomSel.innerHTML = '<option value="">\u2014 Select Room \u2014</option>';

        if (!rooms.length) {
            roomSel.innerHTML = '<option value="">No rooms available for this hostel</option>';
        } else {
            let availableCount = 0;
            rooms.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                // Support both field names: "number" (our API) and "room_number" (legacy)
                const roomNum = r.number || r.room_number || r.id;
                opt.textContent = `Room ${roomNum}${r.is_occupied ? ' (Occupied)' : ''}`;
                if (r.is_occupied) {
                    opt.disabled = true;
                    opt.style.color = '#999';
                } else {
                    availableCount++;
                }
                roomSel.appendChild(opt);
            });
            roomSel.disabled = availableCount === 0;
            if (availableCount === 0 && errSpan) {
                errSpan.textContent = 'All rooms in this hostel are currently occupied.';
            }
        }
    } catch (err) {
        console.error('[Rooms] Failed to load rooms:', err);
        // Show error in dropdown + a retry button below it
        roomSel.innerHTML = '<option value="">\u26a0\ufe0f Failed to load rooms</option>';
        roomSel.disabled = true;
        if (errSpan) {
            errSpan.innerHTML = `Could not load rooms. <a href="#" onclick="loadRoomsForHostel('${hostelId}'); return false;" style="color:#b23a48; font-weight:600;">Retry \u21ba</a>`;
        }
    } finally {
        if (roomSpinner) roomSpinner.style.display = 'none';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    clearFieldErrors();

    const role = document.getElementById('reg-role').value;
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    // Common validation
    let hasError = false;
    if (!name) { markError('reg-name', 'err-reg-name', 'Full name is required'); hasError = true; }
    if (!email) { markError('reg-email', 'err-reg-email', 'Email is required'); hasError = true; }
    if (!password || password.length < 6) { markError('reg-password', 'err-reg-password', 'Password must be at least 6 characters'); hasError = true; }

    const payload = { name, email, role, password };

    if (role === 'student') {
        const studentId = document.getElementById('reg-student-id').value.trim();
        const department = document.getElementById('reg-department').value;
        const course = document.getElementById('reg-course').value;
        const hostelId = document.getElementById('reg-hostel').value;
        const roomNumber = document.getElementById('reg-room').value.trim();
        const parentPhone = document.getElementById('reg-parent-phone').value.trim();

        if (!studentId) { markError('reg-student-id', 'err-reg-student-id', 'Student ID is required'); hasError = true; }
        if (!department) { markError('reg-department', 'err-reg-department', 'Please select a department'); hasError = true; }
        if (!course) { markError('reg-course', 'err-reg-course', 'Please select a course'); hasError = true; }
        if (!hostelId) { markError('reg-hostel', 'err-reg-hostel', 'Please select a hostel'); hasError = true; }

        if (!roomNumber) {
            markError('reg-room', 'err-reg-room', 'Room number is required');
            hasError = true;
        } else if (!/^[A-Za-z0-9][A-Za-z0-9\-]{0,18}$/.test(roomNumber)) {
            markError('reg-room', 'err-reg-room', 'Invalid format — use numbers (101) or alphanumeric (A101, B-202)');
            hasError = true;
        }

        if (!parentPhone) {
            markError('reg-parent-phone', 'err-reg-parent-phone', 'Parent phone is required');
            hasError = true;
        } else if (!/^\d{10}$/.test(parentPhone)) {
            markError('reg-parent-phone', 'err-reg-parent-phone', 'Must be a 10-digit number');
            hasError = true;
        }

        Object.assign(payload, { studentId, department, course, hostelId, roomNumber, parentPhone });
    } else if (role === 'warden') {
        const hostelId = document.getElementById('reg-warden-hostel').value;
        const phone = document.getElementById('reg-warden-phone').value.trim();

        if (!hostelId) { markError('reg-warden-hostel', 'err-reg-warden-hostel', 'Please select an assigned hostel'); hasError = true; }

        if (!phone) {
            markError('reg-warden-phone', 'err-reg-warden-phone', 'Contact number is required');
            hasError = true;
        } else if (!/^\d{10}$/.test(phone)) {
            markError('reg-warden-phone', 'err-reg-warden-phone', 'Must be a 10-digit number');
            hasError = true;
        }

        Object.assign(payload, { hostelId, phone });
    }

    if (hasError) return;

    const btn = document.getElementById('reg-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Creating Account…';

    try {
        await apiFetch('/register', { method: 'POST', body: JSON.stringify(payload) });

        // Show success banner
        const banner = document.getElementById('reg-success-banner');
        const msg = document.getElementById('reg-success-msg');
        if (banner) { 
            msg.textContent = '🎉 Account created! Please verify the OTP sent to your email.'; 
            banner.style.display = 'flex'; 
        }

        // Set OTP context then switch screen immediately after a short visible success feedback
        const emailField = document.getElementById('otp-email-hidden');
        if (emailField) emailField.value = payload.email;
        sessionStorage.setItem('pending_otp_email', payload.email);
        
        const contextField = document.getElementById('otp-context');
        if (contextField) contextField.value = 'verify';
        
        // Short delay only for user to see the "success" message before transition
        setTimeout(() => {
            toggleForm('otp-container');
            // Reset button for next time
            btn.disabled = false;
            btn.textContent = 'Create My Account';
            if (banner) banner.style.display = 'none';
        }, 800);
    } catch (err) {
        showMsg(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Create My Account';
    }
}

async function handleVerifyOTP(e) {
    e.preventDefault();
    let email = document.getElementById('otp-email-hidden').value;
    if (!email) {
        email = sessionStorage.getItem('pending_otp_email');
    }
    
    const otp = document.getElementById('otp-code').value.trim();
    const context = document.getElementById('otp-context').value;
    const btn = document.getElementById('otp-submit-btn');

    console.log(`[OTP] Verifying for ${email}, Context: ${context}, Code: ${otp}`);

    if (!otp || otp.length < 6) { showMsg('Please enter the 6-digit code', 'error'); return; }
    if (!email) { showMsg('Email context lost. Please try signing in again.', 'error'); return; }

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Verifying...';

    try {
        if (context === 'verify') {
            await apiFetch('/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) });
            showMsg('Email verified successfully! You can now log in.', 'success');
            sessionStorage.removeItem('pending_otp_email');
            setTimeout(() => toggleForm('login-container'), 1000);
        } else if (context === 'reset') {
            const password = document.getElementById('reset-new-password').value;
            if (!password || password.length < 6) { 
                showMsg('Password must be at least 6 characters', 'error'); 
                btn.disabled = false;
                btn.textContent = originalText;
                return; 
            }
            await apiFetch('/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, password }) });
            showMsg('Password reset successfully! You can now log in.', 'success');
            sessionStorage.removeItem('pending_otp_email');
            setTimeout(() => toggleForm('login-container'), 1000);
        }
    } catch (err) {
        console.error("[OTP Error]", err);
        showMsg(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function handleResendOTP() {
    let email = document.getElementById('otp-email-hidden').value;
    if (!email) {
        email = sessionStorage.getItem('pending_otp_email');
    }
    
    if (!email) { showMsg('Email is missing. Please restart the process.', 'error'); return; }
    
    console.log(`[OTP] Resending for ${email}`);
    try {
        showMsg('Sending new OTP...', 'info');
        await apiFetch('/resend-otp', { method: 'POST', body: JSON.stringify({ email }) });
        showMsg('New OTP sent to your email.', 'success');
    } catch (err) { 
        console.error("[Resend Error]", err);
        showMsg(err.message, 'error'); 
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) { showMsg('Please enter your email', 'error'); return; }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Sending OTP...';

    try {
        await apiFetch('/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        showMsg('Password reset OTP sent!', 'success');
        
        document.getElementById('otp-email-hidden').value = email;
        sessionStorage.setItem('pending_otp_email', email);
        document.getElementById('otp-context').value = 'reset';
        document.getElementById('reset-password-group').style.display = 'block';

        // Update UI for Reset context
        const otpMsg = document.getElementById('otp-message');
        const otpBtn = document.getElementById('otp-submit-btn');
        if (otpMsg) otpMsg.textContent = 'Enter the reset code and your new password';
        if (otpBtn) otpBtn.textContent = 'Reset Password';

        toggleForm('otp-container');
    } catch (err) { 
        showMsg(err.message, 'error'); 
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Reset Code';
    }
}



async function handleLogout(e) {
    e && e.preventDefault();
    const user = getCurrentUser();
    const role = user ? user.role : 'student';
    try { await apiFetch('/logout', { method: 'POST' }); } catch (_) { }
    localStorage.removeItem('user');
    const redirectPath = isDevServer ? `${role}-login.html` : `/${role}-login`;
    window.location.href = redirectPath;
}

// ===================== ADMIN GUARD =====================
function guardAdmin() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (page !== 'admin.html' && page !== 'admin-dashboard') return true; // not on admin page, no check needed
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        showMsg('Access denied. Admin only.', 'error');
        setTimeout(() => window.location.href = '/admin-login', 1200);
        return false;
    }
    return true;
}

// ===================== ADMIN STATS =====================
async function loadAdminStats() {
    try {
        const s = await apiFetch('/stats');
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

        // Unified Dashboard IDs
        set('admin-total-students', s.total_students ?? 0);
        set('admin-total-wardens', s.total_wardens ?? 0);
        set('admin-total-hostels', s.total_hostels ?? 0);

        // Legacy Admin Page IDs
        set('total-students', s.total_students ?? 0);
        set('total-wardens', s.total_wardens ?? 0);
        set('total-hostels', s.total_hostels ?? 0);
    } catch (err) { console.error('Stats error:', err); }
}

// ===================== LEAVE REQUESTS (Admin) =====================
// ===================== LEAVE RECORDS (Admin & Warden History) =====================
let allLeaveRecords = [];

async function loadLeaveRecords(role) {
    const filterId = role === 'admin' ? 'admin-visibility-filter' : 'warden-visibility-filter';
    const vis = document.getElementById(filterId)?.value || 'active';

    const tbodyId = role === 'admin' ? 'leave-records-body' : 'warden-history-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    try {
        allLeaveRecords = await apiFetch(`/leave-requests?visibility=${vis}`);
        renderLeaveRecords(allLeaveRecords, role, vis);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#e74c3c;">Failed to load records.</td></tr>`;
    }
}

function renderLeaveRecords(list, role, visibility = 'active') {
    const tbodyId = role === 'admin' ? 'leave-records-body' : 'warden-history-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = '';
    tbody.innerHTML = '';
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="${role === 'admin' ? 9 : 12}" style="text-align:center; padding:30px; color:var(--text-muted); font-style:italic;">No records found.</td></tr>`;
        return;
    }

    // Sort by submission date (newest first)
    const sorted = [...list].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));

    sorted.forEach(req => {
        const s = req.student;
        const tr = document.createElement('tr');

        // Status color coding
        const statusClass = `status-${req.status}`;
        const statusLabel = req.status.toUpperCase();

        if (role === 'admin') {
            tr.innerHTML = `
                <td><input type="checkbox" class="leave-checkbox" value="${req.id}"></td>
                <td>
                    <div style="font-weight:600; color:var(--text-main);">${s.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${s.student_id} | ${s.course || '—'}</div>
                </td>
                <td>
                    <div style="font-weight:500; color:var(--text-main);">${s.hostel}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">Dept: ${s.department} | Room: ${s.room_number}</div>
                </td>
                <td style="font-size:0.85rem; font-weight:500; color:var(--text-main);">
                    ${formatDate(req.start_date)}<br>
                    <span style="color:var(--text-muted); font-size:0.75rem;">to</span> ${formatDate(req.end_date)}
                </td>
                <td>
                    <div title="${req.reason}" style="font-size:0.85rem; color:var(--text-main); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${req.reason}</div>
                    <div style="font-size:0.75rem; color:var(--danger); font-weight:600; margin-top:4px;">📞 ${s.parent_phone || req.emergency_contact || 'N/A'}</div>
                </td>
                <td><span class="${statusClass}">${statusLabel}</span></td>
                <td style="font-size:0.85rem; color:var(--text-main);">${req.reviewer || '—'}</td>
                <td style="font-size:0.85rem; color:var(--text-muted);">${req.reviewed_at ? formatDate(req.reviewed_at) : '—'}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-small btn-secondary view-leave-btn" data-id="${req.id}" title="View Details">👁️</button>
                        ${visibility === 'hidden'
                    ? `<button class="btn btn-small btn-success restore-leave-btn" data-id="${req.id}" title="Restore Record">⟲</button>`
                    : `<button class="btn btn-small btn-danger del-leave-btn" data-id="${req.id}" title="Delete Record">🗑️</button>`
                }
                    </div>
                </td>
            `;
        } else {
            // Warden History (excluding pending)
            if (req.status === 'pending') return;
            tr.innerHTML = `
                <td><input type="checkbox" class="leave-checkbox" value="${req.id}"></td>
                <td>
                    <div style="font-weight:600; color:var(--text-main);">${s.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">ID: ${s.student_id || '—'}</div>
                </td>
                <td><div style="font-size:0.85rem; color:var(--text-main);">${s.department || '—'}</div></td>
                <td><div style="font-size:0.85rem; color:var(--text-muted);">${s.course || '—'}</div></td>
                <td><div style="font-size:0.85rem; color:var(--text-main);">${s.hostel || '—'}</div></td>
                <td style="font-weight:500; color:var(--text-main);">Room ${s.room_number || '—'}</td>
                <td style="font-size:0.85rem; font-weight:500; color:var(--text-main);">
                    ${formatDate(req.start_date)}<br>
                    <span style="color:var(--text-muted); font-size:0.75rem;">to</span> ${formatDate(req.end_date)}
                </td>
                <td>
                    <div title="${req.reason}" style="font-size:0.85rem; color:var(--text-main); max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${req.reason}</div>
                    <div style="font-size:0.75rem; color:var(--danger); font-weight:600; margin-top:4px;">📞 ${s.parent_phone || req.emergency_contact || 'N/A'}</div>
                </td>
                <td><span class="${statusClass}">${statusLabel}</span></td>
                <td style="font-size:0.85rem; color:var(--text-main);">${req.reviewer || '—'}</td>
                <td style="font-size:0.85rem; color:var(--text-muted);">${req.reviewed_at ? formatDate(req.reviewed_at) : '—'}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-small btn-secondary view-leave-btn" data-id="${req.id}" title="View Details">👁️</button>
                        ${visibility === 'hidden'
                    ? `<button class="btn btn-small btn-success restore-leave-btn" data-id="${req.id}" title="Restore Record">⟲</button>`
                    : `<button class="btn btn-small btn-danger del-leave-btn" data-id="${req.id}" title="Delete Record">🗑️</button>`
                }
                    </div>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });
}

function filterLeaveRecords(role) {
    const qId = role === 'admin' ? 'leave-search' : 'warden-leave-search';
    const sId = role === 'admin' ? 'leave-status-filter' : 'warden-leave-status-filter';
    const dId = role === 'admin' ? 'leave-date-filter' : 'warden-leave-date-filter';

    const q = (document.getElementById(qId)?.value || '').toLowerCase();
    const status = (document.getElementById(sId)?.value || 'all');
    const date = (document.getElementById(dId)?.value || '');

    const filtered = allLeaveRecords.filter(req => {
        const s = req.student;
        const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q);
        const matchesStatus = status === 'all' || req.status === status;
        const matchesDate = !date || req.start_date === date || req.end_date === date;
        return matchesQuery && matchesStatus && matchesDate;
    });

    renderLeaveRecords(filtered, role);
}


async function deleteLeaveRequest(id, btn) {
    if (btn) {
        btn.disabled = true;
        btn.classList.add('loading');
    }

    try {
        await apiFetch(`/leave-requests/${id}`, { method: 'DELETE' });
        showMsg('Leave record deleted successfully', 'success');

        // Instant update without reload
        // Instant update without reload
        const user = getCurrentUser();
        if (user.role === 'student') {
            const row = btn.closest('tr');
            if (row) row.remove();
            // Also refresh stats
            loadStudentData();
        } else if (user.role === 'warden') {
            loadWardenData();
        } else if (user.role === 'admin') {
            loadAdminData();
        }
    } catch (err) {
        showMsg(err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    }
}

async function restoreLeaveRequest(id, btn) {
    if (btn) {
        btn.disabled = true;
        btn.classList.add('loading');
    }

    try {
        await apiFetch(`/leave-requests/${id}/restore`, { method: 'PUT' });
        showMsg('Leave record restored successfully', 'success');

        const user = getCurrentUser();
        if (user.role === 'student') {
            loadStudentData();
        } else if (user.role === 'warden') {
            loadLeaveRecords('warden');
        } else if (user.role === 'admin') {
            loadLeaveRecords('admin');
        }
    } catch (err) {
        showMsg(err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
        }
    }
}

// ===================== HOSTEL DROPDOWN HELPER =====================
async function populateHostelDropdowns() {
    // Show spinners
    const spinners = ['hostel-spinner', 'warden-hostel-spinner'];
    spinners.forEach(sid => { const s = document.getElementById(sid); if (s) s.style.display = 'inline-block'; });

    try {
        const hostels = await apiFetch('/hostels');

        // Admin/Warden student-management dropdowns
        const adminSelects = document.querySelectorAll('#s-hostel, #w-hostel, #hostel-filter-student');
        adminSelects.forEach(sel => {
            if (!sel) return;
            const current = sel.value;
            const isFilter = sel.id === 'hostel-filter-student';
            sel.innerHTML = isFilter ? '<option value="">All Hostels</option>' : '<option value="">Select Hostel</option>';
            hostels.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.name; opt.textContent = h.name;
                sel.appendChild(opt);
            });
            sel.value = current;
        });

        // Registration: Student hostel dropdown (uses hostel id as value)
        const regHostel = document.getElementById('reg-hostel');
        if (regHostel) {
            regHostel.innerHTML = '<option value="">— Select Hostel —</option>';
            hostels.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.id;
                opt.textContent = h.name;
                regHostel.appendChild(opt);
            });
        }

        // Registration: Warden hostel dropdown (uses hostel id as value)
        const wardenHostel = document.getElementById('reg-warden-hostel');
        if (wardenHostel) {
            wardenHostel.innerHTML = '<option value="">— Select Hostel —</option>';
            hostels.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.id;
                opt.textContent = h.name;
                wardenHostel.appendChild(opt);
            });
        }

        await populateWardenDropdown();
    } catch (_) {
        // silently ignore — hostels may not be set up yet
    } finally {
        spinners.forEach(sid => { const s = document.getElementById(sid); if (s) s.style.display = 'none'; });
    }
}

async function populateWardenDropdownForHostels(currentWardenName = '') {
    const sel = document.getElementById('h-warden');
    if (!sel) return;
    try {
        const wardens = await apiFetch('/wardens');
        sel.innerHTML = '<option value="">No Warden Assigned</option>';
        wardens.forEach(w => {
            // Show only unassigned wardens OR the currently assigned one
            if (!w.hostel || w.name === currentWardenName) {
                const opt = document.createElement('option');
                opt.value = w.id;
                opt.textContent = w.name;
                sel.appendChild(opt);
            }
        });
        // Select the current one if it exists
        if (currentWardenName) {
            const currentOpt = Array.from(sel.options).find(o => o.textContent === currentWardenName);
            if (currentOpt) sel.value = currentOpt.value;
        }
    } catch (err) { console.error('Failed to populate warden dropdown:', err); }
}

async function populateWardenDropdown() {
    try {
        const wardens = await apiFetch('/wardens');
        const sel = document.getElementById('s-warden');
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">Select Warden</option>';
        wardens.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.id; opt.textContent = w.name + ' (' + (w.hostel || 'No Hostel') + ')';
            sel.appendChild(opt);
        });
        sel.value = current;
    } catch (_) { }
}

// ===================== STUDENTS =====================
let allStudents = [];

async function loadAdminStudents() {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;
    try {
        allStudents = await apiFetch('/students');
        renderStudents(allStudents);
    } catch (err) { tbody.innerHTML = `<tr class="no-data-row"><td colspan="11">Failed to load students.</td></tr>`; }
}

function renderStudents(list) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!list.length) {
        tbody.innerHTML = '<tr class="no-data-row"><td colspan="11">No students found.</td></tr>';
        return;
    }
    list.forEach(st => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${st.student_id || '—'}</td>
            <td><div style="font-weight:600;">${st.name}</div></td>
            <td>${st.email}</td>
            <td><span style="color:var(--slate-500); font-size:0.8rem;">📞</span> ${st.parent_phone || '—'}</td>
            <td>${st.department || '—'}</td>
            <td>${st.course || '—'}</td>
            <td>${st.hostel || '—'}</td>
            <td>Room ${st.room_number || '—'}</td>
            <td><div style="font-size:0.85rem; color:var(--slate-500);">${st.warden_name || 'Not Assigned'}</div></td>
            <td><span class="status-${st.is_active ? 'active' : 'inactive'}">${st.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-small btn-secondary edit-student-btn" data-id="${st.id}" title="Edit Student">✏️</button>
                    <button class="btn btn-small btn-danger del-student-btn" data-id="${st.id}" title="Delete Student">🗑️</button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

function renderWardenStudents(list) {
    const tbodies = document.querySelectorAll('#warden-students-table-body, #warden-students-body');
    if (!tbodies.length) return;
    
    tbodies.forEach(tbody => {
        tbody.innerHTML = '';
        if (!list.length) {
            tbody.innerHTML = '<tr class="no-data-row"><td colspan="10">No students found in your hostel.</td></tr>';
            return;
        }
        list.forEach(st => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${st.student_id || '—'}</td>
                <td><div style="font-weight:600;">${st.name}</div></td>
                <td>${st.email}</td>
                <td><div style="font-size:0.85rem; color:var(--slate-600);">${st.department || '—'}</div></td>
                <td>${st.course || '—'}</td>
                <td>${st.hostel || '—'}</td>
                <td><span style="color:var(--slate-500); font-size:0.8rem;">📞</span> ${st.parent_phone || '—'}</td>
                <td>Room ${st.room_number || '—'}</td>
                <td><span class="status-${st.is_active ? 'active' : 'inactive'}">${st.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-small btn-secondary edit-student-btn" data-id="${st.id}" title="Edit Student">✏️</button>
                        <button class="btn btn-small btn-danger del-student-btn" data-id="${st.id}" title="Delete Student">🗑️</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });

    // Set up search filter for warden students
    const searchInput = document.getElementById('warden-student-search');
    if (searchInput && !searchInput.dataset.bound) {
        searchInput.dataset.bound = "true";
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = list.filter(st =>
                st.name.toLowerCase().includes(q) ||
                (st.student_id && st.student_id.toLowerCase().includes(q)) ||
                (st.department && st.department.toLowerCase().includes(q)) ||
                (st.course && st.course.toLowerCase().includes(q)) ||
                (st.hostel && st.hostel.toLowerCase().includes(q))
            );
            renderWardenStudentsFiltered(filtered);
        });
    }
}

function renderWardenStudentsFiltered(list) {
    const tbodies = document.querySelectorAll('#warden-students-table-body, #warden-students-body');
    if (!tbodies.length) return;
    
    tbodies.forEach(tbody => {
        tbody.innerHTML = '';
        if (!list.length) {
            tbody.innerHTML = '<tr class="no-data-row"><td colspan="10">No matches found.</td></tr>';
            return;
        }
        list.forEach(st => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${st.student_id || '—'}</td>
                <td>${st.name}</td>
                <td>${st.email}</td>
                <td>${st.department || '—'}</td>
                <td>${st.course || '—'}</td>
                <td>${st.hostel || '—'}</td>
                <td>${st.parent_phone ? st.parent_phone.substring(0, 2) + '****' + st.parent_phone.slice(-4) : '—'}</td>
                <td>${st.room_number || '—'}</td>
                <td><span class="status-${st.is_active ? 'active' : 'inactive'}">${st.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-small btn-secondary edit-student-btn" data-id="${st.id}" title="Edit Student">
                            ✏️
                        </button>
                        <button class="btn btn-small btn-danger del-student-btn" data-id="${st.id}" title="Delete Student">
                            🗑️
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

function filterStudents() {
    const q = (document.getElementById('student-search')?.value || '').toLowerCase();
    const h = (document.getElementById('hostel-filter-student')?.value || '').toLowerCase();
    const filtered = allStudents.filter(st =>
        (!q || st.name.toLowerCase().includes(q) || (st.student_id || '').toLowerCase().includes(q)) &&
        (!h || (st.hostel || '').toLowerCase() === h)
    );
    renderStudents(filtered);
}



function openAddStudent() {
    document.getElementById('student-modal-title').textContent = 'Add New Student';
    const submitBtn = document.getElementById('student-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Add Student';

    const editIdEl = document.getElementById('student-edit-id') || document.getElementById('edit-student-id');
    if (editIdEl) editIdEl.value = '';

    const form = document.getElementById('student-form');
    if (form) form.reset();

    // Ensure password is required for new student
    const pwdEl = document.getElementById('s-password');
    if (pwdEl) pwdEl.required = true;

    openModal('student-modal');
}

function openEditStudent(id) {
    const st = allStudents.find(s => s.id == id);
    if (!st) return;
    const user = getCurrentUser();

    document.getElementById('student-modal-title').textContent = 'Edit Student';
    const submitBtn = document.getElementById('student-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    const editIdEl = document.getElementById('student-edit-id') || document.getElementById('edit-student-id');
    if (editIdEl) editIdEl.value = st.id;

    if (document.getElementById('s-name')) document.getElementById('s-name').value = st.name;
    if (document.getElementById('s-student-id')) document.getElementById('s-student-id').value = st.student_id || '';
    if (document.getElementById('s-email')) document.getElementById('s-email').value = st.email;
    if (document.getElementById('s-dept')) document.getElementById('s-dept').value = st.department || '';
    if (document.getElementById('s-course')) document.getElementById('s-course').value = st.course || '';
    if (document.getElementById('s-room')) document.getElementById('s-room').value = st.room_number || '';
    if (document.getElementById('s-hostel')) document.getElementById('s-hostel').value = st.hostel || '';

    const wardenSel = document.getElementById('s-warden');
    if (wardenSel) wardenSel.value = st.warden_id || '';

    const phoneEl = document.getElementById('s-parent-phone');
    if (phoneEl) phoneEl.value = st.parent_phone || '';

    // Password not required for edit
    const pwdEl = document.getElementById('s-password');
    if (pwdEl) {
        pwdEl.required = false;
        pwdEl.value = '';
    }

    openModal('student-modal');
}

async function handleStudentForm(e) {
    e.preventDefault();
    const editIdEl = document.getElementById('student-edit-id') || document.getElementById('edit-student-id');
    const id = editIdEl ? editIdEl.value : '';
    const user = getCurrentUser();

    const payload = {
        name: document.getElementById('s-name').value.trim(),
        studentId: (document.getElementById('s-student-id') || document.getElementById('s-studentId')).value.trim(),
        email: document.getElementById('s-email').value.trim(),
        department: (document.getElementById('s-dept') || document.getElementById('s-department'))?.value?.trim() || '',
        course: (document.getElementById('s-course') || document.getElementById('s-reg-course'))?.value?.trim() || '',
        hostel: document.getElementById('s-hostel')?.value || '',
        roomNumber: document.getElementById('s-room').value.trim(),
        wardenId: document.getElementById('s-warden')?.value || null
    };

    // Warden dashboard: include parent phone; Admin dashboard: no password on edit
    const phoneEl = document.getElementById('s-parent-phone');
    if (phoneEl) {
        const phone = phoneEl.value.trim();
        if (phone && !/^\d{10}$/.test(phone)) {
            showMsg('Parent phone must be a 10-digit number.', 'error');
            return;
        }
        if (phone) payload.parentPhone = phone;
    }

    try {
        if (id) {
            await apiFetch(`/students/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            showMsg('Student updated!', 'success');
        } else {
            // New student (admin only): password required
            const pwdEl = document.getElementById('s-password');
            const password = pwdEl ? pwdEl.value : '';
            if (!password) { showMsg('Password required for new student', 'error'); return; }
            payload.password = password;
            await apiFetch('/students', { method: 'POST', body: JSON.stringify(payload) });
            showMsg('Student added!', 'success');
        }
        closeModal('student-modal');
        if (user && user.role === 'admin') {
            await loadAdminStudents();
            await loadAdminStats();
        } else if (user && user.role === 'warden') {
            await loadWardenData();
        }
    } catch (err) { showMsg(err.message, 'error'); }
}

async function deleteStudent(id) {
    showConfirm("Delete Student", "Are you sure you want to permanently delete this student record?", async () => {
        try {
            await apiFetch(`/students/${id}`, { method: 'DELETE' });
            showMsg('Student deleted.', 'success');
            const user = getCurrentUser();
            if (user && user.role === 'admin') {
                await loadAdminStudents();
                await loadAdminStats();
            } else if (user && user.role === 'warden') {
                await loadWardenData();
            }
        } catch (err) {
            showMsg(err.message, 'error');
        }
    });
}

// ===================== WARDENS =====================
let allWardens = [];

async function loadAdminWardens() {
    const tbody = document.getElementById('wardens-table-body');
    if (!tbody) return;
    try {
        allWardens = await apiFetch('/wardens');
        renderWardens(allWardens);
    } catch (err) {
        tbody.innerHTML = `<tr class="no-data-row"><td colspan="5">Failed to load wardens.</td></tr>`;
    }
}

function renderWardens(list) {
    const tbody = document.getElementById('wardens-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!list.length) {
        tbody.innerHTML = '<tr class="no-data-row"><td colspan="5">No wardens found. Add one above!</td></tr>';
        return;
    }

    list.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><div style="font-weight:600;">${w.name}</div></td>
            <td>${w.email}</td>
            <td><span style="color:var(--slate-500); font-size:0.8rem;">📞</span> ${w.phone || '—'}</td>
            <td>${w.hostel || '—'}</td>
            <td><span class="status-${w.is_active ? 'active' : 'inactive'}">${w.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="table-actions">
                    <button class="btn btn-small btn-secondary edit-warden-btn" data-id="${w.id}" title="Edit Warden">✏️</button>
                    <button class="btn btn-small btn-danger del-warden-btn" data-id="${w.id}" title="Delete Warden">🗑️</button>
                </div>
            </td>`;

        tbody.appendChild(tr);
    });
}



function openAddWarden() {
    document.getElementById('warden-modal-title').textContent = 'Add New Warden';
    const submitBtn = document.getElementById('warden-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Add Warden';

    const editIdEl = document.getElementById('edit-warden-id');
    if (editIdEl) editIdEl.value = '';

    const form = document.getElementById('warden-form');
    if (form) form.reset();

    const pwdEl = document.getElementById('w-password');
    if (pwdEl) pwdEl.required = true;

    openModal('warden-modal');
}

function openEditWarden(id) {
    const w = allWardens.find(x => x.id == id);
    if (!w) return;
    document.getElementById('warden-modal-title').textContent = 'Edit Warden';
    const submitBtn = document.getElementById('warden-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    document.getElementById('edit-warden-id').value = w.id;
    document.getElementById('w-name').value = w.name;
    document.getElementById('w-email').value = w.email;
    document.getElementById('w-hostel').value = w.hostel || '';

    const pwdEl = document.getElementById('w-password');
    if (pwdEl) {
        pwdEl.required = false;
        pwdEl.value = '';
    }
    openModal('warden-modal');
}

async function handleWardenForm(e) {
    e.preventDefault();
    const id = document.getElementById('edit-warden-id').value;
    const payload = {
        name: document.getElementById('w-name').value.trim(),
        email: document.getElementById('w-email').value.trim(),
        hostel: document.getElementById('w-hostel').value.trim(),
        phone: document.getElementById('w-phone').value.trim()
    };

    try {
        const url = id ? `/wardens/${id}` : '/wardens';
        const method = id ? 'PUT' : 'POST';
        await apiFetch(url, { method, body: JSON.stringify(payload) });

        showMsg(`Warden ${id ? 'updated' : 'added'} successfully!`, 'success');
        closeModal('warden-modal');
        await loadAdminWardens();
        if (typeof loadAdminStats === 'function') await loadAdminStats();
    } catch (err) { showMsg(err.message, 'error'); }
}

async function deleteWarden(id) {
    showConfirm("Delete Warden", "Are you sure you want to remove this warden?", async () => {
        try {
            await apiFetch(`/wardens/${id}`, { method: 'DELETE' });
            showMsg('Warden deleted successfully', 'success');
            await loadAdminWardens();
            if (typeof loadAdminStats === 'function') await loadAdminStats();
        } catch (err) { showMsg(err.message, 'error'); }
    });
}

// ===================== HOSTEL MANAGEMENT =====================
let allHostels = [];

async function loadAdminHostels() {
    const tbody = document.getElementById('hostels-table-body');
    if (!tbody) return;
    try {
        allHostels = await apiFetch('/hostels');
        renderHostels(allHostels);
    } catch (err) { tbody.innerHTML = `<tr class="no-data-row"><td colspan="6">Failed to load hostels.</td></tr>`; }
}

function renderHostels(list) {
    const tbody = document.getElementById('hostels-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!list.length) {
        tbody.innerHTML = '<tr class="no-data-row"><td colspan="6">No hostels found. Add one above!</td></tr>';
        return;
    }
    list.forEach(h => {
        const tr = document.createElement('tr');
        // Use textContent for safety and set dataset properties explicitly
        tr.innerHTML = `
            <td>${h.name}</td>
            <td><span class="hostel-type-badge ${h.type}">${h.type}</span></td>
            <td>${h.capacity ?? '—'}</td>
            <td>${h.location || '—'}</td>
            <td>${h.warden_name || 'Not Assigned'}</td>
            <td><span class="status-${h.is_active ? 'active' : 'inactive'}">${h.is_active ? 'Active' : 'Inactive'}</span></td>
            <td><div class="table-actions">
                <button class="btn btn-small btn-secondary edit-hostel-btn" data-id="${h.id}">Edit</button>
                <button class="btn btn-small btn-danger del-hostel-btn" data-id="${h.id}">Delete</button>
            </div></td>`;
        tbody.appendChild(tr);
    });
}

function openAddHostel() {
    document.getElementById('hostel-modal-title').textContent = 'Add New Hostel';
    const submitBtn = document.getElementById('hostel-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Add Hostel';

    const editIdEl = document.getElementById('hostel-edit-id') || document.getElementById('edit-hostel-id');
    if (editIdEl) editIdEl.value = '';

    const form = document.getElementById('hostel-form');
    if (form) form.reset();
    populateWardenDropdownForHostels(); // New call
    openModal('hostel-modal');
}

function openEditHostel(id) {
    if (!id) return;
    // Robust find: handles both string/number IDs and ensures allHostels is valid
    const h = (allHostels || []).find(x => String(x.id) === String(id));
    if (!h) {
        console.warn('[Debug] Hostel not found in cache, ID:', id);
        showMsg("Could not find hostel data. Please refresh.", "error");
        return;
    }
    document.getElementById('hostel-modal-title').textContent = 'Edit Hostel';
    document.getElementById('hostel-submit-btn').textContent = 'Save Changes';

    const editIdEl = document.getElementById('edit-hostel-id') || document.getElementById('hostel-edit-id');
    if (editIdEl) editIdEl.value = h.id;
    document.getElementById('h-name').value = h.name;
    document.getElementById('h-type').value = h.type;
    document.getElementById('h-capacity').value = h.capacity || '';
    document.getElementById('h-location').value = h.location || '';
    
    // Populate wardens and select the assigned one
    populateWardenDropdownForHostels(h.warden_name);
    
    openModal('hostel-modal');
}

async function handleHostelForm(e) {
    e.preventDefault();
    try {
        const editIdEl = document.getElementById('hostel-edit-id') || document.getElementById('edit-hostel-id');
        const id = editIdEl ? editIdEl.value : '';

        const nameEl = document.getElementById('h-name');
        const typeEl = document.getElementById('h-type');
        const capEl = document.getElementById('h-capacity');
        const locEl = document.getElementById('h-location');
        const wardenEl = document.getElementById('h-warden');

        if (!nameEl || !typeEl) {
            console.error('[Error] Required form elements missing');
            return;
        }

        const payload = {
            name: nameEl.value.trim(),
            type: typeEl.value,
            capacity: capEl ? capEl.value || null : null,
            location: locEl ? locEl.value.trim() : '',
            warden_id: wardenEl ? wardenEl.value || null : null
        };

        if (!payload.name || !payload.type) {
            showMsg('Please fill all required fields', 'error');
            return;
        }

        showMsg(id ? 'Updating hostel...' : 'Adding hostel...', 'info');

        if (id) {
            await apiFetch(`/hostels/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            showMsg('Hostel updated!', 'success');
        } else {
            await apiFetch('/hostels', { method: 'POST', body: JSON.stringify(payload) });
            showMsg('Hostel added!', 'success');
        }
        closeModal('hostel-modal');
        await loadAdminHostels();
        await loadAdminStats();
        await populateHostelDropdowns();
    } catch (err) {
        console.error('[Hostel Form Error]', err);
        showMsg(err.message || 'Failed to save hostel', 'error');
    }
}

async function deleteHostel(id) {
    showConfirm("Delete Hostel", "Are you sure you want to delete this hostel? All associated data will be affected.", async () => {
        try {
            await apiFetch(`/hostels/${id}`, { method: 'DELETE' });
            showMsg('Hostel deleted.', 'success');
            await loadAdminHostels();
            await loadAdminStats();
        } catch (err) {
            showMsg(err.message, 'error');
        }
    });
}

// ===================== ADMIN SETTINGS =====================
async function loadAdminSettings() {
    try {
        const s = await apiFetch('/settings');
        const map = {
            'max_leave_duration': 'max-leave-duration', 'auto_approve_short_leaves': 'auto-approve-short',
            'email_notifications': 'email-notifications', 'maintenance_mode': 'maintenance-mode'
        };
        for (const [k, elId] of Object.entries(map)) {
            const el = document.getElementById(elId);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = s[k] === 'true';
            else el.value = s[k];
        }
    } catch (_) { }
}

async function saveAdminSettings() {
    try {
        const payload = {
            max_leave_duration: document.getElementById('max-leave-duration')?.value,
            auto_approve_short_leaves: String(document.getElementById('auto-approve-short')?.checked),
            email_notifications: String(document.getElementById('email-notifications')?.checked),
            maintenance_mode: String(document.getElementById('maintenance-mode')?.checked)
        };
        await apiFetch('/settings', { method: 'PUT', body: JSON.stringify(payload) });
        showMsg('Settings saved!', 'success');
    } catch (err) { showMsg(err.message, 'error'); }
}



// ===================== MODAL CLOSE HANDLERS =====================
function setupModals() {
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    window.addEventListener('click', e => {
        document.querySelectorAll('.modal').forEach(m => {
            if (e.target === m) m.style.display = 'none';
        });
    });
}

async function loadAdminData() {
    await populateHostelDropdowns();
    await loadAdminStats();
    await loadLeaveRecords('admin');
    await loadActiveLeaves();
    await loadAdminStudents();
    await loadAdminWardens();
    await loadAdminHostels();
    await loadAdminSettings();
}

// ===================== ADMIN DASHBOARD INIT =====================
async function initAdminDashboard() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') return;

    setupModals();
    await loadAdminData();

    // Refresh
    document.getElementById('refresh-requests')?.addEventListener('click', async () => {
        await loadLeaveRecords('admin'); showMsg('Refreshed', 'success');
    });

    // Filtering
    document.getElementById('leave-search')?.addEventListener('input', () => filterLeaveRecords('admin'));
    document.getElementById('leave-status-filter')?.addEventListener('change', () => filterLeaveRecords('admin'));
    document.getElementById('leave-date-filter')?.addEventListener('change', () => filterLeaveRecords('admin'));
    document.getElementById('admin-visibility-filter')?.addEventListener('change', () => loadLeaveRecords('admin'));

    // Admin Active Leaves Search
    document.getElementById('admin-active-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#admin-current-leaves-list .active-leave-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? '' : 'none';
        });
    });

    // Student
    document.getElementById('add-student-btn')?.addEventListener('click', openAddStudent);
    document.getElementById('student-form')?.addEventListener('submit', handleStudentForm);
    document.getElementById('student-search')?.addEventListener('input', filterStudents);
    document.getElementById('hostel-filter-student')?.addEventListener('change', filterStudents);

    // Warden
    document.getElementById('add-warden-btn')?.addEventListener('click', openAddWarden);
    document.getElementById('warden-form')?.addEventListener('submit', handleWardenForm);

    // Hostel
    document.getElementById('add-hostel-btn')?.addEventListener('click', openAddHostel);
    document.getElementById('hostel-form')?.addEventListener('submit', handleHostelForm);

    // Settings
    document.getElementById('save-settings')?.addEventListener('click', saveAdminSettings);
    initContactSettingsAdmin();

    document.getElementById('reset-settings')?.addEventListener('click', () => {
        showConfirm("Reset Settings", "Are you sure you want to reset all system settings to defaults?", async () => {
            // Logic to reset UI elements
            const emailNotif = document.getElementById('email-notifications');
            const autoApprove = document.getElementById('auto-approve-short');
            const maintenance = document.getElementById('maintenance-mode');
            const maxDuration = document.getElementById('max-leave-duration');

            if (emailNotif) emailNotif.checked = true;
            if (autoApprove) autoApprove.checked = false;
            if (maintenance) maintenance.checked = false;
            if (maxDuration) maxDuration.value = '14';

            showMsg('Settings reset in UI. Click Save to apply.', 'info');
        });
    });

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

}

async function loadWardenData() {
    // Load Warden Profile Info
    try {
        const profile = await apiFetch('/profile');
        const badge = document.querySelector('.hostel-badge');
        const name = document.querySelector('.warden-name');
        if (badge) badge.textContent = profile.hostel || 'No Hostel Assigned';
        if (name) name.textContent = 'Warden: ' + profile.name;
    } catch (err) { console.error('Warden profile load error:', err); }

    // Pre-populate dropdowns for student edit modal
    await populateHostelDropdowns();
    await loadAdminWardens();

    try {
        const stats = await apiFetch('/stats');
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('hostel-students', stats.hostel_students ?? 0);
        set('warden-pending', stats.pending_requests ?? 0);
        set('warden-approved', stats.approved_today ?? 0);
        set('current-leaves', stats.hostel_requests ?? 0);
    } catch (_) { }

    try {
        const all = await apiFetch('/leave-requests');
        const history = await apiFetch('/leave-requests?filter=6months');
        allLeaveRecords = all; // Store for history

        // Render Warden's Students
        try {
            const myStudents = await apiFetch('/students');
            allStudents = myStudents; // Store globally for edit modal
            renderWardenStudents(myStudents);
        } catch (e) { console.error('Failed to load warden students:', e); }

        // 1. Render Pending (as a Table)
        const pending = all.filter(r => r.status === 'pending');
        const container = document.getElementById('warden-pending-requests-list');
        if (container) {
            container.innerHTML = '';
            if (!pending.length) {
                container.innerHTML = '<p style="text-align:center;padding:20px;color:#999">No pending requests</p>';
            } else {
                let tableHTML = `
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Name</th>
                                    <th>Enrollment ID</th>
                                    <th>Dept</th>
                                    <th>Course</th>
                                    <th>Room</th>
                                    <th>Duration</th>
                                    <th>Reason</th>
                                    <th>Parent No.</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="warden-pending-table-body">
                `;

                pending.forEach((req, index) => {
                    const s = req.student;
                    tableHTML += `
                        <tr class="pending-request-row" data-id="${req.id}">
                            <td>${index + 1}</td>
                            <td style="font-weight:600;">${s.name}</td>
                            <td>${s.student_id || '—'}</td>
                            <td><div style="font-size:0.8rem; color:var(--slate-600);">${s.department || '—'}</div></td>
                            <td>${s.course || '—'}</td>
                            <td><span class="status-pill status-active">Room ${s.room_number || '—'}</span></td>
                            <td style="font-size:0.85rem; min-width:140px; color:var(--text-main);">${formatDate(req.start_date)} <span style="color:var(--text-muted);"> → </span> ${formatDate(req.end_date)}</td>
                            <td style="color:var(--text-main);">${req.reason || '—'}</td>
                            <td style="color:var(--danger); font-weight:600;">${s.parent_phone || req.emergency_contact || 'N/A'}</td>
                            <td>
                                <div class="table-actions">
                                    <button class="btn btn-small btn-secondary view-leave-btn" data-id="${req.id}" title="View Details">👁️</button>
                                    <button class="btn btn-small btn-primary approve-btn" data-id="${req.id}" title="Approve">✅</button>
                                    <button class="btn btn-small btn-danger reject-btn" data-id="${req.id}" title="Reject">❌</button>
                                </div>
                            </td>
                        </tr>
                    `;
                });

                tableHTML += `</tbody></table></div>`;
                container.innerHTML = tableHTML;
            }
        }
        // 2. Render History (Last 6 Months)
        renderLeaveRecords(history, 'warden');
        await loadActiveLeaves();
    } catch (err) { console.error('Warden records error:', err); }
}

async function loadActiveLeaves() {
    const containers = document.querySelectorAll('.current-leaves-list');
    if (!containers.length) return;
    try {
        const activeLeaves = await apiFetch('/leave-requests/active');
        containers.forEach(container => {
            container.innerHTML = '';
            if (!activeLeaves.length) {
                container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted); font-size:0.95rem;">No students currently on leave</p>';
                return;
            }
            let tableHTML = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>S.No</th>
                                <th>Name</th>
                                <th>Dept</th>
                                <th>Course</th>
                                <th>Hostel</th>
                                <th>Enrollment ID</th>
                                <th>Email</th>
                                <th>Room</th>
                                <th>Student No.</th>
                                <th>Parent No.</th>
                                <th>Expected Return</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            activeLeaves.forEach((req, index) => {
                tableHTML += `
                    <tr class="active-leave-item">
                        <td>${index + 1}</td>
                        <td style="font-weight: 600; color: var(--text-main);">${req.student_name}</td>
                        <td style="font-size: 0.85rem;">${req.department || 'N/A'}</td>
                        <td style="font-size: 0.85rem;">${req.course || 'N/A'}</td>
                        <td style="font-size: 0.85rem;">${req.hostel || 'N/A'}</td>
                        <td>${req.enrollment || 'N/A'}</td>
                        <td>${req.student_email || 'N/A'}</td>
                        <td><span class="status-pill status-active">Room ${req.room_number || 'N/A'}</span></td>
                        <td>${req.student_phone || 'N/A'}</td>
                        <td>${req.parent_contact || 'N/A'}</td>
                        <td style="color: var(--warning); font-weight: 600;">${formatDate(req.end_date)}</td>
                    </tr>
                `;
            });

            tableHTML += `</tbody></table></div>`;
            container.innerHTML = tableHTML;
        });
    } catch (err) {
        containers.forEach(c => c.innerHTML = '<p style="color:var(--danger); text-align:center; font-weight:500;">Failed to load active leaves.</p>');
    }
}

// ===================== WARDEN DASHBOARD =====================
async function initWardenDashboard() {
    const user = getCurrentUser();
    if (!user || (user.role !== 'warden' && user.role !== 'admin')) return;

    await populateHostelDropdowns(); // Populate s-hostel + s-warden for edit modal
    await loadWardenData();

    document.getElementById('warden-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);

    // Refresh warden requests
    document.getElementById('refresh-warden-requests')?.addEventListener('click', async () => {
        await loadWardenData();
        showMsg('Refreshed!', 'success');
    });

    // Warden Quick Actions
    document.getElementById('bulk-approve')?.addEventListener('click', () => {
        const pending = typeof allLeaveRecords !== 'undefined' ? allLeaveRecords.filter(r => r.status === 'pending') : [];
        if (!pending.length) {
            showMsg('No pending requests to approve.', 'info');
            return;
        }
        const container = document.getElementById('bulk-requests-list');
        if (container) {
            container.innerHTML = pending.map(req => `
                <div style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                        <input type="checkbox" class="bulk-approve-checkbox" value="${req.id}" checked>
                        <span><strong>${req.student.name}</strong> - ${req.start_date} to ${req.end_date}</span>
                    </label>
                </div>
            `).join('');
            openModal('bulk-approve-modal');
        }
    });

    document.getElementById('confirm-bulk-approve')?.addEventListener('click', async () => {
        const checked = Array.from(document.querySelectorAll('.bulk-approve-checkbox:checked')).map(cb => cb.value);
        if (!checked.length) { showMsg('No requests selected.', 'error'); return; }

        try {
            showMsg('Approving selected requests...', 'info');
            await apiFetch('/leave-requests/bulk-approve', {
                method: 'PUT',
                body: JSON.stringify({ request_ids: checked })
            });
            showMsg('Requests approved successfully!', 'success');
            closeModal('bulk-approve-modal');
            await loadWardenData();
        } catch (err) { showMsg(err.message, 'error'); }
    });

    document.getElementById('cancel-bulk')?.addEventListener('click', () => closeModal('bulk-approve-modal'));

    document.getElementById('contact-student')?.addEventListener('click', () => {
        const content = document.getElementById('contact-student-info');
        if (content) content.innerHTML = '<p style="color:var(--text-muted); margin-bottom: 20px; font-size:0.95rem;">Enter details to broadcast a message, or record a communication log.</p>';
        openModal('contact-modal');
    });
    document.getElementById('cancel-contact')?.addEventListener('click', () => closeModal('contact-modal'));
    document.getElementById('contact-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        showMsg('Message sent successfully!', 'success');
        closeModal('contact-modal');
        e.target.reset();
    });

    const scrollToHistory = () => {
        const hist = document.getElementById('warden-history-body');
        if (hist) hist.closest('.admin-section').scrollIntoView({ behavior: 'smooth' });
    };
    document.getElementById('leave-history')?.addEventListener('click', scrollToHistory);
    document.getElementById('view-all-leaves')?.addEventListener('click', scrollToHistory);
    document.getElementById('admin-view-all-leaves')?.addEventListener('click', () => {
        const hist = document.getElementById('leave-records-body');
        if (hist) hist.closest('.admin-section').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('view-full-log')?.addEventListener('click', () => {
        showMsg('Activity log is fully loaded.', 'info');
    });

    document.getElementById('emergency-leave')?.addEventListener('click', () => {
        showMsg('Emergency Leave: To grant emergency leave, please ask student to apply and it will be prioritized.', 'info');
    });

    document.getElementById('extend-leave')?.addEventListener('click', () => {
        showMsg('Extend Leave: Feature coming soon. For now, request student to submit a new leave for the extended dates.', 'info');
    });

    // Warden Filtering
    document.getElementById('warden-leave-search')?.addEventListener('input', () => filterLeaveRecords('warden'));
    document.getElementById('warden-leave-status-filter')?.addEventListener('change', () => filterLeaveRecords('warden'));
    document.getElementById('warden-leave-date-filter')?.addEventListener('change', () => filterLeaveRecords('warden'));
    document.getElementById('warden-visibility-filter')?.addEventListener('change', () => loadLeaveRecords('warden'));

    // Warden Pending Leave Search
    document.getElementById('warden-pending-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#warden-pending-table-body .pending-request-row').forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    });

    // Warden Active Leaves Search
    document.getElementById('warden-active-search')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#warden-current-leaves-list .active-leave-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(term) ? '' : 'none';
        });
    });

    // Warden Actions (Approve/Reject)
    document.addEventListener('click', async e => {
        const btn = e.target.closest('.approve-btn, .reject-btn');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.classList.contains('approve-btn') ? 'approve' : 'reject';
        const remarks = action === 'reject' ? prompt('Enter reason for rejection:') : 'Approved by Warden';

        if (action === 'reject' && remarks === null) return; // Cancelled prompt

        try {
            showMsg(`${action === 'approve' ? 'Approving' : 'Rejecting'} request...`, 'info');
            await apiFetch(`/leave-requests/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ action, remarks: remarks || '' })
            });
            showMsg(`Request ${action}d successfully!`, 'success');
            await loadWardenData(); // Refresh
        } catch (err) { showMsg(err.message, 'error'); }
    });

    document.getElementById('student-form')?.addEventListener('submit', handleStudentForm);
    setupModals();
}

async function loadStudentData() {
    const user = getCurrentUser();
    if (!user || user.role !== 'student') return;

    // Load Profile
    try {
        const profile = await apiFetch('/profile');
        const welcome = document.getElementById('student-welcome');
        if (welcome) welcome.textContent = `Welcome, ${profile.name}!`;
        const hostelBadge = document.getElementById('student-hostel-badge');
        if (hostelBadge) hostelBadge.textContent = profile.hostel || 'No Hostel Assigned';
        const roomBadge = document.getElementById('student-room-badge');
        if (roomBadge) roomBadge.textContent = `Room: ${profile.room_number || '--'}`;
    } catch (err) { console.error('Profile load error:', err); }

    // Load History & Stats
    try {
        const vis = document.getElementById('student-visibility-filter')?.value || 'active';
        const requests = await apiFetch(`/leave-requests?visibility=${vis}`);
        window.lastStudentRequests = requests; // Cache for detail view
        const tbody = document.getElementById('history-table-body');
        if (tbody) {
            tbody.innerHTML = '';
            if (!requests.length) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted); font-style:italic; font-size:0.9rem;">No leave history found.</td></tr>';
            } else {
                [...requests].reverse().forEach(req => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input type="checkbox" class="leave-checkbox" value="${req.id}"></td>
                        <td style="font-weight:600;">${formatDate(req.start_date)} <span style="font-weight:normal; color:var(--slate-500);">to</span> ${formatDate(req.end_date)}</td>
                        <td title="${req.reason}" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${req.reason}</td>
                        <td><span class="status-${req.status}">${req.status.toUpperCase()}</span></td>
                        <td style="font-size:0.8rem; color:var(--slate-500);">${req.remarks || '—'}</td>
                        <td style="font-size:0.8rem; color:var(--slate-500);">${formatDateTime(req.submitted_at)}</td>
                        <td>
                            <div class="table-actions">
                                <button class="btn btn-secondary view-leave-btn" data-id="${req.id}" title="View Details" style="padding: 6px 12px;" onclick="showLeaveDetailsModal('${req.id}')">👁️ View</button>
                                ${vis === 'hidden'
                            ? `<button class="btn btn-small btn-success restore-leave-btn" data-id="${req.id}" title="Restore My Request">⟲</button>`
                            : `<button class="btn btn-small btn-danger del-leave-btn" data-id="${req.id}" title="Delete My Request">🗑️</button>`
                        }
                            </div>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        // Stats
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setVal('total-requests', requests.length);
        setVal('pending-count', requests.filter(r => r.status === 'pending').length);
        setVal('approved-count', requests.filter(r => r.status === 'approved').length);
        setVal('rejected-count', requests.filter(r => r.status === 'rejected').length);

    } catch (err) { console.error('History load error:', err); }
}

// ===================== STUDENT DASHBOARD =====================
async function initStudentDashboard() {
    const user = getCurrentUser();
    if (!user || user.role !== 'student') return;

    await loadStudentData();

    // Form Submission
    const form = document.getElementById('leave-request-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const startDate = document.getElementById('start-date').value;
            const endDate = document.getElementById('end-date').value;

            // Validation: End date cannot be before start date
            if (new Date(endDate) < new Date(startDate)) {
                showMsg('Error: End Date cannot be before Start Date', 'error');
                return;
            }

            const payload = {
                start_date: startDate,
                end_date: endDate,
                reason: document.getElementById('reason').value.trim(),
                emergency_contact: document.getElementById('emergency-contact').value.trim()
            };

            try {
                showMsg('Submitting request...', 'info');
                await apiFetch('/leave-requests', { method: 'POST', body: JSON.stringify(payload) });
                showMsg('Leave request submitted successfully!', 'success');
                form.reset();
                await loadStudentData();
            } catch (err) { showMsg(err.message, 'error'); }
        });
    }

    document.getElementById('refresh-history')?.addEventListener('click', loadStudentData);
    document.getElementById('student-visibility-filter')?.addEventListener('change', loadStudentData);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
}

// ===================== LOGIN / REGISTER =====================
function initLoginPage() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (page === 'login.html') {
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.addEventListener('submit', handleLogin);

        const registerForm = document.getElementById('register-form');
        if (registerForm) registerForm.addEventListener('submit', handleRegister);

        const otpForm = document.getElementById('otp-form');
        if (otpForm) otpForm.addEventListener('submit', handleVerifyOTP);

        const forgotForm = document.getElementById('forgot-password-form');
        if (forgotForm) forgotForm.addEventListener('submit', handleForgotPassword);

        // Populate hostel dropdowns for registration using plain fetch
        // (User is not logged in yet, so we can't use apiFetch which requires session)
        _loadRegistrationHostels();
    }
}

async function _loadRegistrationHostels() {
    const hostelSpinner = document.getElementById('hostel-spinner');
    const wardenHostelSpinner = document.getElementById('warden-hostel-spinner');
    if (hostelSpinner) hostelSpinner.style.display = 'inline-block';
    if (wardenHostelSpinner) wardenHostelSpinner.style.display = 'inline-block';

    try {
        const res = await fetch(`${API_URL}/api/hostels`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const hostels = await res.json();
        console.log(`[Hostels] Loaded ${hostels.length} hostels for registration`, hostels);

        // Student hostel dropdown — value = hostel.id (integer)
        const regHostel = document.getElementById('reg-hostel');
        if (regHostel) {
            regHostel.innerHTML = '<option value="">— Select Hostel —</option>';
            hostels.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.id;          // <-- hostel ID, NOT name
                opt.textContent = h.name;
                regHostel.appendChild(opt);
            });
        }

        // Warden hostel dropdown — value = hostel.id (integer)
        const wardenHostel = document.getElementById('reg-warden-hostel');
        if (wardenHostel) {
            wardenHostel.innerHTML = '<option value="">— Select Hostel —</option>';
            hostels.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.id;          // <-- hostel ID, NOT name
                opt.textContent = h.name;
                wardenHostel.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('[Hostels] Failed to load hostels for registration:', err);
        const regHostel = document.getElementById('reg-hostel');
        if (regHostel) regHostel.innerHTML = '<option value="">⚠️ Could not load hostels — retry page</option>';
    } finally {
        if (hostelSpinner) hostelSpinner.style.display = 'none';
        if (wardenHostelSpinner) wardenHostelSpinner.style.display = 'none';
    }
}


// ===================== NAVIGATION =====================
function navigateTo(sectionId) {
    console.log('[Nav] Navigating to:', sectionId);
    // Hide all sections
    document.querySelectorAll('.content-section, .admin-section').forEach(s => {
        s.classList.remove('active-section');
        if (s.style.display === 'block') s.style.display = 'none';
    });
    // Show target
    const target = document.getElementById('section-' + sectionId);
    if (target) {
        target.classList.add('active-section');
        if (target.style.display === 'none') target.style.display = 'block';
    } else {
        console.warn('[Nav] Section not found:', sectionId);
    }

    // Update nav active state
    document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    // Update URL hash
    history.replaceState(null, '', '#' + sectionId);

    // UI cleanups
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const dashMain = document.getElementById('dash-main');

    if (window.innerWidth <= 900) {
        sidebar?.classList.remove('mobile-open');
        overlay?.classList.remove('active');
        toggleBtn?.classList.remove('open');
    }

    if (dashMain) dashMain.scrollTop = 0;
}


// ===================== UNIFIED DASHBOARD SYSTEM =====================

const ICONS = {
    home: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    apply: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/><path d="m15 5 3 3"/></svg>`,
    history: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    users: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    hostel: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 7v14"/><path d="M21 7v14"/><path d="M12 2v5"/><path d="M7 2h10"/><path d="M9 22v-4h6v4"/></svg>`,
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
    activity: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
    quick: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-2 10h8L7 22l2-10H1L13 2z"/></svg>`,
    pending: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    leave: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
};

const DASHBOARD_CONFIG = {
    student: {
        menu: [
            { id: 'apply-leave', label: 'Apply for Leave', icon: ICONS.apply },
            { id: 'leave-history', label: 'My Leave History', icon: ICONS.history }
        ],
        stats: [
            { id: 'total-requests', label: 'Total Requests', icon: '📋' },
            { id: 'pending-count', label: 'Pending', icon: '⏳' },
            { id: 'approved-count', label: 'Approved', icon: '✅' }
        ]
    },
    admin: {
        menu: [
            { id: 'students-on-leave', label: 'Students on Leave', icon: ICONS.leave },
            { id: 'leave-records', label: 'Leave Records & History', icon: ICONS.history },
            { id: 'manage-students', label: 'Manage Students', icon: ICONS.users },
            { id: 'manage-wardens', label: 'Manage Wardens', icon: ICONS.users },
            { id: 'manage-hostels', label: 'Manage Hostels', icon: ICONS.hostel },
            { id: 'settings', label: 'System Settings', icon: ICONS.settings }
        ],
        stats: [
            { id: 'admin-total-students', label: 'Total Students', icon: '👥' },
            { id: 'admin-total-wardens', label: 'Total Wardens', icon: '🏫' },
            { id: 'admin-total-hostels', label: 'Total Hostels', icon: '🏠' }
        ]
    },
    warden: {
        menu: [
            { id: 'warden-pending', label: 'Pending Requests', icon: ICONS.pending },
            { id: 'warden-students', label: 'Students in My Hostel', icon: ICONS.users },
            { id: 'warden-active', label: 'Students on Leave', icon: ICONS.leave },
            { id: 'warden-history', label: 'Leave History', icon: ICONS.history },
            { id: 'warden-quick', label: 'Quick Actions', icon: ICONS.quick },
            { id: 'warden-recent', label: 'Recent Activity', icon: ICONS.activity }
        ],
        stats: [
            { id: 'wstat-students', label: 'Students in Hostel', icon: '👥' },
            { id: 'wstat-pending', label: 'Pending Approvals', icon: '⏳' },
            { id: 'wstat-active', label: 'Currently on Leave', icon: '🏃' }
        ]
    }
};


async function initUnifiedDashboard() {
    const dashboardWrapper = document.querySelector('.dashboard-wrapper');
    if (!dashboardWrapper || !window.location.pathname.includes('dashboard.html')) return;

    const user = getCurrentUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Verify session with backend to prevent 401s
    const sessionData = await checkSession();
    if (!sessionData) {
        showMsg('Session expired. Please login again.', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        return;
    }

    console.log('[Dashboard] Initializing unified dashboard for', user.role);

    // 1. Set Identity Info
    const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setVal('nav-username', user.name);
    setVal('nav-role', user.role.toUpperCase());
    setVal('nav-avatar', initials);
    setVal('sb-avatar-large', initials);
    setVal('sb-name', user.name);
    setVal('sb-role', user.role.toUpperCase());

    // 2. Render Sidebar Menu
    const navContainer = document.getElementById('sidebar-nav-container');
    const roleConfig = DASHBOARD_CONFIG[user.role];
    if (roleConfig) {
        let menuHtml = '<div class="sidebar-section-label">Main Menu</div><nav class="sidebar-nav">';
        roleConfig.menu.forEach(item => {
            menuHtml += `
                <button class="nav-item" data-section="${item.id}" data-tooltip="${item.label}">
                    <span class="nav-icon">${item.icon}</span>
                    <span class="nav-label">${item.label}</span>
                </button>`;
        });
        menuHtml += '</nav>';
        navContainer.innerHTML = menuHtml;
    }

    // 3. Render Stats Cards
    const statsContainer = document.getElementById('stats-cards-container');
    if (roleConfig) {
        let statsHtml = '';
        roleConfig.stats.forEach(stat => {
            statsHtml += `
                <div class="stat-card premium">
                    <div class="stat-icon premium">${stat.icon}</div>
                    <div class="stat-info">
                        <h3 id="${stat.id}">0</h3>
                        <p>${stat.label}</p>
                    </div>
                </div>`;
        });
        statsContainer.innerHTML = statsHtml;
    }

    // 4. Inject Content Sections
    await injectRoleSections(user.role);

    // 5. Initialize Navigation Handlers
    const sidebar = document.getElementById('sidebar');
    const navItems = sidebar.querySelectorAll('.nav-item[data-section]');
    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            navigateTo(btn.dataset.section);
        });
    });

    // 6. Handle Default Section
    const defaultSec = roleConfig.menu[0].id;
    const hash = window.location.hash.replace('#', '');
    if (hash && roleConfig.menu.some(m => m.id === hash)) {
        navigateTo(hash);
    } else {
        navigateTo(defaultSec);
    }

    // 7. Load Initial Data
    try {
        if (user.role === 'student') {
            await initStudentDashboard();
            await loadStudentData();
        }
        else if (user.role === 'warden') {
            await initWardenDashboard();
            await loadWardenData();
            await loadWardenDashboardStats();
            await loadWardenActivity();
            setupWardenQuickActions();
        }
        else if (user.role === 'admin') {
            await initAdminDashboard();
            await loadAdminData();
        }
    } catch (err) {
        console.error('[Dashboard] Data load error:', err);
    }

    // 8. Setup Logout
    document.getElementById('sb-logout-btn')?.addEventListener('click', handleLogout);

    // 9. Hide Loading Overlay
    setTimeout(() => {
        const loader = document.getElementById('dashboard-loading');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 1000);
}


async function injectRoleSections(role) {
    const container = document.getElementById('content-sections-container');
    const modalContainer = document.getElementById('modal-container');

    if (role === 'student') {
        container.innerHTML = `
            <!-- Apply for Leave -->
            <div id="section-apply-leave" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Apply for New Leave</div>
                    </div>
                    <div class="card-body">
                        <form id="leave-request-form">
                            <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
                                <div class="form-group">
                                    <label style="display:block;margin-bottom:8px;font-weight:600;color:var(--slate-600);">Start Date</label>
                                    <input type="date" id="start-date" required style="width:100%;padding:12px;border:1px solid var(--slate-200);border-radius:var(--radius-md);">
                                </div>
                                <div class="form-group">
                                    <label style="display:block;margin-bottom:8px;font-weight:600;color:var(--slate-600);">End Date</label>
                                    <input type="date" id="end-date" required style="width:100%;padding:12px;border:1px solid var(--slate-200);border-radius:var(--radius-md);">
                                </div>
                            </div>
                            <div class="form-group" style="margin-bottom:20px;">
                                <label style="display:block;margin-bottom:8px;font-weight:600;color:var(--slate-600);">Reason for Leave</label>
                                <textarea id="reason" placeholder="Explain your reason clearly..." required style="width:100%;padding:12px;border:1px solid var(--slate-200);border-radius:var(--radius-md);height:100px;resize:none;"></textarea>
                            </div>
                            <div class="form-group" style="margin-bottom:25px;">
                                <label style="display:block;margin-bottom:8px;font-weight:600;color:var(--slate-600);">Emergency Contact Number</label>
                                <input type="tel" id="emergency-contact" placeholder="Valid 10-digit number" required style="width:100%;padding:12px;border:1px solid var(--slate-200);border-radius:var(--radius-md);">
                            </div>
                            <button type="submit" class="btn btn-primary" style="width:100%; padding:15px; font-size:1rem;">Submit Leave Request</button>
                        </form>
                    </div>
                </div>
            </div>
            
            <!-- Leave History -->
            <div id="section-leave-history" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">My Leave History</div>
                        <div class="header-actions" style="display:flex;gap:10px;">
                            <select id="student-visibility-filter" class="form-input" style="padding:6px 12px; font-size:0.85rem; width:auto;">
                                <option value="active">Active Requests</option>
                                <option value="hidden">Deleted Requests</option>
                            </select>
                            <button class="btn btn-secondary btn-small" id="refresh-history">🔄</button>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th width="40"><input type="checkbox" id="student-select-all"></th>
                                        <th>Duration</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Remarks</th>
                                        <th>Applied On</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="history-table-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (role === 'warden') {
        container.innerHTML = `
            <!-- Pending Requests -->
            <div id="section-warden-pending" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Pending Leave Requests</div>
                        <div class="header-actions">
                            <input type="text" id="warden-pending-search" placeholder="Search students..." class="form-input" style="padding:8px 15px; width:220px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="warden-pending-requests-list">
                            <!-- Pending items go here -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- Students in Hostel -->
            <div id="section-warden-students" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">My Hostel Students</div>
                        <div class="header-actions">
                            <input type="text" id="warden-student-search" placeholder="Filter students..." class="form-input" style="padding:8px 15px; width:220px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Dept</th>
                                        <th>Course</th>
                                        <th>Hostel</th>
                                        <th>Contact</th>
                                        <th>Room</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="warden-students-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Students on Leave -->
            <div id="section-warden-active" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Students Currently on Leave</div>
                        <div class="header-actions">
                            <input type="text" id="warden-active-search" placeholder="Quick search..." class="form-input" style="padding:8px 15px; width:200px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div class="card-body">
                        <div id="warden-current-leaves-list" class="current-leaves-list"></div>
                    </div>
                </div>
            </div>

            <!-- Leave History -->
            <div id="section-warden-history" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Leave History (Last 6 Months)</div>
                        <div class="header-actions" style="display:flex; gap:10px;">
                            <select id="warden-visibility-filter" class="form-input" style="padding:6px 12px; font-size:0.85rem; width:auto;">
                                <option value="active">Active History</option>
                                <option value="hidden">Deleted Records</option>
                            </select>
                            <input type="text" id="warden-leave-search" placeholder="Search history..." class="form-input" style="padding:8px 15px; width:200px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div class="card-body">
                         <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th width="40"><input type="checkbox"></th>
                                        <th>Student</th>
                                        <th>Dept</th>
                                        <th>Course</th>
                                        <th>Hostel</th>
                                        <th>Room</th>
                                        <th>Duration</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Approved By</th>
                                        <th>Reviewed At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="warden-history-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div id="section-warden-quick" class="content-section">
                <div class="quick-actions-grid">
                    <div class="quick-action-btn" id="bulk-approve">
                        <div class="action-icon">✅</div>
                        <div class="action-text">
                            <h4>Bulk Approve</h4>
                            <p>Approve all pending requests at once</p>
                        </div>
                    </div>
                    <div class="quick-action-btn" id="hostel-report">
                        <div class="action-icon">📊</div>
                        <div class="action-text">
                            <h4>Monthly Report</h4>
                            <p>Generate hostel leave statistics</p>
                        </div>
                    </div>
                    <div class="quick-action-btn" id="contact-admin">
                        <div class="action-icon">🔧</div>
                        <div class="action-text">
                            <h4>Technical Support</h4>
                            <p>Contact system administrator</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recent Activity -->
            <div id="section-warden-recent" class="content-section">
                <div class="card">
                    <div class="card-header"><div class="card-title">Recent System Activity</div></div>
                    <div class="card-body">
                        <div class="activity-timeline" id="warden-activity-log"></div>
                    </div>
                </div>
            </div>
        `;
    } else if (role === 'admin') {

        container.innerHTML = `
            <div id="section-students-on-leave" class="content-section">
                 <div class="card">
                    <div class="card-header">
                        <div class="card-title">Students Currently on Leave (Global)</div>
                        <div class="header-actions">
                            <input type="text" id="admin-active-search" placeholder="Search names..." class="form-input" style="padding:8px 15px; width:220px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div class="card-body"><div class="current-leaves-list" id="admin-current-leaves-list"></div></div>
                </div>
            </div>
            <div id="section-leave-records" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">All Leave Records</div>
                        <div class="header-actions" style="display:flex;gap:10px;">
                            <select id="admin-visibility-filter" class="form-input" style="padding:6px 12px; font-size:0.85rem; width:auto;">
                                <option value="active">Active</option>
                                <option value="hidden">Deleted</option>
                            </select>
                            <input type="text" id="leave-search" placeholder="Search records..." class="form-input" style="padding:8px 15px; width:220px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th width="40"><input type="checkbox"></th>
                                        <th>Student</th>
                                        <th>Hostel</th>
                                        <th>Duration</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Reviewer</th>
                                        <th>Reviewed At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="leave-records-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <div id="section-manage-students" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Manage Students</div>
                        <div class="header-actions" style="display:flex; gap:10px;">
                            <input type="text" id="student-search" placeholder="Filter students..." class="form-input" style="padding:8px 15px; width:200px; font-size:0.85rem;">
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Contact</th>
                                        <th>Hostel</th>
                                        <th>Room</th>
                                        <th>Warden</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody id="students-table-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <div id="section-manage-wardens" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Manage Wardens</div>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Contact</th>
                                        <th>Hostel Assigned</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="wardens-table-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <div id="section-manage-hostels" class="content-section">
                <div class="card">
                    <div class="card-header">
                        <div class="card-title">Manage Hostels</div>
                        <button class="btn btn-primary btn-small" id="add-hostel-btn">+ Add Hostel</button>
                    </div>
                    <div class="card-body">
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Type</th>
                                        <th>Capacity</th>
                                        <th>Location</th>
                                        <th>Warden Assigned</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="hostels-table-body"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div id="section-settings" class="content-section">
                <div class="card">
                    <div class="card-header"><div class="card-title">System Settings</div></div>
                    <div class="card-body">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
                            <div class="card" style="padding:20px; border:1px solid var(--slate-100);">
                                <h4 style="margin-bottom:15px;">Database Maintenance</h4>
                                <button class="btn btn-secondary" style="width:100%;margin-bottom:10px;">Backup Database</button>
                                <button class="btn btn-secondary" style="width:100%; color:var(--danger);">Clear Audit Logs</button>
                            </div>
                            <div class="card" style="padding:20px; border:1px solid var(--slate-100);">
                                <h4 style="margin-bottom:15px;">System Config</h4>
                                <div class="form-group"><label><input type="checkbox" id="email-notifications" checked> Enable Email Notifications</label></div>
                                <div class="form-group"><label><input type="checkbox" id="auto-approve-short"> Auto-Approve Short Leaves (< 2 days)</label></div>
                                <div class="form-group"><label>Max Leave Duration (Days)</label><input type="number" id="max-leave-duration" value="14" class="form-input"></div>
                                <button class="btn btn-primary" id="save-settings" style="width:100%; margin-top:10px;">Save Config</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    // Modal Injections
    modalContainer.innerHTML = `
        <div id="modal-overlay" class="sidebar-overlay"></div>
        
        <!-- Leave Details Modal -->
        <div id="leave-details-modal" class="modal">
            <div class="modal-content" style="max-width:600px;">
                <div class="modal-header">
                    <h3>Leave Request Details</h3>
                    <button class="modal-close" data-modal="leave-details-modal" style="background:none;border:none;font-size:2rem;cursor:pointer;">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="modal-detail-grid">
                        <div class="detail-item">
                            <span class="detail-label">Student Name</span>
                            <span class="detail-value" id="detail-student-name"></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Student ID</span>
                            <span class="detail-value" id="detail-id"></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Hostel & Room</span>
                            <span class="detail-value" id="detail-room"></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Status</span>
                            <span id="detail-status"></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">From Date</span>
                            <span class="detail-value" id="detail-start"></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">To Date</span>
                            <span class="detail-value" id="detail-end"></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Emergency Contact</span>
                            <span class="detail-value" id="detail-emergency"></span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Parent Contact</span>
                            <span class="detail-value" id="detail-parent"></span>
                        </div>
                    </div>

                    <div style="margin-bottom:20px;">
                        <div class="detail-section-title">
                            <span>📝</span> Reason for Leave
                        </div>
                        <div id="detail-reason" class="detail-text-box"></div>
                    </div>

                    <div>
                        <div class="detail-section-title">
                            <span>💬</span> Warden Remarks
                        </div>
                        <div id="detail-remarks" class="detail-text-box"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Student Modal (Add/Edit) -->
        <div id="student-modal" class="card modal-glass" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:600px; z-index:2000; display:none; border-radius:var(--radius-lg); box-shadow:0 20px 50px rgba(0,0,0,0.3);">
            <div class="card-header">
                <div class="card-title" id="student-modal-title">Add New Student</div>
                <button class="close-modal" data-modal="student-modal" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
            </div>
            <div class="card-body">
                <form id="student-form">
                    <input type="hidden" id="edit-student-id">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div class="form-group"><label>Full Name</label><input type="text" id="s-name" required class="form-input"></div>
                        <div class="form-group"><label>Email</label><input type="email" id="s-email" required class="form-input"></div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div class="form-group"><label>Student ID</label><input type="text" id="s-studentId" required class="form-input"></div>
                        <div class="form-group"><label>Department</label>
                            <select id="s-dept" class="form-input">
                                <option value="">Select Department</option>
                            </select>
                        </div>

                        <div class="form-group"><label>Course</label>
                            <select id="s-course" class="form-input" style="appearance: auto;">
                                <option value="">Select Course</option>
                                <option value="UG">UG</option>
                                <option value="PG">PG</option>
                                <option value="P.hd">P.hd</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div class="form-group"><label>Contact</label><input type="text" id="s-password" class="form-input" placeholder="Primary Contact Number (Keep empty to keep current)"></div>
                        <div class="form-group"><label>Parent Phone</label><input type="text" id="s-parent-phone" class="form-input" placeholder="Parent Contact Number"></div>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:15px;">
                        <div class="form-group"><label>Hostel</label><select id="s-hostel" required class="form-input"></select></div>
                        <div class="form-group"><label>Room Number</label><input type="text" id="s-room" required class="form-input"></div>
                    </div>
                    <div class="form-group" style="margin-bottom:20px;"><label>Assign Warden</label><select id="s-warden" class="form-input"></select></div>
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:12px;">Save Student</button>
                </form>
            </div>
        </div>

        <!-- Warden Modal (Add/Edit) -->
        <div id="warden-modal" class="card modal-glass" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:500px; z-index:2000; display:none; border-radius:var(--radius-lg); box-shadow:0 20px 50px rgba(0,0,0,0.3);">
            <div class="card-header">
                <div class="card-title" id="warden-modal-title">Add New Warden</div>
                <button class="close-modal" data-modal="warden-modal" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
            </div>
            <div class="card-body">
                <form id="warden-form">
                    <input type="hidden" id="edit-warden-id">
                    <div class="form-group" style="margin-bottom:15px;"><label>Full Name</label><input type="text" id="w-name" required class="form-input"></div>
                    <div class="form-group" style="margin-bottom:15px;"><label>Email</label><input type="email" id="w-email" required class="form-input"></div>
                    <div class="form-group" style="margin-bottom:15px;"><label>Contact</label><input type="text" id="w-phone" class="form-input" placeholder="Warden Primary Contact"></div>
                    <div class="form-group" style="margin-bottom:20px;"><label>Assign Hostel</label><input type="text" id="w-hostel" required class="form-input" placeholder="Hostel Name"></div>
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:12px;">Save Warden</button>
                </form>
            </div>
        </div>

        <!-- Hostel Modal (Add/Edit) -->
        <div id="hostel-modal" class="card modal-glass" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:500px; z-index:2000; display:none; border-radius:var(--radius-lg); box-shadow:0 20px 50px rgba(0,0,0,0.3);">
            <div class="card-header">
                <div class="card-title" id="hostel-modal-title">Add New Hostel</div>
                <button class="close-modal" data-modal="hostel-modal" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button>
            </div>
            <div class="card-body">
                <form id="hostel-form">
                    <input type="hidden" id="edit-hostel-id">
                    <div class="form-group" style="margin-bottom:15px;"><label>Hostel Name</label><input type="text" id="h-name" required class="form-input"></div>
                    <div class="form-group" style="margin-bottom:15px;"><label>Type</label><select id="h-type" required class="form-input"><option value="boys">Boys</option><option value="girls">Girls</option><option value="mixed">Mixed</option></select></div>
                    <div class="form-group" style="margin-bottom:15px;"><label>Capacity</label><input type="number" id="h-capacity" required class="form-input"></div>
                    <div class="form-group" style="margin-bottom:20px;"><label>Location</label><input type="text" id="h-location" class="form-input"></div>
                    <button type="submit" class="btn btn-primary" style="width:100%; padding:12px;">Save Hostel</button>
                </form>
            </div>
        </div>
    `;

    // Bind close modal events
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal || 'leave-details-modal';
            document.getElementById(modalId).style.display = 'none';
            document.getElementById('modal-overlay').classList.remove('active');
        });
    });

    document.getElementById('modal-overlay')?.addEventListener('click', () => {
        document.querySelectorAll('.card[style*="position:fixed"]').forEach(m => m.style.display = 'none');
        document.getElementById('modal-overlay').classList.remove('active');
    });
}

async function loadWardenDashboardStats() {
    try {
        const stats = await apiFetch('/warden/stats');
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setVal('wstat-students', stats.total_students);
        setVal('wstat-pending', stats.pending_requests);
        setVal('wstat-active', stats.active_leaves);

        const sub = document.getElementById('welcome-subtitle');
        if (sub) sub.textContent = `Managing ${stats.hostel_name} | ${stats.total_students} Students Assigned`;
    } catch (err) { console.error('Stats error:', err); }
}

async function loadWardenActivity() {
    const container = document.getElementById('warden-activity-log');
    if (!container) return;

    try {
        const logs = await apiFetch('/audit-logs');
        container.innerHTML = '';
        if (!logs.length) {
            container.innerHTML = '<p style="text-align:center; padding:40px; color:var(--text-muted); font-size:0.9rem;">No recent activity found.</p>';
            return;
        }

        logs.slice(0, 10).forEach(log => {
            const div = document.createElement('div');
            div.className = 'activity-item';
            div.innerHTML = `
                <div class="activity-dot"></div>
                <div class="activity-content" style="margin-left:15px;">
                    <span class="activity-time">${formatDateTime(log.timestamp)}</span>
                    <p class="activity-text"><span class="activity-user" style="font-weight:700;">${log.user}</span> ${log.action.replace(/_/g, ' ')}: <strong>${log.details || ''}</strong></p>
                </div>
            `;
            container.appendChild(div);
        });
    } catch (err) { console.error('Activity error:', err); }
}

function setupWardenQuickActions() {
    document.getElementById('bulk-approve')?.addEventListener('click', () => {
        showConfirm("Bulk Approve", "Are you sure you want to approve ALL pending requests for your hostel?", async () => {
            try {
                showMsg("Processing bulk approval...", "info");
                const pendingItems = document.querySelectorAll('.approve-btn');
                const ids = Array.from(pendingItems).map(btn => btn.dataset.id);
                if (!ids.length) {
                    showMsg("No pending requests to approve.", "warning");
                    return;
                }
                await apiFetch('/leave-requests/bulk-approve', {
                    method: 'PUT',
                    body: JSON.stringify({ request_ids: ids })
                });
                showMsg(`Successfully approved ${ids.length} requests!`, "success");
                await loadWardenData();
                await loadWardenDashboardStats();
            } catch (err) { showMsg(err.message, "error"); }
        });
    });

    document.getElementById('hostel-report')?.addEventListener('click', () => {
        showMsg("Generating hostel report... (Coming Soon)", "info");
    });

    document.getElementById('contact-admin')?.addEventListener('click', () => {
        window.location.href = "mailto:support@bgsbu.ac.in?subject=Hostel System Support";
    });
}


const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

// ===================== SIDEBAR NAVIGATION =====================
async function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return; // not a dashboard page

    const toggleBtn = document.getElementById('sidebar-toggle');
    const dashBody = document.getElementById('dash-body');
    const overlay = document.getElementById('sidebar-overlay');
    const dashMain = document.getElementById('dash-main');
    const isMobile = () => window.innerWidth <= 900;

    // ---- Restore collapse state ----
    const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (!isMobile() && collapsed) {
        sidebar.classList.add('collapsed');
        if (dashMain) dashMain.style.marginLeft = '68px';
    }

    // ---- Toggle button ----
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            if (isMobile()) {
                // Mobile: slide in/out as drawer
                sidebar.classList.toggle('mobile-open');
                overlay.classList.toggle('active');
                toggleBtn.classList.toggle('open', sidebar.classList.contains('mobile-open'));
            } else {
                // Desktop: collapse/expand
                sidebar.classList.toggle('collapsed');
                const isCollapsed = sidebar.classList.contains('collapsed');
                if (dashMain) dashMain.style.marginLeft = isCollapsed ? '68px' : '260px';
                localStorage.setItem('sidebarCollapsed', isCollapsed);
                toggleBtn.classList.toggle('open', !isCollapsed);
            }
        });
    }

    // Close sidebar on overlay click (mobile)
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            if (toggleBtn) toggleBtn.classList.remove('open');
        });
    }

    // Handle resize
    window.addEventListener('resize', () => {
        if (!isMobile()) {
            sidebar.classList.remove('mobile-open');
            if (overlay) overlay.classList.remove('active');
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            sidebar.classList.toggle('collapsed', isCollapsed);
            if (dashMain) dashMain.style.marginLeft = isCollapsed ? '68px' : '260px';
        } else {
            sidebar.classList.remove('collapsed');
            if (dashMain) dashMain.style.marginLeft = '0';
        }
    });

    // ---- SPA Section Navigation ----
    const navItems = sidebar.querySelectorAll('.nav-item[data-section]');

    // SPA navigation moved to global scope

    navItems.forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.section));
    });

    // Navigate from URL hash on load
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById('section-' + hash)) {
        navigateTo(hash);
    } else {
        // Activate the first nav item's section
        const first = sidebar.querySelector('.nav-item[data-section]');
        if (first) navigateTo(first.dataset.section);
    }

    // ---- Quick Actions link to sections ----
    const leaveHistBtn = document.getElementById('leave-history-btn');
    if (leaveHistBtn) leaveHistBtn.addEventListener('click', () => {
        navigateTo('leave-history');
    });

    finalizeSidebar();
}

function finalizeSidebar() {
    // ---- Populate user profile in sidebar/navbar ----
    const user = getCurrentUser();
    if (user) {
        const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        // Sidebar profile
        const sbAvatar = document.getElementById('sb-avatar');
        const sbName = document.getElementById('sb-name');
        if (sbAvatar) sbAvatar.textContent = initials;
        if (sbName) sbName.textContent = user.name || 'User';
        // Navbar
        const navAvatar = document.getElementById('nav-avatar');
        const navUsername = document.getElementById('nav-username');
        if (navAvatar) navAvatar.textContent = initials;
        if (navUsername) navUsername.textContent = user.name || 'User';
    }

    // ---- Logout buttons in sidebar ----
    document.getElementById('sb-logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    document.getElementById('warden-logout-btn')?.addEventListener('click', handleLogout);
}
// Call finalizeSidebar inside initSidebar or at the end

function initNavbar() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === page);
    });
    document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
}

function redirectIfLoggedIn() {
    const user = getCurrentUser();
    const page = window.location.pathname.split('/').pop() || 'index.html';

    // Redirect away from landing/login if already logged in
    const authPages = ['login.html', 'index.html', 'register.html', 'student-login.html', 'warden-login.html', 'admin-login.html'];
    if (user && authPages.includes(page)) {
        window.location.href = 'dashboard.html';
        return;
    }

    // Block access to dashboards based on roles
    if (page === 'admin.html') {
        if (!user) { window.location.href = 'login.html'; return; }
        if (user.role !== 'admin') {
            if (user.role === 'warden') window.location.href = 'warden.html';
            else window.location.href = 'student.html';
            return;
        }
    }

    if (page === 'warden.html') {
        if (!user) { window.location.href = 'login.html'; return; }
        if (user.role !== 'warden' && user.role !== 'admin') {
            window.location.href = 'student.html';
            return;
        }
    }

    if (page === 'student.html') {
        if (!user) { window.location.href = 'login.html'; return; }
        // Admins and Wardens can view student dashboard if they want (though it won't show their data)
        // But usually we want to keep them in their own dashboard
    }
}

// ===================== GLOBAL LISTENERS =====================
function setupGlobalListeners() {
    // Select All Checkboxes Logic
    const setupSelectAll = (selectAllId, checkboxClass, btnId) => {
        const selectAll = document.getElementById(selectAllId);
        const btn = document.getElementById(btnId);
        if (!selectAll || !btn) return;

        // Handle Select All click
        selectAll.addEventListener('change', (e) => {
            document.querySelectorAll(`.${checkboxClass}`).forEach(cb => {
                if (cb.closest('table').contains(selectAll)) {
                    cb.checked = e.target.checked;
                }
            });
            toggleBulkBtn(checkboxClass, btnId, selectAllId);
        });
    };

    // Toggle Bulk Delete Button Visibility
    const toggleBulkBtn = (checkboxClass, btnId, selectAllId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const selectAll = document.getElementById(selectAllId);
        // Only count checkboxes in the same table as the selectAll
        const table = selectAll ? selectAll.closest('table') : document;
        const anyChecked = Array.from(table.querySelectorAll(`.${checkboxClass}`)).some(cb => cb.checked);
        btn.style.display = anyChecked ? 'inline-block' : 'none';

        // Update Select All state if not all are checked
        if (selectAll) {
            const allBoxes = table.querySelectorAll(`.${checkboxClass}`);
            const allChecked = allBoxes.length > 0 && Array.from(allBoxes).every(cb => cb.checked);
            selectAll.checked = allChecked;
        }
    };

    // Listen for individual checkbox clicks to toggle bulk button
    document.addEventListener('change', e => {
        if (e.target.classList.contains('leave-checkbox')) {
            let prefix = '';
            if (e.target.closest('#leave-records-body')) prefix = 'admin-';
            else if (e.target.closest('#warden-history-body')) prefix = 'warden-';
            else if (e.target.closest('#history-table-body')) prefix = 'student-';

            if (prefix) {
                toggleBulkBtn('leave-checkbox', `${prefix}bulk-delete`, `${prefix}select-all-leaves`);
            }
        }
    });

    // Handle Bulk Delete Button Clicks
    const handleBulkDelete = async (btnId, tableBodyId) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const tbody = document.getElementById(tableBodyId);
            if (!tbody) return;
            const checked = Array.from(tbody.querySelectorAll('.leave-checkbox:checked')).map(cb => cb.value);
            if (!checked.length) return;

            showConfirm("Delete Selected Records", `Are you sure you want to permanently delete ${checked.length} leave record(s)?`, async () => {
                btn.disabled = true;
                btn.textContent = "Deleting...";
                try {
                    await apiFetch('/leave-requests/bulk', {
                        method: 'DELETE',
                        body: JSON.stringify({ request_ids: checked })
                    });
                    showMsg(`${checked.length} records deleted successfully!`, 'success');

                    // Uncheck Select All and hide button
                    const selectAllId = btnId.replace('bulk-delete', 'select-all-leaves');
                    const selectAll = document.getElementById(selectAllId);
                    if (selectAll) selectAll.checked = false;
                    btn.style.display = 'none';

                    // Refresh appropriate data
                    const user = getCurrentUser();
                    if (user.role === 'admin') await loadAdminData();
                    else if (user.role === 'warden') await loadWardenData();
                    else if (user.role === 'student') await loadStudentData();
                } catch (err) {
                    showMsg(err.message, 'error');
                } finally {
                    btn.disabled = false;
                    btn.textContent = "Delete Selected";
                }
            });
        });
    };

    setupSelectAll('admin-select-all-leaves', 'leave-checkbox', 'admin-bulk-delete');
    setupSelectAll('warden-select-all-leaves', 'leave-checkbox', 'warden-bulk-delete');
    setupSelectAll('student-select-all-leaves', 'leave-checkbox', 'student-bulk-delete');

    handleBulkDelete('admin-bulk-delete', 'leave-records-body');
    handleBulkDelete('warden-bulk-delete', 'warden-history-body');
    handleBulkDelete('student-bulk-delete', 'history-table-body');

    // Global Modal Close Listeners
    document.addEventListener('click', e => {
        const closeBtn = e.target.closest('.modal-close, .modal-cancel');
        if (closeBtn) {
            const modalId = closeBtn.dataset.modal || closeBtn.closest('.modal')?.id;
            if (modalId) closeModal(modalId);
        }

        // Close modal when clicking outside
        if (e.target.classList.contains('modal')) {
            closeModal(e.target.id);
        }
    });

    document.addEventListener('click', e => {
        // alert("Click at " + e.clientX + ", " + e.clientY + " on " + e.target.tagName + " " + e.target.className);
        // Student Management
        const editSt = e.target.closest('.edit-student-btn');
        if (editSt) openEditStudent(editSt.dataset.id);
        const delSt = e.target.closest('.del-student-btn');
        if (delSt) deleteStudent(delSt.dataset.id);

        // Warden Management (Admin Only)
        const editW = e.target.closest('.edit-warden-btn');
        if (editW) openEditWarden(editW.dataset.id);
        const delW = e.target.closest('.del-warden-btn');
        if (delW) deleteWarden(delW.dataset.id);

        // Hostel Management (Admin Only)
        const editH = e.target.closest('.edit-hostel-btn');
        if (editH) openEditHostel(editH.dataset.id);
        const delH = e.target.closest('.del-hostel-btn');
        if (delH) deleteHostel(delH.dataset.id);



        // Leave Requests
        const delBtn = e.target.closest('.del-leave-btn');
        if (delBtn) {
            const id = delBtn.dataset.id;
            const title = "Delete Leave Record";
            const msg = "Are you sure you want to delete this leave record? (It can be restored later)";
            showConfirm(title, msg, () => {
                deleteLeaveRequest(id, delBtn);
            });
        }

        const restoreBtn = e.target.closest('.restore-leave-btn');
        if (restoreBtn) {
            restoreLeaveRequest(restoreBtn.dataset.id, restoreBtn);
        }

        const viewBtn = e.target.closest('.view-leave-btn');
        if (viewBtn) {
            e.preventDefault();
            showLeaveDetailsModal(viewBtn.dataset.id);
        }

        const viewStudentBtn = e.target.closest('.view-student-btn');
        if (viewStudentBtn) {
            e.preventDefault();
            showStudentProfile(viewStudentBtn.dataset.id);
        }
    });
}

async function showLeaveDetailsModal(id) {
    try {
        // Try cache first
        let req = window.lastStudentRequests?.find(r => r.id == id);

        if (!req) {
            showMsg("Loading fresh details...", "info");
            // Fetch with both visibilities
            let res = await apiFetch(`/leave-requests?visibility=active`);
            req = res.find(r => r.id == id);

            if (!req) {
                res = await apiFetch(`/leave-requests?visibility=hidden`);
                req = res.find(r => r.id == id);
            }
        }

        if (!req) {
            alert("Record " + id + " not found. Try refreshing the page.");
            return;
        }

        const s = req.student;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };

        set('detail-student-name', s.name);
        set('detail-id', s.student_id || 'N/A');
        set('detail-email', s.email || 'N/A');
        set('detail-dept', s.department || 'N/A');
        set('detail-course', s.course || 'N/A');
        set('detail-hostel', s.hostel || 'N/A');
        set('detail-room', s.room_number || 'N/A');
        set('detail-start', formatDate(req.start_date));
        set('detail-end', formatDate(req.end_date));
        set('detail-emergency', req.emergency_contact || '—');
        set('detail-parent', s.parent_phone || '—');
        set('detail-reason', req.reason || 'No reason provided.');
        set('detail-remarks', req.remarks || 'No remarks provided yet.');

        const statusEl = document.getElementById('detail-status');
        if (statusEl) {
            statusEl.textContent = req.status.toUpperCase();
            statusEl.className = `status-pill status-${req.status}`;
        }

        openModal('leave-details-modal');
    } catch (err) {
        console.error('Error showing leave details:', err);
        showMsg('Failed to load leave details. Please try again.', 'error');
    }
}

async function showStudentProfile(id) {
    try {
        const students = await apiFetch('/students');
        const st = students.find(s => s.id == id);
        if (!st) { showMsg('Student profile not found.', 'error'); return; }

        const content = `
            <div style="text-align:center; margin-bottom:20px;">
                <div style="width:80px; height:80px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2rem; font-weight:700; margin:0 auto 10px;">${st.name[0]}</div>
                <h2 style="margin:0; color:var(--slate-800);">${st.name}</h2>
                <p style="color:var(--slate-500); margin:5px 0;">${st.student_id}</p>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; background:var(--slate-50); padding:20px; border-radius:12px;">
                <div><strong style="display:block; font-size:0.75rem; color:var(--slate-500); text-transform:uppercase;">Email</strong> ${st.email}</div>
                <div><strong style="display:block; font-size:0.75rem; color:var(--slate-500); text-transform:uppercase;">Department</strong> ${st.department}</div>
                <div><strong style="display:block; font-size:0.75rem; color:var(--slate-500); text-transform:uppercase;">Course</strong> ${st.course}</div>
                <div><strong style="display:block; font-size:0.75rem; color:var(--slate-500); text-transform:uppercase;">Parent Phone</strong> ${st.parent_phone}</div>
                <div><strong style="display:block; font-size:0.75rem; color:var(--slate-500); text-transform:uppercase;">Hostel</strong> ${st.hostel}</div>
                <div><strong style="display:block; font-size:0.75rem; color:var(--slate-500); text-transform:uppercase;">Room No.</strong> ${st.room_number}</div>
            </div>
        `;

        showConfirm(st.name + "'s Profile", content, () => {}, "Close", "No");
    } catch (err) {
        showMsg('Error loading student profile.', 'error');
    }
}


// ===================== LEAVE ANALYTICS =====================

/**
 * Fetches leave analytics from the backend.
 * @param {number} months - 1-6
 * @param {string} q - search query (name or student ID)
 */
async function loadLeaveAnalytics(role, months, q = '') {
    const url = `/leave-analytics?months=${months}&q=${encodeURIComponent(q)}`;
    const resultsId   = role === 'student' ? 'student-analytics-results'   : `${role}-analytics-results`;
    const summaryId   = role === 'student' ? 'student-analytics-summary'   : `${role}-analytics-summary`;
    const studentsId  = role === 'student' ? null                           : `${role}-asm-students`;
    const leavesId    = `${role}-asm-leaves`;
    const daysId      = `${role}-asm-days`;
    const periodId    = `${role}-asm-period`;
    const approvedId  = role === 'student' ? 'student-asm-approved'        : null;

    const resultsEl = document.getElementById(resultsId);
    const summaryEl = document.getElementById(summaryId);

    if (resultsEl) {
        resultsEl.innerHTML = `
            <div style="text-align:center; padding:40px; color:var(--text-muted);">
                <div style="font-size:2rem; margin-bottom:10px;">⏳</div>
                <p>Loading analytics data...</p>
            </div>`;
    }

    try {
        const data = await apiFetch(url);
        const students = data.students || [];
        const periodLabel = `${data.from_date} → ${data.to_date}`;

        // Update summary
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        if (summaryEl) summaryEl.style.display = 'grid';
        if (studentsId) setEl(studentsId, students.length);
        setEl(leavesId, students.reduce((a, s) => a + s.total_leaves, 0));
        setEl(daysId, students.reduce((a, s) => a + s.total_days, 0));
        setEl(periodId, `${months}M`);
        if (approvedId) setEl(approvedId, students.reduce((a, s) => a + s.total_leaves, 0));

        renderAnalyticsResults(resultsEl, students, role, data.period_months);
    } catch (err) {
        if (resultsEl) {
            resultsEl.innerHTML = `
                <div style="text-align:center; padding:40px; color:var(--danger);">
                    <div style="font-size:2rem; margin-bottom:10px;">⚠️</div>
                    <p>Failed to load analytics: ${err.message}</p>
                </div>`;
        }
    }
}

function renderAnalyticsResults(container, students, role, months) {
    if (!container) return;

    if (!students.length) {
        container.innerHTML = `
            <div class="analytics-empty-state">
                <div style="font-size:3rem; margin-bottom:12px;">📊</div>
                <p style="color:var(--text-muted); font-size:1rem;">No approved leave records found for this period.</p>
            </div>`;
        return;
    }

    let html = `<div class="analytics-results-list">`;

    students.forEach((st, idx) => {
        const avgDays = st.total_leaves > 0 ? (st.total_days / st.total_leaves).toFixed(1) : '0';
        const intensityClass = st.total_days >= 20 ? 'high' : st.total_days >= 10 ? 'medium' : 'low';

        html += `
            <div class="analytics-student-card ${intensityClass}">
                <div class="asc-header" onclick="toggleAnalyticsCard(this)">
                    <div class="asc-rank">${idx + 1}</div>
                    <div class="asc-identity">
                        <div class="asc-name">${st.name}</div>
                        <div class="asc-meta">
                            ID: ${st.student_id || '—'}
                            ${role !== 'student' ? `&nbsp;|&nbsp; ${st.hostel || '—'} &nbsp;|&nbsp; ${st.department || '—'}` : ''}
                            &nbsp;|&nbsp; Room ${st.room_number || '—'}
                        </div>
                    </div>
                    <div class="asc-stats">
                        <div class="asc-stat">
                            <span class="asc-stat-value">${st.total_leaves}</span>
                            <span class="asc-stat-label">Leaves</span>
                        </div>
                        <div class="asc-stat">
                            <span class="asc-stat-value">${st.total_days}</span>
                            <span class="asc-stat-label">Days Away</span>
                        </div>
                        <div class="asc-stat">
                            <span class="asc-stat-value">${avgDays}</span>
                            <span class="asc-stat-label">Avg Days</span>
                        </div>
                    </div>
                    <div class="asc-chevron">▼</div>
                </div>
                <div class="asc-body" style="display:none;">
                    <table class="analytics-breakdown-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Days</th>
                                <th>Reason</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${st.leaves.map((lv, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${formatDate(lv.start_date)}</td>
                                    <td>${formatDate(lv.end_date)}</td>
                                    <td><strong>${lv.days}</strong></td>
                                    <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${lv.reason}">${lv.reason || '—'}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}

function toggleAnalyticsCard(header) {
    const body = header.nextElementSibling;
    const chevron = header.querySelector('.asc-chevron');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    if (chevron) chevron.textContent = isOpen ? '▼' : '▲';
}

function initAnalyticsPills(pillsContainerId, role) {
    const container = document.getElementById(pillsContainerId);
    if (!container) return;
    let activePills = container;
    let currentMonths = 1;

    container.querySelectorAll('.period-pill').forEach(btn => {
        btn.addEventListener('click', async () => {
            container.querySelectorAll('.period-pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            currentMonths = parseInt(btn.dataset.months);

            if (role === 'student') {
                await loadLeaveAnalytics('student', currentMonths, '');
            }
            // For admin/warden, user still needs to press Search — but auto-reload if they already searched
            const searchEl = document.getElementById(`${role}-analytics-search`);
            if (searchEl !== null) {
                // Only auto-reload if a search was already done (results visible)
                const resultsEl = document.getElementById(`${role}-analytics-results`);
                const hasResults = resultsEl && !resultsEl.querySelector('.analytics-empty-state');
                if (hasResults || role === 'student') {
                    const q = searchEl ? searchEl.value.trim() : '';
                    await loadLeaveAnalytics(role, currentMonths, q);
                }
            }
        });
    });
}

function initAnalyticsSection(role) {
    const pillsId = `${role}-period-pills`;
    initAnalyticsPills(pillsId, role);

    if (role === 'student') {
        // Auto-load analytics for the student on tab open
        const navBtn = document.querySelector('.nav-item[data-section="analytics"]');
        if (navBtn) {
            navBtn.addEventListener('click', async () => {
                const activePill = document.querySelector(`#${pillsId} .period-pill.active`);
                const months = activePill ? parseInt(activePill.dataset.months) : 1;
                await loadLeaveAnalytics('student', months, '');
            });
        }
        return;
    }

    // Admin / Warden: Search button
    const searchBtn = document.getElementById(`${role}-analytics-search-btn`);
    const clearBtn  = document.getElementById(`${role}-analytics-clear-btn`);
    const searchInput = document.getElementById(`${role}-analytics-search`);

    searchBtn?.addEventListener('click', async () => {
        const activePill = document.querySelector(`#${pillsId} .period-pill.active`);
        const months = activePill ? parseInt(activePill.dataset.months) : 1;
        const q = searchInput?.value.trim() || '';
        await loadLeaveAnalytics(role, months, q);
    });

    // Search on Enter key
    searchInput?.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchBtn?.click();
        }
    });

    clearBtn?.addEventListener('click', async () => {
        if (searchInput) searchInput.value = '';
        const activePill = document.querySelector(`#${pillsId} .period-pill.active`);
        const months = activePill ? parseInt(activePill.dataset.months) : 1;
        await loadLeaveAnalytics(role, months, '');
    });

    // Also wire the nav item click to auto-load if no results yet
    const navBtn = document.querySelector(`.nav-item[data-section="leave-analytics"]`);
    if (navBtn && !navBtn.dataset.analyticsBound) {
        navBtn.dataset.analyticsBound = 'true';
        navBtn.addEventListener('click', async () => {
            const resultsEl = document.getElementById(`${role}-analytics-results`);
            const hasResults = resultsEl && !resultsEl.querySelector('.analytics-empty-state');
            if (!hasResults) {
                const activePill = document.querySelector(`#${pillsId} .period-pill.active`);
                const months = activePill ? parseInt(activePill.dataset.months) : 1;
                await loadLeaveAnalytics(role, months, '');
            }
        });
    }
}

// ===================== BOOT =====================

document.addEventListener('DOMContentLoaded', async () => {
    // Only run redirect if on landing pages, not on dashboard
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const authPages = ['index.html', 'login.html', 'register.html', 'student-login.html', 'warden-login.html', 'admin-login.html'];
    if (authPages.includes(page)) {
        redirectIfLoggedIn();
    }

    initNavbar();
    // Fix registration form dropdowns
    loadDepartments();
    loadHostelsForRegistration();
    
    await initSidebar();
    await initUnifiedDashboard(); // New unified entry point
    initLoginPage();
    setupGlobalListeners();

    // Legacy inits
    await initAdminDashboard();
    await initWardenDashboard();
    await initStudentDashboard();

    // Wire analytics for each role based on which page we're on
    if (page === 'admin.html')   initAnalyticsSection('admin');
    if (page === 'warden.html')  initAnalyticsSection('warden');
    if (page === 'student.html') initAnalyticsSection('student');
    if (page === 'index.html' || page === '') loadPublicStats();
});

// ===================== REGISTRATION HELPERS =====================
function loadDepartments() {
    const deptSelectors = ['reg-department', 's-dept'];
    deptSelectors.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Keep the first option if it's a placeholder
            const firstOption = el.options[0];
            el.innerHTML = '';
            if (firstOption && firstOption.value === "") {
                el.appendChild(firstOption);
            } else {
                const opt = document.createElement('option');
                opt.value = "";
                opt.textContent = "Select Department";
                el.appendChild(opt);
            }
            
            ALL_DEPARTMENTS.sort().forEach(dept => {
                const opt = document.createElement('option');
                opt.value = dept;
                opt.textContent = dept;
                el.appendChild(opt);
            });
        }
    });
}

async function loadHostelsForRegistration() {
    const hostelSelectors = ['reg-hostel', 'reg-warden-hostel', 's-hostel'];
    const containers = hostelSelectors.map(id => document.getElementById(id)).filter(el => el !== null);
    
    if (containers.length === 0) return;

    try {
        const hostels = await apiFetch('/hostels');
        containers.forEach(el => {
            const currentVal = el.value;
            el.innerHTML = '<option value="">Select Hostel</option>';
            hostels.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.id || h.name; // Prefer ID if available
                opt.textContent = h.name;
                el.appendChild(opt);
            });
            // Try to restore value if it was set
            if (currentVal) el.value = currentVal;
        });
    } catch (err) {
        console.error("Failed to load hostels for registration:", err);
        showMsg("Failed to load hostel list. Please refresh.", "error");
    }
}
