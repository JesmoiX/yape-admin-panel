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
                window.location.href = 'admin/dashboard.html';
                return;
            }

            // 2. Check Database Users
            const db = firebase.database();
            // Use once() to check if user exists
            db.ref('users/' + username).once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    const userData = snapshot.val();

                    // Simple password check (plaintext)
                    if (userData.password === password) {
                        localStorage.setItem('yape_user', JSON.stringify({
                            role: 'user',
                            username: userData.username,
                            deviceCode: userData.deviceCode, // Crucial for filtering
                            token: 'user_token_' + Date.now()
                        }));
                        window.location.href = 'user/dashboard.html';
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
