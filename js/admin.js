// Initialize Firebase
const database = firebase.database();
const devicesRef = database.ref('devices');
const usersRef = database.ref('users');
const paymentsRef = database.ref('payments');

// State
let devicesData = {};
let usersData = {};
let paymentsData = {};
let currentTab = 'dashboard';

// DOM Elements
const views = {
    dashboard: document.getElementById('view-dashboard'),
    devices: document.getElementById('view-devices'),
    users: document.getElementById('view-users'),
    reports: document.getElementById('view-reports')
};
const navItems = {
    dashboard: document.getElementById('nav-dashboard'),
    devices: document.getElementById('nav-devices'),
    users: document.getElementById('nav-users'),
    reports: document.getElementById('nav-reports')
};

// ═══════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════

// Initialize Flatpickr
let reportDateRange = null;
flatpickr("#reportDateRange", {
    mode: "range",
    dateFormat: "Y-m-d",
    onChange: (selectedDates) => {
        if (selectedDates.length === 2) {
            reportDateRange = { start: selectedDates[0], end: selectedDates[1] };
            // Set end of day
            reportDateRange.end.setHours(23, 59, 59, 999);
        } else {
            reportDateRange = null;
        }
    }
});

// Load Data
devicesRef.on('value', snap => {
    devicesData = snap.val() || {};
    refreshUI();
});

usersRef.on('value', snap => {
    usersData = snap.val() || {};
    refreshUI();
});

paymentsRef.on('value', snap => {
    paymentsData = snap.val() || {};
    refreshUI();
});

function refreshUI() {
    renderDashboard();
    renderDevices();
    renderUsers();
    // Reports are rendered on demand
}

// ═══════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════

window.switchTab = function (tabName) {
    currentTab = tabName;

    // Update Nav
    Object.values(navItems).forEach(el => el.classList.remove('active'));
    if (navItems[tabName]) navItems[tabName].classList.add('active');

    // Update Views
    Object.values(views).forEach(el => el.style.display = 'none');
    if (views[tabName]) views[tabName].style.display = 'block';

    if (tabName === 'reports') {
        populateReportUserSelect();
        applyReportFilters(); // Initial load
    } else {
        // Force refresh of the active view to ensure data is up to date (rendering issues fix)
        if (tabName === 'devices') renderDevices();
        if (tabName === 'users') renderUsers();
        if (tabName === 'dashboard') renderDashboard();
    }
};

window.logout = function () {
    localStorage.removeItem('yape_user');
    window.location.href = '../index.html';
};

// ═══════════════════════════════════════════════════════════
// VIEW: DASHBOARD
// ═══════════════════════════════════════════════════════════

function renderDashboard() {
    const devices = Object.values(devicesData);
    const payments = Object.values(paymentsData);

    // Stats
    const pendingDevices = devices.filter(d => d.status === 'pending').length;

    // Update New Dashboard Cards
    const elPending = document.getElementById('dashboardPendingCount');
    if (elPending) elPending.textContent = pendingDevices;

    const elTotalDevices = document.getElementById('dashboardTotalDevices');
    if (elTotalDevices) elTotalDevices.textContent = devices.length;

    // Calculate Users Count (exclude admin)
    const clientUsers = Object.values(usersData || {}).filter(u => u.role !== 'admin');
    const elTotalUsers = document.getElementById('dashboardTotalUsers');
    if (elTotalUsers) elTotalUsers.textContent = clientUsers.length;

    // Recent Payments List (Top 5)
    payments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    const recent = payments.slice(0, 5);
    const tbody = document.getElementById('recentPaymentsTable');
    tbody.innerHTML = '';

    recent.forEach(p => {
        const tr = document.createElement('tr');
        const date = new Date(p.timestamp || 0);
        tr.innerHTML = `
            <td>${date.toLocaleTimeString()}</td>
            <td style="font-family: monospace;">${p.deviceCode || '-'}</td>
            <td>${p.sender || 'Desconocido'}</td>
            <td style="font-weight: bold; color: var(--success);">S/ ${p.amount}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ═══════════════════════════════════════════════════════════
// VIEW: DEVICES
// ═══════════════════════════════════════════════════════════

function renderDevices() {
    const tbody = document.getElementById('devicesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!devicesData) {
        console.warn("No devices data found");
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando datos...</td></tr>';
        return;
    }

    const devices = Object.values(devicesData);
    console.log("Rendering Devices:", devices.length, devices);

    if (devices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No hay dispositivos registrados</td></tr>';
        return;
    }

    // Sort pending first
    devices.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    devices.forEach(device => {
        const tr = document.createElement('tr');
        const date = device.createdAt ? new Date(device.createdAt).toLocaleDateString() : 'N/A';
        const statusBadge = getStatusBadge(device.status);

        let actions = '';
        if (device.status === 'pending') {
            actions = `
                <button onclick="updateDeviceStatus('${device.code}', 'approved')" class="glass-button" style="padding: 0.6rem; font-size: 1.1rem; background: var(--success); margin-right: 0.3rem;" title="Aprobar">✓</button>
                <button onclick="updateDeviceStatus('${device.code}', 'rejected')" class="glass-button" style="padding: 0.6rem; font-size: 1.1rem; background: var(--warning); margin-right: 0.3rem;" title="Rechazar">✕</button>
            `;
        } else if (device.status === 'approved') {
            actions = `<button onclick="updateDeviceStatus('${device.code}', 'rejected')" class="glass-button" style="padding: 0.5rem 0.8rem; font-size: 0.9rem; background: var(--warning); margin-right: 0.3rem;">Suspender</button>`;
        } else {
            actions = `<button onclick="updateDeviceStatus('${device.code}', 'approved')" class="glass-button" style="padding: 0.5rem 0.8rem; font-size: 0.9rem; background: var(--success); margin-right: 0.3rem;">Activar</button>`;
        }

        // Add Delete Button
        actions += `<button onclick="deleteDevice('${device.code}')" class="glass-button" style="padding: 0.6rem; font-size: 1.1rem; background: var(--danger);" title="Eliminar Definitivamente">🗑</button>`;

        tr.innerHTML = `
            <td style="font-family: monospace; font-weight: bold; font-size: 1.1rem;">${device.code}</td>
            <td>${device.model || 'Unknown'}<br><small style="color:var(--text-muted)">${device.manufacturer || ''}</small></td>
            <td>${statusBadge}</td>
            <td>${date}</td>
            <td>${actions}</td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateDeviceStatus = function (code, status) {
    if (!confirm(`¿Cambiar estado a ${status}?`)) return;
    devicesRef.child(code).update({ status: status, updatedAt: firebase.database.ServerValue.TIMESTAMP });
};

window.deleteDevice = function (code) {
    if (!confirm(`⚠️ PELIGRO: ¿Estás seguro de ELIMINAR el dispositivo ${code}?\n\nEsto borrará permanentemente:\n1. El dispositivo de la lista.\n2. TODOS los pagos/registros asociados.\n3. El usuario asignado (si existe).`)) return;

    // 1. Delete associated Payments
    const paymentsToDelete = Object.keys(paymentsData).filter(key => paymentsData[key].deviceCode === code);
    paymentsToDelete.forEach(key => paymentsRef.child(key).remove());

    // 2. Delete associated User (if any)
    const userToDelete = Object.values(usersData).find(u => u.deviceCode === code);
    if (userToDelete) {
        usersRef.child(userToDelete.username).remove();
    }

    // 3. Delete Device
    devicesRef.child(code).remove();
};


function getStatusBadge(status) {
    if (status === 'approved') return '<span class="badge badge-approved">Aprobado</span>';
    if (status === 'rejected') return '<span class="badge badge-rejected">Rechazado</span>';
    return '<span class="badge badge-pending">Pendiente</span>';
}

// ═══════════════════════════════════════════════════════════
// VIEW: USERS
// ═══════════════════════════════════════════════════════════

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    const users = Object.values(usersData || {}).filter(u => u.role !== 'admin');

    users.forEach(user => {
        const tr = document.createElement('tr');
        const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
        // Generate a safe ID for the input
        const passId = `pass-${user.username.replace(/[^a-zA-Z0-9]/g, '')}`;

        tr.innerHTML = `
            <td style="font-weight: bold;">${user.username}</td>
            <td style="font-family: monospace;">${user.deviceCode}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px; border: 1px solid var(--border); padding: 5px 10px; border-radius: 8px; background: var(--surface); width: fit-content;">
                    <input type="password" id="${passId}" value="${user.password}" 
                        style="border: none; background: transparent; outline: none; width: 120px; font-family: monospace; color: var(--text); font-size: 1rem;"
                        onkeypress="if(event.key === 'Enter') updateUserPassword('${user.username}', this.value)"
                    >
                    <button onclick="togglePassword('${passId}', this)" type="button" 
                        style="background: none; border: none; cursor: pointer; padding: 0; font-size: 1.1rem; display: flex; align-items: center; opacity: 0.6;" 
                        title="Ver/Ocultar">
                        👁️
                    </button>
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px; padding-left: 5px;">Enter para guardar</div>
            </td>
            <td>${date}</td>
            <td>
                <button onclick="deleteUser('${user.username}')" class="glass-button" style="padding: 0.6rem; font-size: 1.1rem; background: var(--danger);">🗑</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.togglePassword = function (id, btn) {
    const input = document.getElementById(id);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        btn.style.opacity = '1';
    } else {
        input.type = 'password';
        btn.style.opacity = '0.6';
    }
};

window.updateUserPassword = function (username, newPass) {
    newPass = newPass.trim();
    if (!newPass) {
        alert("La contraseña no puede estar vacía");
        // Reset to old value just in case visual sync is needed, but firebase listener will handle it
        return;
    }

    usersRef.child(username).update({ password: newPass }).then(() => {
        // Optional: toast or mini alert
        alert(`✅ Contraseña de ${username} actualizada correctamente.`);
        // Remove focus to show it's done
        document.activeElement.blur();
    }).catch(err => {
        alert("Error al actualizar: " + err.message);
    });
};


// Create User Modal Logic
const modal = document.getElementById('createUserModal');
const deviceSelect = document.getElementById('deviceSelect');
const createUserForm = document.getElementById('createUserForm');

window.showCreateUserModal = function () {
    console.log("Opening Create User Modal");

    // Populate dropdown
    deviceSelect.innerHTML = '<option value="">-- Seleccionar Dispositivo --</option>';

    // Safety check
    if (!devicesData || Object.keys(devicesData).length === 0) {
        alert("No hay dispositivos registrados en el sistema.");
        return;
    }

    const devices = Object.values(devicesData);
    const assignedCodes = Object.values(usersData || {}).map(u => u.deviceCode);

    // Show APPROVED devices that are NOT assigned
    const available = devices.filter(d => d.status === 'approved' && !assignedCodes.includes(d.code));

    console.log("Available devices for user creation:", available);

    if (available.length === 0) {
        // Show alert but ALSO Log why
        const pending = devices.filter(d => d.status === 'pending').length;
        const assigned = devices.filter(d => assignedCodes.includes(d.code)).length;

        let msg = "No hay dispositivos disponibles para asignar.\n\n";
        if (pending > 0) msg += `- Tienes ${pending} dispositivos PENDIENTES (apruébalos primero en "Dispositivos").\n`;
        if (assigned > 0) msg += `- Tienes ${assigned} dispositivos ya asignados a otros usuarios.\n`;
        if (pending === 0 && assigned === 0) msg += "- No hay dispositivos Aprobados en la lista.";

        alert(msg);
        return;
    }

    available.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.code;
        opt.textContent = `${d.code} (${d.model})`;
        deviceSelect.appendChild(opt);
    });

    modal.style.display = 'flex';
};

createUserForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const deviceCode = deviceSelect.value;

    console.log("Attempting to create user:", { username, deviceCode });

    if (!username || !password || !deviceCode) {
        alert("Por favor completa todos los campos.");
        return;
    }

    if (username.includes(' ') || username.includes('/') || username.includes('.')) {
        alert("El usuario no puede contener espacios ni caracteres especiales.");
        return;
    }

    if (usersData && usersData[username]) {
        alert("El usuario '" + username + "' ya existe. Por favor elige otro.");
        return;
    }

    // Show loading state
    const submitBtn = createUserForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Creando...";

    usersRef.child(username).set({
        username,
        password,
        deviceCode,
        role: 'user',
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("¡Usuario creado exitosamente!");
        modal.style.display = 'none';
        createUserForm.reset();

        // Force refresh of Users tab to show the new user immediately
        renderUsers();
        renderDashboard(); // Update stats

    }).catch(err => {
        console.error("Error creating user:", err);
        alert("Error al guardar en base de datos: " + err.message);
    }).finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    });
});


window.deleteUser = function (username) {
    const user = usersData[username];
    if (!user) return;

    if (!confirm(`⚠️ PELIGRO: ¿Eliminar usuario ${username}?\n\nAl eliminar el usuario, también se eliminará su DISPOSITIVO (${user.deviceCode}) y TODOS sus registros de pagos.`)) return;

    // Cascade delete via device (handles payments, device, and the user check)
    // But since we are already deleting the user, we can manually call the parts or just invoke deleteDevice logic.
    // However, deleteDevice tries to delete the user again, which is fine (idempotent-ish), but let's be explicit.

    if (user.deviceCode) {
        // 1. Delete Payments
        const paymentsToDelete = Object.keys(paymentsData).filter(key => paymentsData[key].deviceCode === user.deviceCode);
        paymentsToDelete.forEach(key => paymentsRef.child(key).remove());

        // 2. Delete Device
        devicesRef.child(user.deviceCode).remove();
    }

    // 3. Delete User
    usersRef.child(username).remove();
};

// ═══════════════════════════════════════════════════════════
// VIEW: REPORTS
// ═══════════════════════════════════════════════════════════

function populateReportUserSelect() {
    const sel = document.getElementById('reportUserSelect');
    sel.innerHTML = '<option value="">Todos los usuarios / dispositivos</option>';

    const users = Object.values(usersData).filter(u => u.role !== 'admin');
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.deviceCode; // We filter by deviceCode, not username
        opt.textContent = `Usuario: ${u.username} (Disp: ${u.deviceCode})`;
        sel.appendChild(opt);
    });
}

window.applyReportFilters = function () {
    const tbody = document.getElementById('reportsTableBody');
    const selectedDeviceCode = document.getElementById('reportUserSelect').value;
    const searchText = document.getElementById('reportSearch').value.toLowerCase();

    tbody.innerHTML = '';
    let results = Object.values(paymentsData);

    // Filter 1: Device/User
    if (selectedDeviceCode) {
        results = results.filter(p => p.deviceCode === selectedDeviceCode);
    }

    // Filter 2: Date
    if (reportDateRange) {
        results = results.filter(p => {
            const t = p.timestamp || 0;
            return t >= reportDateRange.start.getTime() && t <= reportDateRange.end.getTime();
        });
    }

    // Filter 3: Text
    if (searchText) {
        results = results.filter(p =>
            (p.sender && p.sender.toLowerCase().includes(searchText)) ||
            (p.content && p.content.toLowerCase().includes(searchText))
        );
    }

    // Sort desc
    results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    document.getElementById('reportCount').textContent = `${results.length} registros`;

    if (results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No se encontraron resultados</td></tr>`;
        return;
    }

    results.forEach(p => {
        const tr = document.createElement('tr');
        const date = new Date(p.timestamp || 0);

        // Find username for this device
        const user = Object.values(usersData).find(u => u.deviceCode === p.deviceCode);
        const ownerName = user ? user.username : (p.deviceCode || 'N/A');

        tr.innerHTML = `
            <td>${date.toLocaleString()}</td>
            <td>${ownerName}</td>
            <td>${p.sender}</td>
            <td style="color:var(--success); font-weight:bold;">S/ ${p.amount}</td>
            <td style="font-size:0.8rem; color:var(--text-muted); max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${p.content}
            </td>
        `;
        tbody.appendChild(tr);
    });
};
