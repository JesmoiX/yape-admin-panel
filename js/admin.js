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
if (document.getElementById("reportDateRange")) {
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
}

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

    // Update Nav - use nav-active class
    Object.values(navItems).forEach(el => {
        if (el) el.classList.remove('nav-active');
    });
    if (navItems[tabName]) navItems[tabName].classList.add('nav-active');

    // Update Views - use hidden-view class
    Object.values(views).forEach(el => {
        if (el) el.classList.add('hidden-view');
    });
    if (views[tabName]) views[tabName].classList.remove('hidden-view');

    if (tabName === 'reports') {
        populateReportUserSelect();
        applyReportFilters(); // Initial load
    } else {
        // Force refresh of the active view to ensure data is up to date (rendering issues fix)
        if (tabName === 'devices') renderDevices();
        if (tabName === 'users') renderUsers();
        if (tabName === 'dashboard') renderDashboard();
    }

    // Mobile: Close sidebar after selection (if exists)
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && window.innerWidth <= 768) {
        sidebar.classList.remove('active');
    }
};

window.toggleSidebar = function (e) {
    if (e) e.stopPropagation(); // Prevent immediate closing
    document.querySelector('.sidebar').classList.toggle('active');
};

// Close sidebar when clicking outside
document.addEventListener('click', function (event) {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.mobile-toggle');

    if (sidebar && sidebar.classList.contains('active') &&
        !sidebar.contains(event.target) &&
        (!toggleBtn || !toggleBtn.contains(event.target))) {
        sidebar.classList.remove('active');
    }
});

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

    // Show/Hide "Acción Requerida" badge based on pending devices
    const elPendingBadge = document.getElementById('dashboardPendingBadge');
    if (elPendingBadge) {
        if (pendingDevices > 0) {
            elPendingBadge.classList.remove('hidden');
        } else {
            elPendingBadge.classList.add('hidden');
        }
    }

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
    if (tbody) {
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
}

// ═══════════════════════════════════════════════════════════
// VIEW: DEVICES
// ═══════════════════════════════════════════════════════════

function renderDevices() {
    const tbody = document.getElementById('devicesTableBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!devicesData) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando datos...</td></tr>';
        return;
    }

    const devices = Object.values(devicesData);
    if (devices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No hay dispositivos registrados</td></tr>';
        return;
    }

    // Sort: Pending first, then by date
    devices.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    devices.forEach(device => {
        const tr = document.createElement('tr');
        const date = device.createdAt ? new Date(device.createdAt).toLocaleDateString() : 'N/A';

        // Find assigned user
        const assignedUser = Object.values(usersData || {}).find(u => u.deviceCode === device.code);

        // Logic for Status Badge (Sync with User)
        let statusBadge = '';
        if (assignedUser) {
            const uStatus = assignedUser.status || (assignedUser.active ? 'active' : 'inactive');
            if (uStatus === 'active') {
                statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">Activo</span>';
            } else if (uStatus === 'suspended') {
                statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Suspendido</span>';
            } else {
                statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">Inactivo</span>';
            }
        } else {
            // No user assigned -> Always Pending visually
            statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">Pendiente</span>';
        }

        // Refine User Display if no user
        const finalUserDisplay = assignedUser ?
            `<span class="font-bold text-slate-700 dark:text-slate-300">${assignedUser.username.toUpperCase()}</span>` :
            `<span class="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded">Sin Asignar</span>`;

        // Actions: Only "Forget" (Delete)
        const actions = `<button onclick="deleteDevice('${device.code}')" 
            class="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-1" 
            title="Olvidar Equipo">
            <span class="material-symbols-outlined text-[16px]">delete</span> Olvidar
        </button>`;

        tr.innerHTML = `
            <td class="px-6 py-4 font-mono font-bold text-slate-900 dark:text-white">${device.code}</td>
            <td class="px-6 py-4">
                <div class="font-medium text-slate-900 dark:text-white">${device.model || 'Unknown'}</div>
                <div class="text-xs text-slate-500 dark:text-slate-400">${device.manufacturer || ''}</div>
            </td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4 text-slate-600 dark:text-slate-400">${date}</td>
            <td class="px-6 py-4">${finalUserDisplay}</td>
            <td class="px-6 py-4">
                <div class="flex gap-2">${actions}</div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.updateDeviceStatus = function (code, status) {
    if (!confirm(`¿Cambiar estado a ${status}?`)) return;
    devicesRef.child(code).update({ status: status, updatedAt: firebase.database.ServerValue.TIMESTAMP });
};

window.deleteDevice = function (code) {
    if (!confirm(`⚠️ ALERTA: ¿Estás seguro de ELIMINAR el dispositivo ${code}?\n\nEsto borrará permanentemente el dispositivo y sus pagos asociados.\n(El usuario asociado NO será eliminado, pero quedará desvinculado).`)) return;

    // 1. Delete associated Payments
    const paymentsToDelete = Object.keys(paymentsData).filter(key => paymentsData[key].deviceCode === code);
    paymentsToDelete.forEach(key => paymentsRef.child(key).remove());

    // 2. Unlink User (if any)
    const userToUnlink = Object.values(usersData).find(u => u.deviceCode === code);
    if (userToUnlink) {
        usersRef.child(userToUnlink.username).update({ deviceCode: null });
        console.log(`Usuario ${userToUnlink.username} desvinculado del dispositivo ${code}`);
    }

    // 3. Delete Device
    devicesRef.child(code).remove();
};

function getStatusBadge(status) {
    if (status === 'approved') return '<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">Aprobado</span>';
    if (status === 'rejected') return '<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Rechazado</span>';
    return '<span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">Pendiente</span>';
}

// ═══════════════════════════════════════════════════════════
// VIEW: USERS
// ═══════════════════════════════════════════════════════════

function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const users = Object.values(usersData || {}).filter(u => u.role !== 'admin');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No hay usuarios creados</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        const date = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';
        const passId = `pass-${user.username.replace(/[^a-zA-Z0-9]/g, '')}`;

        // Determinar Estado Visual
        let statusBadge = '';
        let btnStatus = '';
        const status = user.status || (user.active ? 'active' : 'inactive'); // Fallback compatibility

        if (status === 'active') {
            statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">Activo</span>';
            // Botón para Suspender
            btnStatus = `<button onclick="toggleUserStatus('${user.username}', 'active')" class="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all shadow-sm hover:shadow-md mr-1" title="Suspender">Suspender</button>`;
        } else if (status === 'suspended') {
            statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">Suspendido</span>';
            // Botón para Activar (Reactivar)
            btnStatus = `<button onclick="toggleUserStatus('${user.username}', 'suspended')" class="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition-all shadow-sm hover:shadow-md mr-1" title="Activar">Activar</button>`;
        } else { // Inactive
            statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">Inactivo</span>';
            // Botón para Activar
            btnStatus = `<button onclick="toggleUserStatus('${user.username}', 'inactive')" class="px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all shadow-sm hover:shadow-md mr-1" title="Activar">Activar</button>`;
        }

        // Buttons
        const btnEdit = `<button onclick="openEditUserModal('${user.username}')" class="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all shadow-sm hover:shadow-md mr-1" title="Reasignar">Reasignar</button>`;
        const btnDelete = `<button onclick="deleteUser('${user.username}')" class="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-all shadow-sm hover:shadow-md flex items-center gap-1" title="Olvidar Usuario">Olvidar</button>`;

        tr.innerHTML = `
            <td class="px-6 py-4 font-bold text-slate-900 dark:text-white">${user.username.toUpperCase()}</td>
            <td class="px-6 py-4 font-mono text-slate-600 dark:text-slate-400">${user.deviceCode || '<span class="text-red-400">Sin asignar</span>'}</td>
            <td class="px-6 py-4">${statusBadge}</td>
            <td class="px-6 py-4">
                <div class="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                    <input type="password" id="${passId}" value="${user.password}"
                        class="border-none bg-transparent outline-none w-24 font-mono text-slate-900 dark:text-white text-xs focus:ring-0 p-0"
                        onkeypress="if(event.key === 'Enter') updateUserPassword('${user.username}', this.value)"
                    >
                    <button onclick="togglePassword('${passId}', this)" type="button"
                        class="bg-transparent border-none cursor-pointer p-0 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        title="Ver/Ocultar">
                        <span class="material-symbols-outlined text-[16px]">visibility</span>
                    </button>
                </div>
            </td>
            <td class="px-6 py-4 text-slate-600 dark:text-slate-400">${date}</td>
            <td class="px-6 py-4">
                <div class="flex items-center flex-wrap gap-1">${btnStatus}${btnEdit}${btnDelete}</div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Nueva función para cambiar estado dinámicamente
window.toggleUserStatus = function (username, currentStatus) {
    let newStatus = 'active';
    let deviceStatus = 'approved';

    if (currentStatus === 'active') {
        newStatus = 'suspended';
        deviceStatus = 'rejected';
    } else if (currentStatus === 'suspended') {
        newStatus = 'active';
        deviceStatus = 'approved';
    } else { // inactive
        newStatus = 'active';
        deviceStatus = 'approved';
    }

    const updates = {};
    updates[`users/${username}/status`] = newStatus;
    updates[`users/${username}/active`] = (newStatus === 'active'); // Mantener compatibilidad

    // Buscar dispositivo asociado para actualizar su estado también
    const user = usersData[username];
    if (user && user.deviceCode) {
        updates[`devices/${user.deviceCode}/status`] = deviceStatus;
        // CRITICAL FIX: Sync nested user status so App Login works
        updates[`devices/${user.deviceCode}/user/active`] = (newStatus === 'active');
        updates[`devices/${user.deviceCode}/user/status`] = newStatus;
    }

    database.ref().update(updates).then(() => {
        // alert(`Estado cambiado a ${newStatus.toUpperCase()}`);
        console.log(`Usuario ${username} cambiado a ${newStatus}`);
    }).catch(err => alert("Error al cambiar estado: " + err.message));
};

window.togglePassword = function (id, btn) {
    const input = document.getElementById(id);
    if (!input) return;

    const icon = btn.querySelector('.material-symbols-outlined');
    if (!icon) return;

    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
    }
};

window.updateUserPassword = function (username, newPass) {
    newPass = newPass.trim();
    if (!newPass) {
        alert("La contraseña no puede estar vacía");
        return;
    }
    usersRef.child(username).update({ password: newPass }).then(() => {
        alert(`✅ Contraseña de ${username} actualizada correctamente.`);
        document.activeElement.blur();
    }).catch(err => {
        alert("Error al actualizar: " + err.message);
    });
};

window.deleteUser = function (username) {
    const user = usersData[username];
    if (!user) return;

    if (!confirm(`⚠️ ALERTA: ¿Eliminar usuario ${username}?\n\nEl usuario será eliminado permanentemente. El dispositivo asociado NO se eliminará, pero quedará libre para ser asignado a otro usuario.`)) return;

    if (user.deviceCode) {
        // Clear user data AND reset status to pending
        devicesRef.child(user.deviceCode).update({
            'user': null,
            'status': 'pending'
        });
    }

    usersRef.child(username).remove().then(() => {
        alert("Usuario eliminado correctamente.");
    }).catch(err => {
        alert("Error al eliminar: " + err.message);
    });
};

// ═══════════════════════════════════════════════════════════
// VIEW: REPORTS
// ═══════════════════════════════════════════════════════════
// (Reports code omitted for brevity as it was unchanged, keeping it same as original logic essentially)
function populateReportUserSelect() {
    const sel = document.getElementById('reportUserSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Todos los usuarios / dispositivos</option>';
    const users = Object.values(usersData).filter(u => u.role !== 'admin');
    users.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.deviceCode;
        opt.textContent = `Usuario: ${u.username.toUpperCase()} (Disp: ${u.deviceCode || 'Sin Asignar'})`;
        sel.appendChild(opt);
    });
}
window.applyReportFilters = function () {
    const tbody = document.getElementById('reportsTableBody');
    if (!tbody) return;
    const selectedDeviceCode = document.getElementById('reportUserSelect').value;
    const searchText = document.getElementById('reportSearch').value.toLowerCase();
    tbody.innerHTML = '';
    let results = Object.values(paymentsData);
    if (selectedDeviceCode) results = results.filter(p => p.deviceCode === selectedDeviceCode);
    if (reportDateRange) {
        results = results.filter(p => {
            const t = p.timestamp || 0;
            return t >= reportDateRange.start.getTime() && t <= reportDateRange.end.getTime();
        });
    }
    if (searchText) {
        results = results.filter(p =>
            (p.sender && p.sender.toLowerCase().includes(searchText)) ||
            (p.content && p.content.toLowerCase().includes(searchText))
        );
    }
    results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    document.getElementById('reportCount').textContent = `${results.length} registros`;
    if (results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem;">No se encontraron resultados</td></tr>`;
        return;
    }
    results.forEach(p => {
        const tr = document.createElement('tr');
        const date = new Date(p.timestamp || 0);
        const user = Object.values(usersData).find(u => u.deviceCode === p.deviceCode);
        const ownerName = user ? user.username.toUpperCase() : (p.deviceCode || 'N/A');
        tr.innerHTML = `
            <td>${date.toLocaleString()}</td>
            <td>${ownerName}</td>
            <td>${p.sender}</td>
            <td style="color:var(--success); font-weight:bold;">S/ ${p.amount}</td>
            <td style="font-size:0.8rem; color:var(--text-muted); max-width: 250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.content}</td>
        `;
        tbody.appendChild(tr);
    });
};

// ═══════════════════════════════════════════════════════════
// MODAL & USER CREATION / EDITING
// ═══════════════════════════════════════════════════════════

const modal = document.getElementById('createUserModal');
const deviceSelect = document.getElementById('deviceSelect');
const createUserForm = document.getElementById('createUserForm');

window.showCreateUserModal = function () {
    const modal = document.getElementById('createUserModal');
    const deviceSelect = document.getElementById('deviceSelect');

    console.log("Opening Create User Modal...");
    if (!deviceSelect) {
        console.error("Critical Error: 'deviceSelect' element not found in DOM.");
        alert("Error de interfaz: No se encontró el selector.");
        return;
    }

    deviceSelect.innerHTML = '<option value="">-- Seleccionar Dispositivo --</option>';

    const devices = Object.values(devicesData || {});
    console.log("Devices Data:", devices);

    if (devices.length === 0) {
        alert("No hay dispositivos registrados en el sistema.");
        return;
    }

    // Modificado: Mostrar TODOS los dispositivos (Pending/Approved/Rejected)
    // Para que aparezcan directamente al crear usuario
    const availableDevices = devices;

    // Sort logic (optional): Pending first?
    availableDevices.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const assignedCodes = Object.values(usersData || {}).map(u => u.deviceCode);

    if (availableDevices.length === 0) {
        alert("No hay dispositivos registrados.");
        return;
    }

    availableDevices.forEach(d => {
        const isAssigned = assignedCodes.includes(d.code);
        // Safely find assigned user
        const assignedUser = Object.values(usersData || {}).find(u => u.deviceCode === d.code);
        const assignedUsername = assignedUser ? assignedUser.username : 'Desconocido';

        const opt = document.createElement('option');
        opt.value = d.code;
        // Show status clearly
        opt.textContent = `${d.code} (${d.model})${isAssigned ? ' - [Ocupado por ' + assignedUsername + ']' : ''}`;

        if (isAssigned) {
            opt.disabled = true;
            opt.style.color = '#9ca3af';
        }

        deviceSelect.appendChild(opt);
    });

    if (modal) {
        if (typeof modal.showModal === 'function') {
            try {
                if (!modal.open) modal.showModal();
            } catch (e) {
                console.warn("Modal already open or error:", e);
            }
        } else {
            modal.style.display = 'flex';
        }
    } else {
        console.error("Error: 'createUserModal' not found.");
    }
};

window.populateDeviceSelect = window.showCreateUserModal;

if (createUserForm) {
    createUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const usernameVal = document.getElementById('newUsername').value.trim();
        const username = usernameVal.toUpperCase(); // Force Uppercase
        const password = document.getElementById('newPassword').value.trim();
        const deviceCode = deviceSelect.value;

        if (!username || !password || !deviceCode) { alert("Completa todos los campos"); return; }

        // Check if user exists (case-insensitive)
        const userExists = Object.keys(usersData || {}).some(k => k.toUpperCase() === username);
        if (userExists) { alert("El usuario ya existe"); return; }

        const submitBtn = createUserForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = "Creando...";

        // Core data logic
        const userDataApp = {
            username: username,
            password: password,
            active: false, // Por defecto INACTIVO
            status: 'inactive', // Estado explícito
            capture_yape: true,
            capture_gmail: false,
            google_home_enabled: false,
            google_sheet_url: "",
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        // 1. Link to Device (Set device status to pending/rejected initially? Or keep current status?)
        // If user is inactive, device should NOT be approved yet. 
        // Force device status to 'pending' or 'rejected' if creating inactive user.
        // Let's set it to 'pending' as safe default.
        const deviceUpdates = {
            'user': userDataApp,
            'status': 'pending' // Forzar estado pendiente hasta que se active el usuario
        };

        devicesRef.child(deviceCode).update(deviceUpdates).then(() => {
            // 2. Create User Entry
            return usersRef.child(username).set({
                username, password, deviceCode, role: 'user',
                status: 'inactive', active: false, // Default Inactive
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        }).then(() => {
            alert("Usuario creado exitosamente.");
            if (modal && typeof modal.close === 'function') modal.close();
            else if (modal) modal.style.display = 'none';
            createUserForm.reset();
        }).catch(err => {
            alert("Error: " + err.message);
        }).finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = "Crear Usuario";
        });
    });
}

// EDIT USER MODAL LOGIC (New Feature)
window.openEditUserModal = function (username) {
    const user = usersData[username];
    if (!user) return;

    // Get modal elements
    const editModal = document.getElementById('editUserModal');
    if (!editModal) { alert("Error: Modal de edición no encontrado en HTML."); return; }

    document.getElementById('editUsernameOriginal').value = username;
    document.getElementById('editUsernameDisplay').value = username;

    const editSelect = document.getElementById('editDeviceSelect');
    editSelect.innerHTML = '<option value="">-- Sin Dispositivo (Desvincular) --</option>';

    // Populate with ALL devices (Pending/Approved/Rejected) to allow reassignment to any free device
    const devices = Object.values(devicesData);
    const assignedCodes = Object.values(usersData).map(u => u.deviceCode).filter(c => c !== user.deviceCode);

    devices.forEach(d => {
        const isAssigned = assignedCodes.includes(d.code);
        const assignedUser = Object.values(usersData).find(u => u.deviceCode === d.code);

        const opt = document.createElement('option');
        opt.value = d.code;
        opt.textContent = `${d.code} (${d.model})${isAssigned ? ' - [Ocupado por ' + assignedUser.username + ']' : ''}`;

        // Pre-select current device
        if (d.code === user.deviceCode) {
            opt.selected = true;
            opt.textContent += " (Actual)";
        }

        if (isAssigned && d.code !== user.deviceCode) {
            opt.disabled = true;
            opt.style.color = '#9ca3af';
        }

        editSelect.appendChild(opt);
    });

    if (typeof editModal.showModal === 'function') {
        try {
            if (!editModal.open) editModal.showModal();
        } catch (e) {
            console.warn("Modal already open or error:", e);
        }
    } else {
        editModal.style.display = 'flex';
    }
};

// Handle Edit Submit
const editUserForm = document.getElementById('editUserForm');
if (editUserForm) {
    editUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('editUsernameOriginal').value;
        const newDeviceCode = document.getElementById('editDeviceSelect').value;
        const currentUserData = usersData[username];
        const oldDeviceCode = currentUserData.deviceCode;

        if (newDeviceCode === oldDeviceCode) {
            document.getElementById('editUserModal').close();
            return;
        }

        // 1. Unlink old device (if any)
        if (oldDeviceCode) {
            devicesRef.child(oldDeviceCode).child('user').remove();
            // Optional: Reset old device status to 'pending'? 
            // Better to leave it as is or reset. Let's leave it, but maybe safer to reset if no user.
        }

        // 2. Link new device (if any)
        if (newDeviceCode) {
            const userStatus = currentUserData.status || (currentUserData.active ? 'active' : 'inactive');
            const newDeviceStatus = (userStatus === 'active') ? 'approved' :
                (userStatus === 'suspended') ? 'rejected' : 'pending';

            const userDataApp = {
                username: username,
                password: currentUserData.password,
                active: currentUserData.active,
                status: userStatus,
                capture_yape: currentUserData.capture_yape !== undefined ? currentUserData.capture_yape : true,
                capture_gmail: false,
                google_home_enabled: false,
                google_sheet_url: "",
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };

            // Set User Data AND Update Device Status to match User Status
            const updates = {};
            updates[`user`] = userDataApp;
            updates[`status`] = newDeviceStatus;

            devicesRef.child(newDeviceCode).update(updates);
        }

        // 3. Update User Entry
        usersRef.child(username).update({ deviceCode: newDeviceCode || null })
            .then(() => {
                alert("Dispositivo reasignado correctamente.");
                document.getElementById('editUserModal').close();
            })
            .catch(err => alert("Error: " + err.message));
    });
}

// Global Listener for Create User Button (Moved from HTML to prevent duplicates)
const btnNewUser = document.getElementById('showCreateUserModalBtn');
if (btnNewUser) {
    btnNewUser.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.showCreateUserModal) window.showCreateUserModal();
        else console.error("window.showCreateUserModal is not defined");
    });
}
