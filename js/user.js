// Initialize Firebase
const database = firebase.database();
const paymentsRef = database.ref('payments');

// DOM Elements
const statToday = document.getElementById('statToday');
const statMonth = document.getElementById('statMonth');
const statYear = document.getElementById('statYear');
const statTotal = document.getElementById('statTotal');
const paymentsTableBody = document.getElementById('paymentsTableBody');
const resultsCount = document.getElementById('resultsCount');
const userDeviceBadge = document.getElementById('userDeviceBadge');
const welcomeMsg = document.getElementById('welcomeMsg');

// Filters
const dateFilterInput = document.getElementById('dateFilter');
const nameFilterInput = document.getElementById('nameFilter');
const minAmountInput = document.getElementById('minAmountFilter');

// State
let allPayments = [];
let currentUser = null;

try {
    const userStr = localStorage.getItem('yape_user');
    if (userStr) currentUser = JSON.parse(userStr);
} catch (e) {
    console.error("Error parsing user", e);
}

let dateRange = { start: null, end: null };

// Init
if (currentUser && currentUser.role === 'user') {
    if (userDeviceBadge) userDeviceBadge.textContent = "Dispositivo: " + (currentUser.deviceCode || 'Sin Asignar');
    if (welcomeMsg) welcomeMsg.textContent = "Hola, " + currentUser.username;

    // Initialize Floatpickr
    if (dateFilterInput) {
        flatpickr(dateFilterInput, {
            mode: "range",
            dateFormat: "Y-m-d",
            onChange: function (selectedDates) {
                if (selectedDates.length === 2) {
                    dateRange.start = selectedDates[0];
                    dateRange.end = selectedDates[1];
                    dateRange.end.setHours(23, 59, 59, 999);
                } else {
                    dateRange = { start: null, end: null };
                }
                applyFilters();
            }
        });
    }

    // Fetch Payments
    fetchUserPayments();
} else {
    console.warn("No user or invalid role", currentUser);
    // window.location.href = '../index.html'; // Commented for debug
}

// ═══════════════════════════════════════════════════════════
// DATA FETCHING
// ═══════════════════════════════════════════════════════════

function fetchUserPayments() {
    console.log("Fetching payments for device:", currentUser.deviceCode);

    if (!currentUser.deviceCode) {
        alert("Error: Este usuario no tiene un dispositivo asignado.");
        return;
    }

    const query = paymentsRef.orderByChild('deviceCode').equalTo(currentUser.deviceCode);

    query.on('value', (snapshot) => {
        try {
            const data = snapshot.val();
            console.log("Data received:", data ? Object.keys(data).length : 0);

            if (data) {
                allPayments = Object.values(data);
                // Sort by Date Descending (Newest First)
                allPayments.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            } else {
                allPayments = [];
            }

            updateStats();
            applyFilters();

        } catch (err) {
            console.error("Error processing data:", err);
            if (paymentsTableBody) paymentsTableBody.innerHTML = `<tr><td colspan="4" style="color:red">Error: ${err.message}</td></tr>`;
        }
    });
}

// ═══════════════════════════════════════════════════════════
// STATS & RENDERING
// ═══════════════════════════════════════════════════════════

function updateStats() {
    let todaySum = 0;
    let monthSum = 0;
    let yearSum = 0;
    let totalSum = 0;

    const now = new Date();
    const todayStr = now.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    allPayments.forEach(p => {
        const amount = parseFloat(p.amount) || 0;
        const pDate = new Date(p.timestamp || 0);

        totalSum += amount;

        if (pDate.getFullYear() === currentYear) {
            yearSum += amount;
            if (pDate.getMonth() === currentMonth) {
                monthSum += amount;
                if (pDate.toDateString() === todayStr) {
                    todaySum += amount;
                }
            }
        }
    });

    if (statToday) statToday.textContent = `S/ ${todaySum.toFixed(2)}`;
    if (statMonth) statMonth.textContent = `S/ ${monthSum.toFixed(2)}`;
    if (statYear) statYear.textContent = `S/ ${yearSum.toFixed(2)}`;
    if (statTotal) statTotal.textContent = `S/ ${totalSum.toFixed(2)}`;
}

function renderTable(payments) {
    if (!paymentsTableBody) return;

    paymentsTableBody.innerHTML = '';
    if (resultsCount) resultsCount.textContent = `${payments.length} registros`;

    if (payments.length === 0) {
        paymentsTableBody.innerHTML = `<tr><td colspan="3" class="px-6 py-8 text-center text-slate-400">No se encontraron pagos</td></tr>`;
        return;
    }

    // Limit to 100 render items to prevent freezing if too many
    const toRender = payments.slice(0, 100);

    toRender.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors';

        const dateObj = new Date(p.timestamp || 0);
        const dateStr = dateObj.toLocaleString();

        tr.innerHTML = `
            <td class="px-6 py-4 text-slate-600 dark:text-slate-400 text-sm">${dateStr}</td>
            <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">${p.sender || 'Desconocido'}</td>
            <td class="px-6 py-4 font-bold text-emerald-600 dark:text-emerald-400">S/ ${p.amount}</td>
        `;
        paymentsTableBody.appendChild(tr);
    });
}

// ═══════════════════════════════════════════════════════════
// FILTER LOGIC
// ═══════════════════════════════════════════════════════════

function applyFilters() {
    let filtered = allPayments;

    try {
        // 1. Name Filter
        if (nameFilterInput) {
            const nameQuery = nameFilterInput.value.toLowerCase();
            if (nameQuery) {
                filtered = filtered.filter(p =>
                    (p.sender && p.sender.toLowerCase().includes(nameQuery))
                );
            }
        }

        // 2. Amount Filter
        if (minAmountInput) {
            const minAmount = parseFloat(minAmountInput.value);
            if (!isNaN(minAmount)) {
                filtered = filtered.filter(p => (parseFloat(p.amount) || 0) >= minAmount);
            }
        }

        // 3. Date Range Filter
        if (dateRange && dateRange.start && dateRange.end) {
            filtered = filtered.filter(p => {
                const pTime = p.timestamp || 0;
                return pTime >= dateRange.start.getTime() && pTime <= dateRange.end.getTime();
            });
        }

        renderTable(filtered);
    } catch (e) {
        console.error("Filter error:", e);
    }
}

// Event Listeners for Inputs
if (nameFilterInput) nameFilterInput.addEventListener('input', applyFilters);
if (minAmountInput) minAmountInput.addEventListener('input', applyFilters);
