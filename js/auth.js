const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Simple validation
        if (!username || !password) {
            showError("Por favor ingrese usuario y contraseña");
            return;
        }

        // Authentication Logic
        try {
            // 1. Check Hardcoded Admin
            if (username === 'admin' && password === 'ep38een9') {
                localStorage.setItem('yape_user', JSON.stringify({
                    role: 'admin',
                    username: 'admin',
                    token: 'admin_token'
                }));
                window.location.href = 'admin/dashboard_modern_complete.html';
                return;
            }

            // 2. Check Database Users
            const db = firebase.database();
            // Use once() to check if user exists
            db.ref('users/' + username).once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();

                    const userStatus = userData.status || (userData.active ? 'active' : 'inactive');
                    if (userStatus !== 'active') {
                        showError("⛔ Cuenta suspendida o inactiva. Contacte al soporte.");
                        return;
                    }

                    // Simple password check (plaintext)
                    if (userData.password === password) {
                        localStorage.setItem('yape_user', JSON.stringify({
                            role: 'user',
                            username: userData.username,
                            deviceCode: userData.deviceCode, // Crucial for filtering
                            token: 'user_token_' + Date.now(),
                            password: userData.password // Monitor password changes
                        }));
                        window.location.href = 'user/dashboard_modern.html';
                    } else {
                        showError("Contraseña incorrecta");
                    }
                } else {
                    showError("Usuario no encontrado o credenciales incorrectas");
                }
            }).catch((error) => {
                showError("Error de conexión: " + error.message);
            });

        } catch (error) {
            console.error(error);
            showError("Error inesperado: " + error.message);
        }
    });
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

// Global Auth Check (include in other pages)
function checkAuth(requiredRole) {
    const user = JSON.parse(localStorage.getItem('yape_user'));
    if (!user) {
        window.location.href = '../index.html';
        return;
    }
    if (requiredRole && user.role !== requiredRole) {
        window.location.href = '../index.html'; // Or forbidden page
    }
}

// -----------------------------------------------------
// PASSWORD REVEAL LOGIC (Press & Hold)
// -----------------------------------------------------
function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);

    // If elements don't exist (e.g. we are on a page that doesn't use them), just return
    if (!btn || !input) return;

    const show = () => {
        input.type = 'text';
        // Visual feedback
        btn.style.opacity = '1';
        btn.querySelector('span').textContent = 'visibility_off';
    };

    const hide = () => {
        input.type = 'password';
        btn.style.opacity = '';
        btn.querySelector('span').textContent = 'visibility';
    };

    // Events for Desktop (Mouse)
    btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent focus loss
        show();
    });
    btn.addEventListener('mouseup', hide);
    btn.addEventListener('mouseleave', hide);

    // Events for Mobile (Touch)
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        show();
    });
    btn.addEventListener('touchend', (e) => {
        e.preventDefault(); // Prevent ghost clicks
        hide();
    });
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    // 1. Login Page
    setupPasswordToggle('toggleLoginPass', 'password');

    // 2. Dashboard - Create User Modal
    // Note: Since modal is in the DOM, this should work. 
    // If modal is dynamically populated, we might need MutationObserver, but here it's static HTML dialog.
    setupPasswordToggle('toggleNewUserPass', 'newPassword');

    // 3. Initialize Auto-Logout
    initAutoLogout();

    // 4. Real-time Session Monitor (Suspend/Delete/PassChange)
    initRealtimeSessionCheck();
});

// -----------------------------------------------------
// AUTO-LOGOUT (10 Minutes Inactivity)
// -----------------------------------------------------
function initAutoLogout() {
    // Only active if logged in
    if (!localStorage.getItem('yape_user')) return;

    const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 Minutes in ms
    let idleTimer;

    const logoutUser = () => {
        // Clear session
        localStorage.removeItem('yape_user');

        // Redirect logic using reliable path resolution
        // Check if we are in a subdirectory (admin/ or user/)
        if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/user/')) {
            alert("⏰ Su sesión ha expirado por inactividad (10 min).");
            window.location.href = '../index.html';
        } else {
            // Already at root or login, just reload to clear state
            window.location.reload();
        }
    };

    const resetTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(logoutUser, IDLE_TIMEOUT);
    };

    // Listen for user activity
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
        document.addEventListener(event, resetTimer, { passive: true });
    });

    // Start timer initially
    resetTimer();
    console.log("⏱️ Auto-logout timer started: 10m");
}

// -----------------------------------------------------
// REAL-TIME SESSION MONITOR
// -----------------------------------------------------
function initRealtimeSessionCheck() {
    const userStr = localStorage.getItem('yape_user');
    if (!userStr) return;

    const user = JSON.parse(userStr);

    // Only monitor regular users (Admin is hardcoded)
    if (user.role !== 'user') return;

    const db = firebase.database();
    const userRef = db.ref('users/' + user.username);

    userRef.on('value', (snapshot) => {
        // 1. Check if User Deleted
        if (!snapshot.exists()) {
            forceLogout("❌ Su cuenta ha sido eliminada por el administrador.");
            return;
        }

        const data = snapshot.val();

        // 2. Check Status (Suspended/Inactive)
        const currentStatus = data.status || (data.active ? 'active' : 'inactive');
        if (currentStatus !== 'active') {
            forceLogout("⛔ Su cuenta ha sido suspendida. Contacte al soporte.");
            return;
        }

        // 3. Check Password Change
        // Checks if stored password matches current DB password
        if (user.password && data.password !== user.password) {
            forceLogout("🔐 Su contraseña ha cambiado. Inicie sesión nuevamente.");
            return;
        }
    });

    console.log("📡 Real-time session monitor active for: " + user.username);
}

function forceLogout(msg) {
    // Avoid loop if already logging out
    if (!localStorage.getItem('yape_user')) return;

    alert(msg);
    localStorage.removeItem('yape_user');

    // Redirect
    if (window.location.pathname.includes('/admin/') || window.location.pathname.includes('/user/')) {
        window.location.href = '../index.html';
    } else {
        window.location.reload();
    }
}
