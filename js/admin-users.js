// Initialize Firebase
const database = firebase.database();
const usersRef = database.ref('users');
const devicesRef = database.ref('devices');

// DOM Elements
const usersTableBody = document.getElementById('usersTableBody');
const modal = document.getElementById('createUserModal');
const deviceSelect = document.getElementById('deviceSelect');
const createUserForm = document.getElementById('createUserForm');

// State
let usersData = {};
let devicesData = {};

// ═══════════════════════════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════════════════════════

usersRef.on('value', (snapshot) => {
    usersData = snapshot.val() || {};
    renderUsersTable();
});

devicesRef.on('value', (snapshot) => {
    devicesData = snapshot.val() || {};
    updateDeviceSelect(); // Update dropdown real-time
});

// ═══════════════════════════════════════════════════════════
// FUNCTIONS
// ═══════════════════════════════════════════════════════════

function renderUsersTable() {
    usersTableBody.innerHTML = '';
    const users = Object.values(usersData);

    // Filter out the main admin if stored in DB, otherwise just show app users
    const appUsers = users.filter(u => u.role !== 'admin');

    if (appUsers.length === 0) {
        usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No hay usuarios registrados</td></tr>`;
        return;
    }

    appUsers.forEach(user => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';

        const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';

        tr.innerHTML = `
            <td style="padding: 1rem; font-weight: bold;">${user.username}</td>
            <td style="padding: 1rem; font-family: monospace;">${user.deviceCode}</td>
            <td style="padding: 1rem; color: var(--text-muted);">${date}</td>
            <td style="padding: 1rem; font-family: monospace;">${user.password}</td> 
            <td style="padding: 1rem;">
                <button onclick="deleteUser('${user.username}')" class="glass-button" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background: var(--danger);">Eliminar</button>
            </td>
        `;
        usersTableBody.appendChild(tr);
    });
}

function updateDeviceSelect() {
    deviceSelect.innerHTML = '<option value="">Seleccione un dispositivo...</option>';

    const devices = Object.values(devicesData);
    const usedCodes = Object.values(usersData).map(u => u.deviceCode);

    // Only approved devices that are NOT already assigned to a user
    const availableDevices = devices.filter(d =>
        d.status === 'approved' && !usedCodes.includes(d.code)
    );

    availableDevices.forEach(d => {
        const option = document.createElement('option');
        option.value = d.code;
        option.textContent = `${d.code} (${d.model})`;
        deviceSelect.appendChild(option);
    });
}

// ═══════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════

createUserForm.addEventListener('submit', (e) => {
    e.preventDefault();
    console.log("Formulario enviado");

    const submitBtn = createUserForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "Procesando...";
    submitBtn.disabled = true;

    try {
        const deviceCode = document.getElementById('deviceSelect').value;
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value.trim();

        console.log("Datos:", { deviceCode, username, password });

        if (!deviceCode || !username || !password) {
            alert("Todos los campos son obligatorios. Verifique haber seleccionado un dispositivo.");
            resetBtn();
            return;
        }

        // Check if username already exists
        if (usersData[username]) {
            alert("El nombre de usuario '" + username + "' ya existe. Elija otro.");
            resetBtn();
            return;
        }

        // Create User Object
        const newUser = {
            username: username,
            password: password,
            deviceCode: deviceCode,
            role: 'user',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        console.log("Enviando a Firebase...", newUser);

        // Save to Firebase
        usersRef.child(username).set(newUser)
            .then(() => {
                console.log("Éxito en Firebase");
                alert("Usuario creado exitosamente");
                closeModal();
                createUserForm.reset();
                resetBtn();
            })
            .catch(error => {
                console.error("Error Firebase:", error);
                alert("Error al crear usuario: " + error.message);
                resetBtn();
            });

    } catch (err) {
        console.error("Error síncrono:", err);
        alert("Error interno: " + err.message);
        resetBtn();
    }

    function resetBtn() {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

window.deleteUser = function (username) {
    if (!confirm(`¿Eliminar usuario ${username}? Esta acción no se puede deshacer.`)) return;

    usersRef.child(username).remove()
        .then(() => {
            console.log("Usuario eliminado");
        })
        .catch(error => {
            alert("Error al eliminar: " + error.message);
        });
};

// Modal Handling
window.showCreateUserModal = function () {
    updateDeviceSelect(); // Refresh list before showing
    modal.style.display = 'flex';
};

window.closeModal = function () {
    modal.style.display = 'none';
};
