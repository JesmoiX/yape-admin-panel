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
    const pending = devices.filter(d => d.status === 'pending').length;
    document.getElementById('totalDevices').textContent = devices.length;
    const badge = document.getElementById('pendingDevicesBadge');
    badge.textContent = `${pending} Pendientes`;
    badge.style.display = pending > 0 ? 'inline-block' : 'none';

    // Money
    let totalSum = 0;
    let todaySum = 0;
    let todayCount = 0;
    const todayStr = new Date().toDateString();

    payments.forEach(p => {
        const amt = parseFloat(p.amount) || 0;
        totalSum += amt;

        const pDate = new Date(p.timestamp || 0);
        if (pDate.toDateString() === todayStr) {
            todaySum += amt;
            todayCount++;
        }
    });

    document.getElementById('todayTotalAmount').textContent = `S/ ${todaySum.toFixed(2)}`;
    document.getElementById('todayPaymentsCount').textContent = `${todayCount} transacciones hoy`;
    document.getElementById('totalAmount').textContent = `S/ ${totalSum.toFixed(2)}`;

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
    tbody.innerHTML = '';
    const devices = Object.values(devicesData);

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
                <button onclick="updateDeviceStatus('${device.code}', 'approved')" class="glass-button" style="padding: 0.4rem; background: var(--success); margin-right: 0.2rem;">✓</button>
                <button onclick="updateDeviceStatus('${device.code}', 'rejected')" class="glass-button" style="padding: 0.4rem; background: var(--warning); margin-right: 0.2rem;">✕</button>
            `;
        } else if (device.status === 'approved') {
            actions = `<button onclick="updateDeviceStatus('${device.code}', 'rejected')" class="glass-button" style="padding: 0.4rem; background: var(--warning); margin-right: 0.2rem;">Suspend</button>`;
        } else {
            actions = `<button onclick="updateDeviceStatus('${device.code}', 'approved')" class="glass-button" style="padding: 0.4rem; background: var(--success); margin-right: 0.2rem;">Active</button>`;
        }

        // Add Delete Button
        actions += `<button onclick="deleteDevice('${device.code}')" class="glass-button" style="padding: 0.4rem; background: var(--danger);">🗑</button>`;

        tr.innerHTML = `
            <td style="font-family: monospace; font-weight: bold;">${device.code}</td>
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
    if (!confirm(`¿ELIMINAR dispositivo ${code}? Esto borrará su historial de aprobaciones actual. NO borrará los pagos ya registrados.`)) return;
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
    const users = Object.values(usersData).filter(u => u.role !== 'admin');

    users.forEach(user => {
        const tr = document.createElement('tr');
        const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
        tr.innerHTML = `
            <td style="font-weight: bold;">${user.username}</td>
            <td style="font-family: monospace;">${user.deviceCode}</td>
            <td style="font-family: monospace;">${user.password}</td>
            <td>${date}</td>
            <td>
                <button onclick="deleteUser('${user.username}')" class="glass-button" style="padding: 0.4rem; background: var(--danger);">🗑</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Create User Modal Logic
const modal = document.getElementById('createUserModal');
const deviceSelect = document.getElementById('deviceSelect');
const createUserForm = document.getElementById('createUserForm');

window.showCreateUserModal = function () {
    // Populate dropdown
    deviceSelect.innerHTML = '<option value="">-- Seleccionar --</option>';
    const devices = Object.values(devicesData);
    const assignedCodes = Object.values(usersData).map(u => u.deviceCode);

    // Show APPROVED devices that are NOT assigned
    const available = devices.filter(d => d.status === 'approved' && !assignedCodes.includes(d.code));

    if (available.length === 0) {
        alert("No hay dispositivos aprobados disponibles (sin usuario asignado).");
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

    if (!username || !password || !deviceCode) return;
    if (usersData[username]) { alert("Usuario ya existe"); return; }

    usersRef.child(username).set({
        username, password, deviceCode, role: 'user', createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        alert("Usuario creado");
        modal.style.display = 'none';
        createUserForm.reset();
    });
});

window.deleteUser = function (username) {
    if (confirm(`¿Eliminar usuario ${username}?`)) {
        usersRef.child(username).remove();
    }
}

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
