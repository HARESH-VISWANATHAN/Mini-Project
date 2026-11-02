// ====================================================================
// VALAM SUPPLY CHAIN LOGISTICS CONTROL CENTER - FRONTEND ENGINE
// ====================================================================

// --- Application State ---
let requests = [];
let warehouses = [];
let shops = [];
let dispatches = [];
let history = [];
let itemsInNewRequest = [];
let currentFilter = 'ALL';
let searchQuery = '';

// --- Interactive Map State ---
let selectedNodeId = null;
let activePath = null;
const blockedRoads = new Set();

function roadKey(u, v) {
    return u < v ? `${u}-${v}` : `${v}-${u}`;
}

function isRoadBlocked(u, v) {
    return blockedRoads.has(roadKey(u, v));
}

// --- Road Network Graph Definition ---
// Exact geometric layout matching user diagram (Warehouses -> Junctions -> FPS Shops)
const ROAD_GRAPH = {
    nodes: {
        'W1': { name: 'Central Warehouse', type: 'warehouse', x: 150, y: 185 },
        'W2': { name: 'Regional Warehouse', type: 'warehouse', x: 150, y: 445 },
        'J1': { name: 'Junction 1', type: 'junction', x: 440, y: 105 },
        'J2': { name: 'Junction 2', type: 'junction', x: 440, y: 235 },
        'J3': { name: 'Junction 3', type: 'junction', x: 440, y: 375 },
        'J4': { name: 'Junction 4', type: 'junction', x: 440, y: 505 },
        'S1': { name: 'Bazaar FPS 1', type: 'shop', x: 730, y: 65 },
        'S2': { name: 'South FPS 2', type: 'shop', x: 730, y: 130 },
        'S3': { name: 'East FPS 3', type: 'shop', x: 730, y: 195 },
        'S4': { name: 'Lake Road FPS 4', type: 'shop', x: 730, y: 260 },
        'S5': { name: 'North Hill FPS 5', type: 'shop', x: 730, y: 335 },
        'S6': { name: 'Cantonment FPS 6', type: 'shop', x: 730, y: 400 },
        'S7': { name: 'Hill View FPS 7', type: 'shop', x: 730, y: 470 },
        'S8': { name: 'East Gate FPS 8', type: 'shop', x: 730, y: 535 }
    },
    edges: [
        { u: 'W1', v: 'J1', time: 8 },
        { u: 'W1', v: 'J2', time: 12 },
        { u: 'W2', v: 'J3', time: 10 },
        { u: 'W2', v: 'J4', time: 14 },
        { u: 'J1', v: 'J2', time: 6 },
        { u: 'J2', v: 'J3', time: 9 },
        { u: 'J3', v: 'J4', time: 7 },
        { u: 'J1', v: 'S1', time: 5 },
        { u: 'J1', v: 'S2', time: 11 },
        { u: 'S1', v: 'S2', time: 7 },
        { u: 'J2', v: 'S3', time: 4 },
        { u: 'J2', v: 'S4', time: 10 },
        { u: 'J3', v: 'S5', time: 6 },
        { u: 'J3', v: 'S6', time: 8 },
        { u: 'S5', v: 'S6', time: 5 },
        { u: 'J4', v: 'S7', time: 5 },
        { u: 'J4', v: 'S8', time: 9 }
    ]
};

// --- Dijkstra Shortest Path Algorithm ---
function dijkstra(startNode, endNode) {
    const adj = {};
    for (const node in ROAD_GRAPH.nodes) adj[node] = [];
    for (const edge of ROAD_GRAPH.edges) {
        if (isRoadBlocked(edge.u, edge.v)) continue; // skip blocked road segment
        adj[edge.u].push({ dest: edge.v, time: edge.time });
        adj[edge.v].push({ dest: edge.u, time: edge.time });
    }

    const times = {};
    const prev = {};
    const visited = new Set();
    const queue = [];

    for (const node in ROAD_GRAPH.nodes) {
        times[node] = Infinity;
        prev[node] = null;
    }
    times[startNode] = 0;
    queue.push({ node: startNode, time: 0 });

    while (queue.length > 0) {
        queue.sort((a, b) => a.time - b.time);
        const { node: curr, time: currTime } = queue.shift();

        if (visited.has(curr)) continue;
        visited.add(curr);

        if (curr === endNode) break;

        for (const neighbor of adj[curr]) {
            if (visited.has(neighbor.dest)) continue;
            const alt = currTime + neighbor.time;
            if (alt < times[neighbor.dest]) {
                times[neighbor.dest] = alt;
                prev[neighbor.dest] = curr;
                queue.push({ node: neighbor.dest, time: alt });
            }
        }
    }

    if (times[endNode] === Infinity) return null;

    const path = [];
    let step = endNode;
    while (step !== null) {
        path.unshift(step);
        step = prev[step];
    }
    return { time: times[endNode], path };
}

// Smallest vehicle selection based on load capacity
function selectVehicle(loadKg) {
    if (loadKg <= 0) return null;
    if (loadKg <= 500) {
        return { id: 'V001', type: 'Small Van', maxCapacity: 500, minLoad: 0 };
    } else if (loadKg <= 600) {
        return { id: 'V002', type: 'Small Van', maxCapacity: 600, minLoad: 0 };
    } else if (loadKg <= 2000 && loadKg >= 250) {
        return { id: 'V003', type: 'Supply Truck', maxCapacity: 2000, minLoad: 250 };
    }
    return null;
}

// --- Toast Notification System ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// --- Modal Management ---
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });
});

// --- Tab Navigation & View Switcher ---
const SECTION_TITLES = {
    'dashboard': { icon: '📊', title: 'Dashboard Overview', desc: 'Live district replenishment metrics & allocation status' },
    'requests': { icon: '📋', title: 'Delivery Requests Priority Queue', desc: 'Shortages ordered by operator urgency (Level 1–5) and arrival sequence' },
    'warehouses': { icon: '🏭', title: 'District Warehouses', desc: 'Central (W1) and Regional (W2) commodity stock reserves' },
    'shops': { icon: '🏪', title: 'Fair Price Shops Network', desc: '8 distributed public distribution ration outlets across Valam' },
    'vehicles': { icon: '🚚', title: 'Delivery Fleet Allocation', desc: 'Small vans & supply trucks with dynamic payload constraints' },
    'routes': { icon: '🗺️', title: 'Route Network (Dijkstra Visualizer)', desc: 'Interactive 14-location road graph with live road blockage simulation' },
    'new-request': { icon: '➕', title: 'Submit Shortage Request', desc: 'Add a ration shop shortage requirement to priority replenishment queue' },
    'dispatches': { icon: '📦', title: 'Dispatches & Consignment Receipts', desc: 'Track active vehicles on the road and confirm delivery arrivals at shops' },
    'history': { icon: '📜', title: 'Delivery Audit History', desc: 'Verified record of completed consignments and confirmed inventory receipts' }
};

function switchTab(sectionId) {
    document.querySelectorAll('.tab, .nav-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    const tabButtons = document.querySelectorAll(`.tab[data-section="${sectionId}"], .nav-item[data-section="${sectionId}"]`);
    const section = document.getElementById(sectionId);

    tabButtons.forEach(btn => btn.classList.add('active'));
    if (section) section.classList.add('active');

    // Update topbar breadcrumb view title
    const meta = SECTION_TITLES[sectionId] || { icon: '📦', title: 'Valam Logistics', desc: 'District PDS Command' };
    const iconEl = document.getElementById('topbar-view-icon');
    const titleEl = document.getElementById('topbar-view-title');
    const descEl = document.getElementById('topbar-view-subtitle');

    if (iconEl) iconEl.textContent = meta.icon;
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;

    if (sectionId === 'routes') {
        renderSvgMap();
    }
}

document.querySelectorAll('.tab, .nav-item').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.section));
});

// --- Data Fetching and Synchronization ---
async function loadData() {
    const banner = document.getElementById('config-banner');
    const statusPill = document.getElementById('supabase-status-pill');

    if (!isSupabaseConfigured()) {
        if (banner) banner.style.display = 'block';
        if (statusPill) statusPill.innerHTML = '<span class="dot" style="background:#ef4444;box-shadow:none;"></span><span>Not Connected</span>';
        return;
    }

    if (banner) banner.style.display = 'none';
    if (statusPill) statusPill.innerHTML = '<span class="dot"></span><span>Supabase Live</span>';

    const client = getSupabaseClient();
    if (!client) return;

    try {
        const [
            { data: whData, error: whErr },
            { data: reqData, error: reqErr },
            { data: shopData, error: shopErr },
            { data: itemsData, error: itemsErr }
        ] = await Promise.all([
            client.from('warehouses').select('*').order('warehouse_id', { ascending: true }),
            client.from('delivery_requests').select('*').order('urgency', { ascending: false }).order('arrival_order', { ascending: true }),
            client.from('shops').select('*').order('shop_id', { ascending: true }),
            client.from('request_items').select('*')
        ]);

        if (whErr) throw whErr;
        if (reqErr) throw reqErr;
        if (shopErr) throw shopErr;

        const itemsByReq = {};
        (itemsData || []).forEach(item => {
            if (!itemsByReq[item.request_id]) itemsByReq[item.request_id] = [];
            itemsByReq[item.request_id].push(item);
        });

        warehouses = (whData || []).map(w => ({
            id: w.warehouse_id,
            name: w.warehouse_name,
            rice: Number(w.rice_kg || 0),
            wheat: Number(w.wheat_kg || 0),
            sugar: Number(w.sugar_kg || 0),
            total: Number(w.rice_kg || 0) + Number(w.wheat_kg || 0) + Number(w.sugar_kg || 0)
        }));

        shops = (shopData || []).map(s => ({
            id: s.shop_id,
            name: s.shop_name,
            location: s.location_name,
            rice: Number(s.rice_kg || 0),
            wheat: Number(s.wheat_kg || 0),
            sugar: Number(s.sugar_kg || 0),
            total: Number(s.rice_kg || 0) + Number(s.wheat_kg || 0) + Number(s.sugar_kg || 0)
        }));

        requests = (reqData || []).map(r => {
            const reqItems = itemsByReq[r.request_id] || [];
            const itemsStr = reqItems.length
                ? reqItems.map(i => `${i.commodity_name}: ${i.quantity_kg}kg`).join(", ")
                : r.details || "";

            return {
                id: r.request_id,
                shop: r.shop_id,
                urgency: Number(r.urgency),
                items: itemsStr,
                total: Number(r.total_kg || 0),
                status: r.status,
                details: r.details || "",
                arrival: Number(r.arrival_order || 0),
                itemsList: reqItems,
                createdAt: r.created_at
            };
        });

        dispatches = requests.filter(r => r.status === 'DISPATCHED').map(r => {
            const vehicle = selectVehicle(r.total) || { id: 'V001', type: 'Small Van' };
            return {
                requestId: r.id,
                shop: r.shop,
                vehicle: vehicle.id + ' (' + vehicle.type + ')',
                cargo: r.items,
                details: r.details,
                total: r.total
            };
        });

        history = requests.filter(r => r.status === 'DELIVERED').map((r, idx) => ({
            receiptId: `RC${String(idx + 1).padStart(3, '0')}`,
            requestId: r.id,
            shop: r.shop,
            details: r.details || `Delivered to ${r.shop}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));

        renderAll();
    } catch (error) {
        console.error("Supabase load error:", error);
        showToast(`Supabase sync failed: ${error.message}`, 'error');
    }
}

// --- Render Functions ---
function renderAll() {
    renderKPIs();
    renderDashboardStock();
    renderTimeline();
    renderRequests();
    renderWarehouses();
    renderShops();
    renderFleet();
    renderDispatches();
    renderHistory();
    renderNewRequestShopOptions();
    renderSvgMap(activePath);
    renderAuthWidget();
}

// 1. KPI Cards
function renderKPIs() {
    const pending = requests.filter(r => r.status === 'PENDING');
    const dispatched = requests.filter(r => r.status === 'DISPATCHED');
    const delivered = requests.filter(r => r.status === 'DELIVERED');

    const criticalCount = pending.filter(r => r.urgency === 5).length;
    const dispatchedWeight = dispatched.reduce((sum, r) => sum + r.total, 0);

    const w1 = warehouses.find(w => w.id === 'W1') || { total: 0 };
    const w2 = warehouses.find(w => w.id === 'W2') || { total: 0 };

    document.getElementById('kpi-pending-count').textContent = pending.length;
    document.getElementById('kpi-critical-subtext').textContent = `${criticalCount} emergency priority`;
    document.getElementById('kpi-dispatched-count').textContent = dispatched.length;
    document.getElementById('kpi-dispatched-weight').textContent = `${dispatchedWeight.toLocaleString()} kg on route`;
    document.getElementById('kpi-delivered-count').textContent = delivered.length;
    document.getElementById('kpi-w1-total').textContent = `${w1.total.toLocaleString()} kg`;
    document.getElementById('kpi-w2-total').textContent = `${w2.total.toLocaleString()} kg`;

    document.getElementById('badge-requests-count').textContent = pending.length;
    document.getElementById('badge-dispatches-count').textContent = dispatched.length;

    document.getElementById('count-all').textContent = requests.length;
    document.getElementById('count-pending').textContent = pending.length;
    document.getElementById('count-dispatched').textContent = dispatched.length;
    document.getElementById('count-delivered').textContent = delivered.length;
}

// 2. Dashboard Stock Progress Bars
function renderDashboardStock() {
    const container = document.getElementById('dashboard-stock-grid');
    if (!container) return;

    container.innerHTML = warehouses.map(wh => {
        const maxCapacity = wh.id === 'W1' ? 3000 : 2000;
        const ricePct = Math.min(100, (wh.rice / (maxCapacity * 0.4)) * 100).toFixed(0);
        const wheatPct = Math.min(100, (wh.wheat / (maxCapacity * 0.35)) * 100).toFixed(0);
        const sugarPct = Math.min(100, (wh.sugar / (maxCapacity * 0.25)) * 100).toFixed(0);

        return `
            <div class="warehouse-stock-card">
                <div class="wh-title">
                    <h4>${wh.name} (${wh.id})</h4>
                    <span class="wh-badge">Reserves: ${wh.total.toLocaleString()} kg</span>
                </div>
                <div class="commodity-bar-group">
                    <div class="commodity-label"><span>🌾 Rice</span><span>${wh.rice.toLocaleString()} kg</span></div>
                    <div class="progress-track"><div class="progress-fill fill-rice" style="width:${ricePct}%"></div></div>
                </div>
                <div class="commodity-bar-group">
                    <div class="commodity-label"><span>🥖 Wheat</span><span>${wh.wheat.toLocaleString()} kg</span></div>
                    <div class="progress-track"><div class="progress-fill fill-wheat" style="width:${wheatPct}%"></div></div>
                </div>
                <div class="commodity-bar-group">
                    <div class="commodity-label"><span>🍬 Sugar</span><span>${wh.sugar.toLocaleString()} kg</span></div>
                    <div class="progress-track"><div class="progress-fill fill-sugar" style="width:${sugarPct}%"></div></div>
                </div>
                <button class="btn-secondary btn-sm" style="width:100%;margin-top:12px;" onclick="openStockModal('${wh.id}')">
                    ✏️ Update Inventory
                </button>
            </div>
        `;
    }).join('');
}

// 3. Activity Timeline
function renderTimeline() {
    const list = document.getElementById('activity-timeline');
    if (!list) return;

    const events = [];
    requests.forEach(r => {
        if (r.status === 'DELIVERED') {
            events.push({
                type: 'delivered',
                title: `${r.id} Delivered to ${r.shop}`,
                desc: `${r.total} kg commodities confirmed at FPS store`,
                time: 'Verified'
            });
        } else if (r.status === 'DISPATCHED') {
            events.push({
                type: 'dispatched',
                title: `${r.id} In Transit ➔ ${r.shop}`,
                desc: r.details || `Vehicle dispatched via shortest road route`,
                time: 'Active'
            });
        } else {
            events.push({
                type: 'pending',
                title: `${r.id} Waiting in Allocation Queue`,
                desc: `Shop ${r.shop} shortage (Urgency: Level ${r.urgency})`,
                time: 'Queued'
            });
        }
    });

    if (!events.length) {
        list.innerHTML = `<li style="color:var(--text-muted);font-size:13px;padding:10px 0;">No operational events recorded yet.</li>`;
        return;
    }

    list.innerHTML = events.slice(0, 6).map(e => `
        <li class="timeline-item">
            <div class="timeline-dot dot-${e.type}"></div>
            <div class="timeline-content">
                <strong>${e.title}</strong>
                <div style="font-size:12px;color:var(--text-secondary);">${e.desc}</div>
                <div class="timeline-time">${e.time}</div>
            </div>
        </li>
    `).join('');
}

// 4. Requests Table
function renderRequests() {
    const tbody = document.getElementById('request-rows');
    if (!tbody) return;

    let filtered = [...requests];

    if (currentFilter !== 'ALL') {
        filtered = filtered.filter(r => r.status === currentFilter);
    }

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(r =>
            r.id.toLowerCase().includes(q) ||
            r.shop.toLowerCase().includes(q) ||
            r.items.toLowerCase().includes(q) ||
            (r.details && r.details.toLowerCase().includes(q))
        );
    }

    filtered.sort((a, b) => b.urgency - a.urgency || a.arrival - b.arrival || a.id.localeCompare(b.id));

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8">
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <div class="empty-text">No delivery requests found</div>
                        <div class="empty-subtext">No matching requests match the selected filter criteria.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'ADMIN';
    const isDealer = currentUser && currentUser.role === 'SHOP_DEALER';
    const dealerShopId = isDealer ? currentUser.assignedShopId : null;

    tbody.innerHTML = filtered.map(r => {
        let statusBadge = `<span class="badge badge-pending">PENDING</span>`;
        if (r.status === 'DISPATCHED') statusBadge = `<span class="badge badge-dispatched">IN TRANSIT</span>`;
        if (r.status === 'DELIVERED') statusBadge = `<span class="badge badge-delivered">DELIVERED</span>`;

        const urgencyBadge = `<span class="badge-urgency urgency-${r.urgency}">L${r.urgency}</span>`;

        const itemsChips = r.itemsList && r.itemsList.length
            ? r.itemsList.map(i => `<span class="item-chip">${i.commodity_name}: ${i.quantity_kg}kg</span>`).join('')
            : r.items;

        const isUserShop = isDealer && r.shop === dealerShopId;
        const rowClass = isUserShop ? 'row-assigned-shop' : '';
        const shopLabel = isUserShop 
            ? `<strong>${r.shop}</strong> <span class="tag-your-shop">YOUR SHOP</span>` 
            : `<strong>${r.shop}</strong>`;

        let actionHtml = '';
        if (r.status === 'PENDING') {
            if (isAdmin) {
                actionHtml = `
                    <button class="btn-primary btn-sm" onclick="processSpecificRequest('${r.id}')" title="Dispatch this request">
                        ⚡ Dispatch
                    </button>
                    <button class="btn-secondary btn-sm" onclick="openUrgencyModal('${r.id}', ${r.urgency})" title="Edit urgency">
                        ✏️
                    </button>
                `;
            } else if (isUserShop) {
                actionHtml = `
                    <button class="btn-secondary btn-sm" onclick="openUrgencyModal('${r.id}', ${r.urgency})" title="Edit urgency">
                        ✏️ Edit Urgency
                    </button>
                `;
            } else {
                actionHtml = `<span style="font-size:11px;color:var(--text-muted);font-weight:600;">Queued</span>`;
            }
        } else if (r.status === 'DISPATCHED') {
            if (isAdmin || isUserShop) {
                actionHtml = `
                    <button class="btn-success btn-sm" onclick="confirmSpecificReceipt('${r.id}', '${r.shop}')">
                        ✅ Confirm Arrival
                    </button>
                `;
            } else {
                actionHtml = `<span style="font-size:11px;color:var(--text-muted);font-weight:600;">In Transit to ${r.shop}</span>`;
            }
        } else if (r.status === 'DELIVERED') {
            actionHtml = `<span style="color:var(--success);font-weight:600;font-size:12px;">Completed</span>`;
        }

        return `
            <tr class="${rowClass}">
                <td style="font-weight:700;color:var(--navy-900);">${r.id}</td>
                <td>${shopLabel}</td>
                <td>${urgencyBadge}</td>
                <td>${itemsChips}</td>
                <td><strong>${r.total.toFixed(1)} kg</strong></td>
                <td>${statusBadge}</td>
                <td style="font-size:12px;color:var(--text-secondary);max-width:280px;white-space:normal;">
                    ${r.details || '—'}
                </td>
                <td>
                    <div style="display:flex;gap:6px;align-items:center;">
                        ${actionHtml}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 5. Warehouses View
function renderWarehouses() {
    const cards = document.getElementById('warehouses-cards-container');
    const tbody = document.getElementById('warehouse-table-rows');
    if (!cards || !tbody) return;

    const isAdmin = currentUser && currentUser.role === 'ADMIN';

    cards.innerHTML = warehouses.map(wh => `
        <div class="warehouse-stock-card">
            <div class="wh-title">
                <h4>${wh.name} (${wh.id})</h4>
                <span class="badge badge-delivered">Operational</span>
            </div>
            <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
                Connected to Road Network via ${wh.id === 'W1' ? 'Junctions J1 & J2' : 'Junctions J3 & J4'}
            </p>
            <div class="commodity-bar-group">
                <div class="commodity-label"><span>Rice on hand:</span><span>${wh.rice} kg</span></div>
                <div class="commodity-label"><span>Wheat on hand:</span><span>${wh.wheat} kg</span></div>
                <div class="commodity-label"><span>Sugar on hand:</span><span>${wh.sugar} kg</span></div>
            </div>
            ${isAdmin ? `
                <button class="btn-primary btn-sm" style="width:100%;margin-top:10px;" onclick="openStockModal('${wh.id}')">
                    ✏️ Update Warehouse Inventory
                </button>
            ` : `
                <button class="btn-secondary btn-sm" style="width:100%;margin-top:10px;opacity:0.65;cursor:not-allowed;" onclick="showToast('Admin privilege required to modify warehouse inventory.', 'warning')">
                    🔒 Edit Inventory (Admin Only)
                </button>
            `}
        </div>
    `).join('');

    tbody.innerHTML = warehouses.map(wh => `
        <tr>
            <td style="font-weight:700;">${wh.id}</td>
            <td><strong>${wh.name}</strong></td>
            <td>${wh.rice.toFixed(1)} kg</td>
            <td>${wh.wheat.toFixed(1)} kg</td>
            <td>${wh.sugar.toFixed(1)} kg</td>
            <td><strong>${wh.total.toFixed(1)} kg</strong></td>
            <td><span class="badge badge-delivered">AVAILABLE</span></td>
            <td>
                ${isAdmin ? `
                    <button class="btn-secondary btn-sm" onclick="openStockModal('${wh.id}')">Edit Stock</button>
                ` : `
                    <span style="font-size:11px;color:var(--text-muted);font-weight:600;">🔒 Admin Only</span>
                `}
            </td>
        </tr>
    `).join('');
}

// 6. Fair Price Shops View
function renderShops() {
    const tbody = document.getElementById('shops-table-rows');
    if (!tbody) return;

    tbody.innerHTML = shops.map(s => {
        let statusBadge = `<span class="badge badge-delivered">Normal</span>`;
        if (s.total < 100) statusBadge = `<span class="badge badge-pending">Low Inventory</span>`;

        return `
            <tr>
                <td style="font-weight:700;">${s.id}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.location}</td>
                <td>${s.rice.toFixed(1)} kg</td>
                <td>${s.wheat.toFixed(1)} kg</td>
                <td>${s.sugar.toFixed(1)} kg</td>
                <td><strong>${s.total.toFixed(1)} kg</strong></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// 7. Vehicle Fleet View
function renderFleet() {
    const container = document.getElementById('fleet-grid-container');
    if (!container) return;

    const vehiclesList = [
        { id: 'V001', type: 'Small Van', maxKg: 500, minKg: 0, status: 'AVAILABLE' },
        { id: 'V002', type: 'Small Van', maxKg: 600, minKg: 0, status: 'AVAILABLE' },
        { id: 'V003', type: 'Supply Truck', maxKg: 2000, minKg: 250, status: 'AVAILABLE' }
    ];

    dispatches.forEach((d, i) => {
        if (vehiclesList[i]) {
            vehiclesList[i].status = 'IN TRANSIT';
            vehiclesList[i].currentLoad = d.total;
            vehiclesList[i].assignedShop = d.shop;
        }
    });

    container.innerHTML = vehiclesList.map(v => {
        const isBusy = v.status === 'IN TRANSIT';
        const badge = isBusy
            ? `<span class="badge badge-dispatched">ON ROUTE</span>`
            : `<span class="badge badge-delivered">READY</span>`;

        return `
            <div class="vehicle-card">
                <div class="vehicle-header">
                    <div>
                        <div class="vehicle-id">${v.id}</div>
                        <div class="vehicle-type">${v.type}</div>
                    </div>
                    ${badge}
                </div>
                <div class="vehicle-specs">
                    <div><span class="spec-label">Max Payload:</span> <span class="spec-val">${v.maxKg} kg</span></div>
                    <div><span class="spec-label">Min Threshold:</span> <span class="spec-val">${v.minKg} kg</span></div>
                    <div><span class="spec-label">Fuel / Fleet:</span> <span class="spec-val">District Depot</span></div>
                    <div><span class="spec-label">Road Class:</span> <span class="spec-val">All Roads</span></div>
                </div>
                ${isBusy ? `
                    <div style="background:#eff6ff;padding:10px;border-radius:var(--radius-sm);font-size:12px;color:var(--primary);">
                        <strong>En Route:</strong> Carrying ${v.currentLoad} kg to FPS <strong>${v.assignedShop}</strong>
                    </div>
                ` : `
                    <div style="font-size:12px;color:var(--text-muted);">
                        Available for allocation on next matching payload.
                    </div>
                `}
            </div>
        `;
    }).join('');
}

// 8. Dispatches View
function renderDispatches() {
    const tbody = document.getElementById('dispatch-rows');
    if (!tbody) return;

    if (!dispatches.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">🚚</div>
                        <div class="empty-text">No active dispatches on the road</div>
                        <div class="empty-subtext">Process requests from the Requests tab to dispatch cargo.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const isAdmin = currentUser && currentUser.role === 'ADMIN';
    const isDealer = currentUser && currentUser.role === 'SHOP_DEALER';
    const dealerShopId = isDealer ? currentUser.assignedShopId : null;

    tbody.innerHTML = dispatches.map((d, index) => {
        const isUserShop = isDealer && d.shop === dealerShopId;
        const rowClass = isUserShop ? 'row-assigned-shop' : '';
        const shopLabel = isUserShop 
            ? `<strong>${d.shop}</strong> <span class="tag-your-shop">YOUR SHOP</span>` 
            : `<strong>${d.shop}</strong>`;

        let actionHtml = '';
        if (isAdmin) {
            actionHtml = `
                <button class="btn-success btn-sm" onclick="confirmReceipt(${index})">
                    ✅ Confirm Receipt
                </button>
            `;
        } else if (isUserShop) {
            actionHtml = `
                <button class="btn-success btn-sm" onclick="confirmReceipt(${index})">
                    ✅ Confirm Shop ${d.shop} Receipt
                </button>
            `;
        } else if (isDealer) {
            actionHtml = `<span style="font-size:11px;color:var(--text-muted);font-weight:600;">🔒 Awaiting ${d.shop} Dealer</span>`;
        } else {
            actionHtml = `
                <button class="btn-secondary btn-sm" onclick="openAuthModal('login')">
                    Sign In to Verify
                </button>
            `;
        }

        return `
            <tr class="${rowClass}">
                <td style="font-weight:700;">${d.requestId}</td>
                <td>${shopLabel}</td>
                <td><span class="badge badge-dispatched">${d.vehicle}</span></td>
                <td>${d.cargo}</td>
                <td>
                    <span class="route-path">
                        ${d.details.replace(' -> ', ' <span class="route-arrow">➔</span> ')}
                    </span>
                </td>
                <td>
                    ${actionHtml}
                </td>
            </tr>
        `;
    }).join('');
}

// 9. History Audit Log
function renderHistory() {
    const tbody = document.getElementById('history-rows');
    if (!tbody) return;

    if (!history.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <div class="empty-icon">📜</div>
                        <div class="empty-text">No delivery history yet</div>
                        <div class="empty-subtext">Delivered consignments will appear here once receipt is confirmed.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = history.map(h => `
        <tr>
            <td style="font-weight:700;color:var(--navy-700);">${h.receiptId}</td>
            <td><strong>${h.requestId}</strong></td>
            <td>${h.shop}</td>
            <td>${h.timestamp}</td>
            <td style="font-size:12px;color:var(--text-secondary);">${h.details}</td>
            <td><span class="badge badge-delivered">VERIFIED</span></td>
        </tr>
    `).join('');
}

function renderNewRequestShopOptions() {
    const select = document.getElementById('new-request-shop-select') || document.querySelector('select[name="shop"]');
    if (select && shops.length) {
        select.innerHTML = shops.map(s =>
            `<option value="${s.id}">${s.id} - ${s.name} (${s.location})</option>`
        ).join('');
    }
    applyRoleToNewRequest();
}

// ====================================================================
// --- INTERACTIVE ROAD NETWORK MAP & DIJKSTRA VISUALIZER ---
// ====================================================================

function renderSvgMap(highlightedPath = null) {
    const wrapper = document.getElementById('svg-map-wrapper');
    if (!wrapper) return;

    let svg = `
        <svg viewBox="0 0 960 620" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="font-family:inherit;">
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
    `;

    // 1. Draw Edges (Roads)
    ROAD_GRAPH.edges.forEach(edge => {
        const u = ROAD_GRAPH.nodes[edge.u];
        const v = ROAD_GRAPH.nodes[edge.v];
        if (!u || !v) return;

        const blocked = isRoadBlocked(edge.u, edge.v);

        let isHighlighted = false;
        if (highlightedPath && highlightedPath.length > 1) {
            for (let i = 0; i < highlightedPath.length - 1; i++) {
                if ((highlightedPath[i] === edge.u && highlightedPath[i + 1] === edge.v) ||
                    (highlightedPath[i] === edge.v && highlightedPath[i + 1] === edge.u)) {
                    isHighlighted = true;
                    break;
                }
            }
        }

        let edgeClass = 'map-edge';
        if (isHighlighted) edgeClass += ' edge-highlighted';
        if (blocked) edgeClass += ' edge-blocked';

        svg += `
            <line class="${edgeClass}" x1="${u.x}" y1="${u.y}" x2="${v.x}" y2="${v.y}" onclick="toggleRoadBlock('${edge.u}', '${edge.v}')" />
        `;

        // Midpoint badge
        const midX = (u.x + v.x) / 2;
        const midY = (u.y + v.y) / 2;

        svg += `
            <g class="edge-badge ${blocked ? 'badge-blocked' : ''}" transform="translate(${midX}, ${midY})" onclick="toggleRoadBlock('${edge.u}', '${edge.v}')" title="Click to ${blocked ? 'reopen' : 'block'} road ${edge.u}-${edge.v}">
                <rect x="-17" y="-11" width="34" height="22" />
                <text>${blocked ? '🚫' : edge.time + 'm'}</text>
            </g>
        `;
    });

    // 2. Draw Nodes (Warehouses, Junctions, Shops)
    for (const [id, node] of Object.entries(ROAD_GRAPH.nodes)) {
        const isSelected = selectedNodeId === id;
        const isPathNode = highlightedPath && highlightedPath.includes(id);

        let nodeClass = `map-node node-${node.type}`;
        if (isSelected || isPathNode) nodeClass += ' node-selected';

        svg += `
            <g class="${nodeClass}" transform="translate(${node.x}, ${node.y})" onclick="selectMapNode('${id}')">
                <circle class="node-bg" r="17" />
                <text class="node-text-id">${id}</text>
                <text class="node-label" x="25">${node.name}</text>
            </g>
        `;
    }

    svg += `</svg>`;
    wrapper.innerHTML = svg;
}

// Toggle Road Blockage (Incident Simulator)
window.toggleRoadBlock = function(u, v) {
    if (!currentUser) {
        showToast('Please sign in as District Supply Officer (Admin) to simulate road disruptions.', 'warning');
        openAuthModal('login');
        return;
    }
    if (currentUser.role !== 'ADMIN') {
        showToast('Access restricted: Only District Supply Officers (Admin) can simulate road disruptions.', 'warning');
        return;
    }

    const key = roadKey(u, v);
    if (blockedRoads.has(key)) {
        blockedRoads.delete(key);
        showToast(`🛣️ Road segment [${u} - ${v}] is now REOPENED.`, 'success');
    } else {
        blockedRoads.add(key);
        showToast(`🚫 Road segment [${u} - ${v}] is now BLOCKED (Road Closed).`, 'warning');
    }

    // Recompute path if one was active
    if (activePath && activePath.length >= 2) {
        const origin = activePath[0];
        const dest = activePath[activePath.length - 1];
        const res = dijkstra(origin, dest);
        if (res) {
            activePath = res.path;
            showRouteSummaryInInspector(origin, dest, res);
        } else {
            activePath = null;
            showToast(`No open road path connects ${origin} to ${dest} with current road closures.`, 'error');
        }
    }

    renderSvgMap(activePath);
};

// Select and Inspect Node
window.selectMapNode = function(nodeId) {
    selectedNodeId = nodeId;
    const node = ROAD_GRAPH.nodes[nodeId];
    if (!node) return;

    renderSvgMap(activePath);
    renderNodeInspector(nodeId, node);
};

function renderNodeInspector(id, node) {
    const panel = document.getElementById('inspector-content');
    const badge = document.getElementById('inspector-badge');
    if (!panel) return;

    if (badge) {
        badge.textContent = node.type.toUpperCase();
        badge.className = `badge ${node.type === 'warehouse' ? 'badge-dispatched' : (node.type === 'shop' ? 'badge-delivered' : 'badge-pending')}`;
    }

    let icon = '🏭';
    if (node.type === 'shop') icon = '🏪';
    if (node.type === 'junction') icon = '🔀';

    let contentHtml = `
        <div class="inspector-node-chip">
            <div class="inspector-node-badge" style="background:${node.type === 'warehouse' ? '#2563eb' : (node.type === 'shop' ? '#10b981' : '#1e293b')};">
                ${icon}
            </div>
            <div class="inspector-title">
                <h3>${node.name}</h3>
                <span>Node ID: <strong>${id}</strong> (${node.type})</span>
            </div>
        </div>
    `;

    if (node.type === 'warehouse') {
        const wh = warehouses.find(w => w.id === id) || { rice: 0, wheat: 0, sugar: 0, total: 0 };
        contentHtml += `
            <div class="inspector-section">
                <label>Current Stock Reserves</label>
                <div class="inspector-stock-row"><span>🌾 Rice:</span><strong>${wh.rice.toLocaleString()} kg</strong></div>
                <div class="inspector-stock-row"><span>🥖 Wheat:</span><strong>${wh.wheat.toLocaleString()} kg</strong></div>
                <div class="inspector-stock-row"><span>🍬 Sugar:</span><strong>${wh.sugar.toLocaleString()} kg</strong></div>
                <div class="inspector-stock-row" style="border-top:1px solid #cbd5e1;margin-top:4px;padding-top:4px;">
                    <span><strong>Total Load:</strong></span><strong>${wh.total.toLocaleString()} kg</strong>
                </div>
            </div>
            <div class="inspector-actions">
                <button class="btn-primary btn-sm" onclick="setAsRouteOrigin('${id}')">
                    🧭 Set as Route Origin
                </button>
                <button class="btn-secondary btn-sm" onclick="openStockModal('${id}')">
                    ✏️ Update Stock in Supabase
                </button>
            </div>
        `;
    } else if (node.type === 'shop') {
        const sh = shops.find(s => s.id === id) || { rice: 0, wheat: 0, sugar: 0, total: 0, location: 'Market' };
        const shopReqs = requests.filter(r => r.shop === id && r.status === 'PENDING');
        const shopInTransit = requests.filter(r => r.shop === id && r.status === 'DISPATCHED');

        contentHtml += `
            <div class="inspector-section">
                <label>Store Location</label>
                <div style="font-size:13px;font-weight:600;color:var(--navy-800);">${sh.location}</div>
            </div>
            <div class="inspector-section">
                <label>Inventory on Hand</label>
                <div class="inspector-stock-row"><span>🌾 Rice:</span><strong>${sh.rice.toLocaleString()} kg</strong></div>
                <div class="inspector-stock-row"><span>🥖 Wheat:</span><strong>${sh.wheat.toLocaleString()} kg</strong></div>
                <div class="inspector-stock-row"><span>🍬 Sugar:</span><strong>${sh.sugar.toLocaleString()} kg</strong></div>
            </div>
            <div class="inspector-section">
                <label>Active Delivery Status</label>
                <div style="font-size:12px;color:var(--text-secondary);">
                    Pending in Queue: <strong>${shopReqs.length}</strong><br>
                    In Transit: <strong>${shopInTransit.length}</strong>
                </div>
            </div>
            <div class="inspector-actions">
                <button class="btn-primary btn-sm" onclick="setAsRouteDest('${id}')">
                    🧭 Set as Route Destination
                </button>
                <button class="btn-secondary btn-sm" onclick="prepareRequestForShop('${id}')">
                    ➕ New Shortage Request
                </button>
            </div>
        `;
    } else {
        // Junction
        const connectedEdges = ROAD_GRAPH.edges.filter(e => e.u === id || e.v === id);
        contentHtml += `
            <div class="inspector-section">
                <label>Connected Road Segments</label>
                ${connectedEdges.map(e => {
                    const target = e.u === id ? e.v : e.u;
                    const blocked = isRoadBlocked(e.u, e.v);
                    return `
                        <div class="inspector-stock-row">
                            <span>To <strong>${target}</strong> (${ROAD_GRAPH.nodes[target].name}):</span>
                            <span><strong>${e.time}m</strong> ${blocked ? '<span style="color:var(--danger)">[CLOSED]</span>' : '✅'}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:10px;">
                💡 Click any road badge to simulate a blockage or detour around this junction.
            </div>
        `;
    }

    panel.innerHTML = contentHtml;
}

function renderInspectorEmpty() {
    const panel = document.getElementById('inspector-content');
    const badge = document.getElementById('inspector-badge');
    if (badge) {
        badge.textContent = 'Ready';
        badge.className = 'badge badge-dispatched';
    }
    if (panel) {
        panel.innerHTML = `
            <div class="empty-state" style="padding: 30px 10px;">
                <div class="empty-icon">📍</div>
                <div class="empty-text">Click any node or road</div>
                <div class="empty-subtext">Click any warehouse, junction, or shop on the map to inspect live data or click a road badge to simulate a blockage.</div>
            </div>
        `;
    }
}

window.setAsRouteOrigin = function(id) {
    const sel = document.getElementById('route-calc-origin');
    if (sel) sel.value = id;
    computeRouteFromInputs();
};

window.setAsRouteDest = function(id) {
    const sel = document.getElementById('route-calc-dest');
    if (sel) sel.value = id;
    computeRouteFromInputs();
};

window.prepareRequestForShop = function(shopId) {
    switchTab('new-request');
    const sel = document.querySelector('select[name="shop"]');
    if (sel) sel.value = shopId;
};

function computeRouteFromInputs() {
    const origin = document.getElementById('route-calc-origin').value;
    const dest = document.getElementById('route-calc-dest').value;
    const result = dijkstra(origin, dest);

    if (!result) {
        activePath = null;
        renderSvgMap();
        showToast(`No open road route connects ${origin} to ${dest}.`, 'error');
        return;
    }

    activePath = result.path;
    renderSvgMap(activePath);
    showRouteSummaryInInspector(origin, dest, result);
    showToast(`Dijkstra route found: ${result.path.join(' ➔ ')} (${result.time}m)`, 'success');
}

function showRouteSummaryInInspector(origin, dest, result) {
    const panel = document.getElementById('inspector-content');
    const badge = document.getElementById('inspector-badge');
    if (!panel) return;

    if (badge) {
        badge.textContent = `${result.time} MINS`;
        badge.className = 'badge badge-dispatched';
    }

    panel.innerHTML = `
        <div class="inspector-node-chip">
            <div class="inspector-node-badge" style="background:#2563eb;">🚀</div>
            <div class="inspector-title">
                <h3>Optimal Road Route</h3>
                <span>From <strong>${origin}</strong> to <strong>${dest}</strong></span>
            </div>
        </div>
        <div class="inspector-route-summary">
            <div class="route-time">${result.time} Minutes</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
                Total Road Segments: <strong>${result.path.length - 1}</strong>
            </div>
            <div style="font-weight:700;font-size:13px;color:var(--navy-900);line-height:1.6;">
                Path: ${result.path.map(p => `<strong>${p}</strong>`).join(' ➔ ')}
            </div>
        </div>
        <div class="inspector-section" style="margin-top:16px;">
            <label>Route Turn-by-Turn</label>
            ${result.path.map((node, i) => {
                if (i === result.path.length - 1) return '';
                const nextNode = result.path[i + 1];
                const edge = ROAD_GRAPH.edges.find(e => (e.u === node && e.v === nextNode) || (e.v === node && e.u === nextNode));
                return `
                    <div class="inspector-stock-row">
                        <span>${node} ➔ ${nextNode}:</span>
                        <strong>${edge ? edge.time + ' mins' : ''}</strong>
                    </div>
                `;
            }).join('')}
        </div>
        <div class="inspector-actions">
            <button class="btn-secondary btn-sm" onclick="clearMapSelection()">
                Clear Route
            </button>
        </div>
    `;
}

window.clearMapSelection = function() {
    selectedNodeId = null;
    activePath = null;
    renderSvgMap();
    renderInspectorEmpty();
};

document.getElementById('btn-calc-route')?.addEventListener('click', computeRouteFromInputs);

document.getElementById('btn-clear-map')?.addEventListener('click', () => {
    clearMapSelection();
    showToast('Map selection cleared.', 'info');
});

document.getElementById('btn-unblock-roads')?.addEventListener('click', () => {
    blockedRoads.clear();
    showToast('All closed road segments reopened.', 'success');
    if (activePath && activePath.length >= 2) {
        computeRouteFromInputs();
    } else {
        renderSvgMap();
    }
});

// --- Allocation Pipeline & Dispatch Actions ---

async function processSpecificRequest(requestId) {
    if (!currentUser) {
        showToast('Please sign in as District Supply Officer (Admin) to dispatch cargo.', 'warning');
        openAuthModal('login');
        return;
    }
    if (currentUser.role !== 'ADMIN') {
        showToast('Access restricted: Only District Supply Officers (Admin) can dispatch cargo.', 'warning');
        return;
    }

    const client = getSupabaseClient();
    if (!client) {
        openModal('supabase-modal');
        return;
    }

    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const requestedItems = (request.itemsList && request.itemsList.length)
        ? request.itemsList.map(i => ({ name: i.commodity_name, quantity: Number(i.quantity_kg) }))
        : parseCommoditiesText(request.items);

    if (!requestedItems.length) {
        showToast(`No commodity requirements found for ${request.id}.`, 'warning');
        return;
    }

    // Step 1 & 2: Dijkstra from reachable warehouses
    const warehouseCandidates = ['W1', 'W2'].map(whId => {
        const route = dijkstra(whId, request.shop);
        return { id: whId, route };
    }).filter(c => c.route !== null);

    warehouseCandidates.sort((a, b) => a.route.time - b.route.time);

    // Step 3: Find nearest warehouse with COMPLETE stock
    let selectedWarehouse = null;
    let selectedRoute = null;

    for (const candidate of warehouseCandidates) {
        const wh = warehouses.find(w => w.id === candidate.id);
        if (!wh) continue;

        const hasComplete = requestedItems.every(req => {
            const key = req.name.toLowerCase();
            return (wh[key] || 0) >= req.quantity;
        });

        if (hasComplete) {
            selectedWarehouse = wh;
            selectedRoute = candidate.route;
            break;
        }
    }

    if (!selectedWarehouse) {
        const reason = "PENDING: insufficient complete warehouse stock";
        await client.from('delivery_requests').update({ details: reason }).eq('request_id', request.id);
        showToast(`${request.id} remains pending: no reachable warehouse has all requested items.`, 'warning');
        await loadData();
        return;
    }

    // Step 4: Pick vehicle capable of carrying the load
    const vehicle = selectVehicle(request.total);
    if (!vehicle) {
        const reason = `PENDING: payload ${request.total}kg exceeds vehicle fleet capacity`;
        await client.from('delivery_requests').update({ details: reason }).eq('request_id', request.id);
        showToast(reason, 'warning');
        await loadData();
        return;
    }

    try {
        // Step 5: Deduct stock from warehouse
        const updateStock = {};
        for (const item of requestedItems) {
            const key = `${item.name.toLowerCase()}_kg`;
            updateStock[key] = (selectedWarehouse[item.name.toLowerCase()] || 0) - item.quantity;
        }

        const { error: whErr } = await client
            .from('warehouses')
            .update(updateStock)
            .eq('warehouse_id', selectedWarehouse.id);
        if (whErr) throw whErr;

        // Step 6: Update request status to DISPATCHED with Dijkstra route path
        const routeString = selectedRoute.path.join(' -> ');
        const details = `${selectedWarehouse.id} -> ${request.shop} | ${vehicle.id} (${vehicle.type}) via ${routeString} (${selectedRoute.time}m)`;

        const { error: reqErr } = await client
            .from('delivery_requests')
            .update({ status: 'DISPATCHED', details })
            .eq('request_id', request.id);
        if (reqErr) throw reqErr;

        showToast(`🚀 ${request.id} dispatched from ${selectedWarehouse.name} via ${routeString}!`, 'success');
        await loadData();
    } catch (err) {
        console.error("Dispatch error:", err);
        showToast(`Dispatch failed: ${err.message}`, 'error');
    }
}

async function processNext() {
    if (!currentUser) {
        showToast('Please sign in as District Supply Officer (Admin) to dispatch cargo.', 'warning');
        openAuthModal('login');
        return;
    }
    if (currentUser.role !== 'ADMIN') {
        showToast('Access restricted: Only District Supply Officers (Admin) can dispatch the fleet.', 'warning');
        return;
    }

    const pending = [...requests]
        .filter(r => r.status === 'PENDING')
        .sort((a, b) => b.urgency - a.urgency || a.arrival - b.arrival || a.id.localeCompare(b.id));

    if (!pending.length) {
        showToast('The replenishment queue is clear. No pending requests.', 'info');
        return;
    }

    await processSpecificRequest(pending[0].id);
}

async function processAll() {
    if (!currentUser) {
        showToast('Please sign in as District Supply Officer (Admin) to dispatch cargo.', 'warning');
        openAuthModal('login');
        return;
    }
    if (currentUser.role !== 'ADMIN') {
        showToast('Access restricted: Only District Supply Officers (Admin) can dispatch the fleet.', 'warning');
        return;
    }

    const pending = requests.filter(r => r.status === 'PENDING');
    if (!pending.length) {
        showToast('No pending requests to process.', 'info');
        return;
    }

    showToast(`Processing ${pending.length} queued requests...`, 'info');
    let processed = 0;

    while (requests.some(r => r.status === 'PENDING')) {
        const beforeCount = requests.filter(r => r.status === 'PENDING').length;
        await processNext();
        processed++;
        const afterCount = requests.filter(r => r.status === 'PENDING').length;
        if (afterCount === beforeCount) break;
    }

    showToast(`Batch dispatch completed. ${processed} requests processed.`, 'success');
}

async function confirmReceipt(index) {
    const delivery = dispatches[index];
    if (!delivery) return;
    await confirmSpecificReceipt(delivery.requestId, delivery.shop);
}

async function confirmSpecificReceipt(requestId, shopId) {
    if (!currentUser) {
        showToast('Please sign in to confirm delivery receipt.', 'warning');
        openAuthModal('login');
        return;
    }
    if (currentUser.role === 'SHOP_DEALER' && currentUser.assignedShopId && currentUser.assignedShopId !== shopId) {
        showToast(`Access restricted: You are assigned to Shop ${currentUser.assignedShopId}. Only the dealer for Shop ${shopId} can confirm this receipt.`, 'warning');
        return;
    }

    const client = getSupabaseClient();
    if (!client) {
        openModal('supabase-modal');
        return;
    }

    try {
        const { data: items, error: itemsErr } = await client
            .from('request_items')
            .select('*')
            .eq('request_id', requestId);
        if (itemsErr) throw itemsErr;

        const { data: shopsData, error: shopErr } = await client
            .from('shops')
            .select('*')
            .eq('shop_id', shopId);
        if (shopErr) throw shopErr;

        const currentShop = shopsData && shopsData[0];
        if (currentShop && items && items.length) {
            const updatedStock = {};
            for (const item of items) {
                const key = `${item.commodity_name.toLowerCase()}_kg`;
                updatedStock[key] = (Number(currentShop[key]) || 0) + Number(item.quantity_kg);
            }
            await client.from('shops').update(updatedStock).eq('shop_id', shopId);
        }

        await client
            .from('delivery_requests')
            .update({
                status: 'DELIVERED',
                details: `RECEIVED & STORED at ${shopId}`
            })
            .eq('request_id', requestId);

        showToast(`✅ ${requestId} delivered and verified at ${shopId}. Shop inventory updated.`, 'success');
        await loadData();
    } catch (err) {
        console.error("Receipt error:", err);
        showToast(`Confirmation error: ${err.message}`, 'error');
    }
}

async function confirmAllReceipts() {
    if (!currentUser) {
        showToast('Please sign in to confirm receipts.', 'warning');
        openAuthModal('login');
        return;
    }
    if (currentUser.role !== 'ADMIN') {
        showToast('Only District Supply Officers (Admin) can batch-confirm all shop receipts.', 'warning');
        return;
    }
    if (!dispatches.length) {
        showToast('No active deliveries to confirm.', 'info');
        return;
    }
    for (const d of [...dispatches]) {
        await confirmSpecificReceipt(d.requestId, d.shop);
    }
}

// --- Stock & Urgency Modal Operations ---
function openStockModal(warehouseId) {
    if (!currentUser) {
        showToast('Please sign in as District Supply Officer (Admin) to edit warehouse stock.', 'warning');
        openAuthModal('login');
        return;
    }
    if (currentUser.role !== 'ADMIN') {
        showToast('Access restricted: Only District Supply Officers (Admin) can update warehouse inventory.', 'warning');
        return;
    }

    const wh = warehouses.find(w => w.id === warehouseId);
    if (!wh) return;

    document.getElementById('modal-stock-warehouse-id').value = wh.id;
    document.getElementById('modal-warehouse-name').textContent = `${wh.name} (${wh.id})`;
    document.getElementById('modal-stock-commodity').value = 'rice';
    document.getElementById('modal-stock-quantity').value = wh.rice;

    openModal('stock-modal');
}

document.getElementById('modal-stock-commodity')?.addEventListener('change', (e) => {
    const whId = document.getElementById('modal-stock-warehouse-id').value;
    const wh = warehouses.find(w => w.id === whId);
    if (wh) {
        document.getElementById('modal-stock-quantity').value = wh[e.target.value] || 0;
    }
});

document.getElementById('modal-save-stock-btn')?.addEventListener('click', async () => {
    const client = getSupabaseClient();
    if (!client) return;

    const whId = document.getElementById('modal-stock-warehouse-id').value;
    const commodity = document.getElementById('modal-stock-commodity').value;
    const qty = Number(document.getElementById('modal-stock-quantity').value);

    if (isNaN(qty) || qty < 0) {
        showToast('Quantity must be a positive number.', 'warning');
        return;
    }

    try {
        const col = `${commodity}_kg`;
        const { error } = await client
            .from('warehouses')
            .update({ [col]: qty })
            .eq('warehouse_id', whId);
        if (error) throw error;

        closeModal('stock-modal');
        showToast(`Updated ${whId} ${commodity} stock to ${qty} kg.`, 'success');
        await loadData();
    } catch (err) {
        showToast(`Failed to update stock: ${err.message}`, 'error');
    }
});

function openUrgencyModal(requestId, currentUrgency) {
    document.getElementById('modal-urgency-req-id').value = requestId;
    document.getElementById('modal-urgency-req-title').textContent = `Request ${requestId}`;
    document.getElementById('modal-urgency-select').value = String(currentUrgency);
    openModal('urgency-modal');
}

document.getElementById('modal-save-urgency-btn')?.addEventListener('click', async () => {
    const client = getSupabaseClient();
    if (!client) return;

    const reqId = document.getElementById('modal-urgency-req-id').value;
    const urgency = Number(document.getElementById('modal-urgency-select').value);

    try {
        const { error } = await client
            .from('delivery_requests')
            .update({ urgency })
            .eq('request_id', reqId);
        if (error) throw error;

        closeModal('urgency-modal');
        showToast(`Updated urgency for ${reqId} to Level ${urgency}.`, 'success');
        await loadData();
    } catch (err) {
        showToast(`Failed to update urgency: ${err.message}`, 'error');
    }
});

// --- Dynamic Item Builder in New Request Form ---
function setupUrgencySelector() {
    const cards = document.querySelectorAll('.urgency-card');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });
}

document.getElementById('add-item')?.addEventListener('click', () => {
    const commodity = document.getElementById('commodity').value;
    const quantity = Number(document.getElementById('quantity').value);

    if (isNaN(quantity) || quantity <= 0) {
        showToast('Quantity must be greater than zero.', 'warning');
        return;
    }

    itemsInNewRequest = itemsInNewRequest.filter(i => i.name !== commodity);
    itemsInNewRequest.push({ name: commodity, quantity });
    renderItemTags();
});

function renderItemTags() {
    const container = document.getElementById('items-tag-list');
    const totalEl = document.getElementById('new-req-total-weight');
    if (!container) return;

    if (!itemsInNewRequest.length) {
        container.innerHTML = `<span style="color:var(--text-muted);font-size:12px;">No commodities added yet. Use the selector above.</span>`;
        if (totalEl) totalEl.textContent = '0.0 kg';
        return;
    }

    container.innerHTML = itemsInNewRequest.map((item, idx) => `
        <div class="item-tag">
            <span>${item.name}: <strong>${item.quantity} kg</strong></span>
            <span class="remove-tag" onclick="removeItemTag(${idx})">&times;</span>
        </div>
    `).join('');

    const totalWeight = itemsInNewRequest.reduce((sum, item) => sum + item.quantity, 0);
    if (totalEl) totalEl.textContent = `${totalWeight.toFixed(1)} kg`;
}

window.removeItemTag = function(index) {
    itemsInNewRequest.splice(index, 1);
    renderItemTags();
};

document.getElementById('clear-items')?.addEventListener('click', () => {
    itemsInNewRequest = [];
    renderItemTags();
});

// Form Submission
document.getElementById('request-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        showToast('Please sign in as Admin or Fair Price Shop Dealer to submit shortage requests.', 'warning');
        openAuthModal('login');
        return;
    }

    const client = getSupabaseClient();
    if (!client) {
        openModal('supabase-modal');
        return;
    }

    const form = new FormData(e.target);
    const id = String(form.get('id') || '').trim().toUpperCase();
    let shop = form.get('shop');
    if (currentUser.role === 'SHOP_DEALER' && currentUser.assignedShopId) {
        shop = currentUser.assignedShopId;
    }

    const checkedUrgency = document.querySelector('input[name="urgency"]:checked');
    const urgency = Number(checkedUrgency ? checkedUrgency.value : (form.get('urgency') || 5));

    if (!id) {
        showToast('Request ID is required.', 'warning');
        return;
    }
    if (!itemsInNewRequest.length) {
        showToast('Add at least one commodity before submitting.', 'warning');
        return;
    }

    const totalKg = itemsInNewRequest.reduce((sum, item) => sum + item.quantity, 0);
    const details = itemsInNewRequest.map(i => `${i.name}: ${i.quantity}kg`).join(', ');

    try {
        const { data: orderData } = await client
            .from('delivery_requests')
            .select('arrival_order')
            .order('arrival_order', { ascending: false })
            .limit(1);

        const nextOrder = (orderData && orderData.length > 0 && orderData[0].arrival_order)
            ? orderData[0].arrival_order + 1
            : 1;

        const { error: reqErr } = await client.from('delivery_requests').insert({
            request_id: id,
            shop_id: shop,
            urgency,
            total_kg: totalKg,
            status: 'PENDING',
            details,
            arrival_order: nextOrder
        });
        if (reqErr) throw reqErr;

        const itemRows = itemsInNewRequest.map(i => ({
            request_id: id,
            commodity_name: i.name,
            quantity_kg: i.quantity
        }));
        const { error: itemsErr } = await client.from('request_items').insert(itemRows);
        if (itemsErr) throw itemsErr;

        showToast(`Request ${id} for Shop ${shop} submitted to priority queue!`, 'success');
        e.target.reset();
        itemsInNewRequest = [];
        renderItemTags();

        // Reset urgency selector back to Level 5 default
        document.querySelectorAll('.urgency-card').forEach(c => c.classList.remove('active'));
        const defaultLevel5 = document.querySelector('.urgency-card[data-level="5"]');
        if (defaultLevel5) {
            defaultLevel5.classList.add('active');
            const r = defaultLevel5.querySelector('input[type="radio"]');
            if (r) r.checked = true;
        }

        await loadData();
        switchTab('requests');
    } catch (err) {
        console.error("Create request error:", err);
        showToast(`Error creating request: ${err.message}`, 'error');
    }
});

// Helper Parser
function parseCommoditiesText(text) {
    if (!text) return [];
    return text.split(', ').map(item => {
        const parts = item.split(': ');
        return { name: parts[0], quantity: Number(String(parts[1] || '').replace(/kg$/i, '')) };
    }).filter(i => i.name && !isNaN(i.quantity));
}

// Search and Filter Listeners
document.getElementById('requests-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderRequests();
});

document.querySelectorAll('#requests-status-filters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#requests-status-filters .filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderRequests();
    });
});

// Header Buttons
document.getElementById('header-process-next')?.addEventListener('click', processNext);
document.getElementById('header-process-all')?.addEventListener('click', processAll);
document.getElementById('process-next')?.addEventListener('click', processNext);
document.getElementById('process-all')?.addEventListener('click', processAll);
document.getElementById('confirm-all')?.addEventListener('click', confirmAllReceipts);
document.getElementById('reset-button')?.addEventListener('click', async () => {
    showToast('Refreshing live data from Supabase...', 'info');
    await loadData();
});

// Supabase Settings Modal
document.getElementById('supabase-config-btn')?.addEventListener('click', () => {
    const creds = getSupabaseCredentials();
    document.getElementById('modal-supabase-url').value = creds.url.includes('YOUR_PROJECT_ID') ? '' : creds.url;
    document.getElementById('modal-supabase-key').value = creds.key.includes('YOUR_SUPABASE_ANON_KEY') ? '' : creds.key;
    openModal('supabase-modal');
});

document.getElementById('banner-config-btn')?.addEventListener('click', () => {
    document.getElementById('supabase-config-btn').click();
});

document.getElementById('modal-save-btn')?.addEventListener('click', async () => {
    const url = (document.getElementById('modal-supabase-url').value || '').trim();
    const key = (document.getElementById('modal-supabase-key').value || '').trim();

    if (!url || !key) {
        showToast('Please provide both Supabase URL and Anon Key.', 'warning');
        return;
    }

    window.localStorage.setItem('SUPABASE_URL', url);
    window.localStorage.setItem('SUPABASE_ANON_KEY', key);

    closeModal('supabase-modal');
    showToast('Credentials updated. Connecting to Supabase...', 'info');
    await loadData();
});

// ====================================================================
// --- AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC) ENGINE ---
// ====================================================================

const DEMO_USERS = {
    'admin': {
        username: 'admin',
        password: 'admin123',
        fullName: 'District Supply Officer',
        role: 'ADMIN',
        assignedShopId: null
    },
    'dealer_s5': {
        username: 'dealer_s5',
        password: 'shop123',
        fullName: 'Karthik Rao (North Hill FPS 5)',
        role: 'SHOP_DEALER',
        assignedShopId: 'S5'
    },
    'dealer_s1': {
        username: 'dealer_s1',
        password: 'shop123',
        fullName: 'Ramesh Kumar (Bazaar FPS 1)',
        role: 'SHOP_DEALER',
        assignedShopId: 'S1'
    },
    'dealer_s2': {
        username: 'dealer_s2',
        password: 'shop123',
        fullName: 'Suresh Babu (South FPS 2)',
        role: 'SHOP_DEALER',
        assignedShopId: 'S2'
    }
};

let currentUser = null;

function getRegisteredUsers() {
    try {
        const stored = localStorage.getItem('valam_local_users');
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        return {};
    }
}

function saveRegisteredUser(user) {
    const users = getRegisteredUsers();
    users[user.username.toLowerCase()] = user;
    localStorage.setItem('valam_local_users', JSON.stringify(users));
}

function initAuth() {
    try {
        const saved = localStorage.getItem('valam_current_user');
        if (saved) {
            currentUser = JSON.parse(saved);
        } else {
            currentUser = null;
        }
    } catch (e) {
        currentUser = null;
    }
    renderAuthWidget();
    applyRolePermissions();
}

function renderAuthWidget() {
    const sidebarContainer = document.getElementById('sidebar-user-widget');
    const headerContainer = document.getElementById('header-user-widget');

    if (sidebarContainer) {
        if (currentUser) {
            const isAdmin = currentUser.role === 'ADMIN';
            sidebarContainer.innerHTML = `
                <div class="sidebar-user-card">
                    <div class="user-avatar ${isAdmin ? 'admin' : 'dealer'}">
                        ${isAdmin ? '👑' : '🏪'}
                    </div>
                    <div class="sidebar-user-info">
                        <span class="sidebar-user-name" title="${currentUser.fullName}">${currentUser.fullName}</span>
                        <span class="user-role-badge-small ${isAdmin ? 'admin' : 'dealer'}">
                            ${isAdmin ? 'DISTRICT ADMIN' : `DEALER • ${currentUser.assignedShopId}`}
                        </span>
                    </div>
                    <div class="sidebar-user-actions">
                        <button class="btn-sidebar-user-action" onclick="openAuthModal('login')" title="Switch User">🔄</button>
                        <button class="btn-sidebar-user-action signout" onclick="signOut()" title="Sign Out">🚪</button>
                    </div>
                </div>
            `;
        } else {
            sidebarContainer.innerHTML = `
                <button class="btn-auth-signin" style="width:100%;justify-content:center;" onclick="openAuthModal('login')">
                    <span>🔑</span> Sign In / Register
                </button>
            `;
        }
    }

    if (headerContainer) {
        if (currentUser) {
            const isAdmin = currentUser.role === 'ADMIN';
            headerContainer.innerHTML = `
                <div class="user-profile-badge">
                    <div class="user-avatar ${isAdmin ? 'admin' : 'dealer'}">
                        ${isAdmin ? '👑' : '🏪'}
                    </div>
                    <div class="user-info-text">
                        <span class="user-display-name">${currentUser.fullName}</span>
                        <span class="user-role-badge-small ${isAdmin ? 'admin' : 'dealer'}">
                            ${isAdmin ? 'DISTRICT ADMIN' : `DEALER • ${currentUser.assignedShopId}`}
                        </span>
                    </div>
                    <button class="btn-header-signout" onclick="signOut()" title="Sign Out">🚪 Out</button>
                </div>
            `;
        } else {
            headerContainer.innerHTML = `
                <button class="btn-auth-signin" onclick="openAuthModal('login')">
                    <span>🔑</span> Sign In
                </button>
            `;
        }
    }
}

function applyRolePermissions() {
    renderAuthWidget();
    applyRoleToNewRequest();
}

function applyRoleToNewRequest() {
    const select = document.getElementById('new-request-shop-select');
    const notice = document.getElementById('shop-lock-notice');
    const label = document.getElementById('shop-lock-label');

    if (!select) return;

    if (currentUser && currentUser.role === 'SHOP_DEALER' && currentUser.assignedShopId) {
        select.value = currentUser.assignedShopId;
        select.disabled = true;
        const shopObj = shops.find(s => s.id === currentUser.assignedShopId);
        if (notice) notice.style.display = 'flex';
        if (label) label.textContent = `${currentUser.assignedShopId} - ${shopObj ? shopObj.name : 'Your Assigned Shop'}`;
    } else {
        select.disabled = false;
        if (notice) notice.style.display = 'none';
    }
}

// Modal open/close
window.openAuthModal = function(tab = 'login') {
    switchAuthTab(tab);
    setAuthAlert('', '');
    openModal('auth-modal');
};

window.closeAuthModal = function() {
    closeModal('auth-modal');
};

window.switchAuthTab = function(tab) {
    const loginBtn = document.getElementById('auth-tab-login');
    const signupBtn = document.getElementById('auth-tab-signup');
    const loginPane = document.getElementById('auth-pane-login');
    const signupPane = document.getElementById('auth-pane-signup');

    if (tab === 'login') {
        loginBtn?.classList.add('active');
        signupBtn?.classList.remove('active');
        loginPane?.classList.add('active');
        signupPane?.classList.remove('active');
    } else {
        signupBtn?.classList.add('active');
        loginBtn?.classList.remove('active');
        signupPane?.classList.add('active');
        loginPane?.classList.remove('active');
    }
    setAuthAlert('', '');
};

window.handleRoleSelectionChange = function(role) {
    const dealerCard = document.getElementById('role-card-dealer');
    const adminCard = document.getElementById('role-card-admin');
    const shopWrapper = document.getElementById('signup-shop-wrapper');

    if (role === 'SHOP_DEALER') {
        dealerCard?.classList.add('active');
        adminCard?.classList.remove('active');
        if (shopWrapper) shopWrapper.style.display = 'block';
    } else {
        adminCard?.classList.add('active');
        dealerCard?.classList.remove('active');
        if (shopWrapper) shopWrapper.style.display = 'none';
    }
};

window.togglePasswordVisibility = function(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '🙈 Hide';
    } else {
        input.type = 'password';
        if (btn) btn.textContent = '👁️ Show';
    }
};

function setAuthAlert(msg, type = 'error') {
    const el = document.getElementById('auth-alert');
    if (!el) return;
    if (!msg) {
        el.style.display = 'none';
        el.textContent = '';
        el.className = 'auth-alert';
        return;
    }
    el.style.display = 'flex';
    el.className = `auth-alert ${type}`;
    el.textContent = msg;
}

// Form Sign In Handler
window.handleLoginSubmit = async function(e) {
    e.preventDefault();
    const username = (document.getElementById('login-username').value || '').trim();
    const password = (document.getElementById('login-password').value || '').trim();
    const remember = document.getElementById('login-remember')?.checked;

    if (!username || !password) {
        setAuthAlert('Please enter both username and password.');
        return;
    }

    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Verifying credentials...';
    }

    let authenticatedUser = null;

    // 1. Try Supabase cloud table first
    const client = getSupabaseClient();
    if (client) {
        try {
            const { data, error } = await client
                .from('app_users')
                .select('*')
                .ilike('username', username)
                .maybeSingle();

            if (!error && data) {
                if (data.password_hash === password) {
                    authenticatedUser = {
                        username: data.username,
                        fullName: data.full_name,
                        role: data.role,
                        assignedShopId: data.assigned_shop_id
                    };
                } else {
                    setAuthAlert('Incorrect password entered. Please try again.');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span>🔑</span> Sign In';
                    }
                    return;
                }
            }
        } catch (err) {
            console.warn("Supabase auth check bypassed to local store:", err);
        }
    }

    // 2. Check local registered users & seed accounts if not found in Supabase
    if (!authenticatedUser) {
        const localUsers = getRegisteredUsers();
        const lower = username.toLowerCase();
        const candidate = DEMO_USERS[lower] || localUsers[lower];

        if (candidate) {
            if (candidate.password === password) {
                authenticatedUser = {
                    username: candidate.username,
                    fullName: candidate.fullName,
                    role: candidate.role,
                    assignedShopId: candidate.assignedShopId
                };
            } else {
                setAuthAlert('Incorrect password entered. Please try again.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<span>🔑</span> Sign In';
                }
                return;
            }
        }
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🔑</span> Sign In';
    }

    if (!authenticatedUser) {
        setAuthAlert('User not found. Please verify your credentials or create a new account.');
        return;
    }

    currentUser = authenticatedUser;
    if (remember) {
        localStorage.setItem('valam_current_user', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('valam_current_user');
    }

    closeAuthModal();
    applyRolePermissions();
    renderRequests();
    renderWarehouses();
    renderDispatches();
    showToast(`Welcome back, ${currentUser.fullName}!`, 'success');
};

// Form Sign Up Handler
window.handleSignupSubmit = async function(e) {
    e.preventDefault();
    const roleRadio = document.querySelector('input[name="signup-role"]:checked');
    const role = roleRadio ? roleRadio.value : 'SHOP_DEALER';
    const assignedShopId = role === 'SHOP_DEALER' ? document.getElementById('signup-shop-id')?.value : null;
    const fullName = (document.getElementById('signup-fullname')?.value || '').trim();
    const username = (document.getElementById('signup-username')?.value || '').trim();
    const password = (document.getElementById('signup-password')?.value || '').trim();

    if (!fullName || !username || !password) {
        setAuthAlert('All fields are required.');
        return;
    }
    if (username.length < 3) {
        setAuthAlert('Username must be at least 3 characters.');
        return;
    }
    if (password.length < 6) {
        setAuthAlert('Password must be at least 6 characters.');
        return;
    }

    const submitBtn = document.getElementById('btn-signup-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>⏳</span> Creating account...';
    }

    // Check duplicate locally
    const localUsers = getRegisteredUsers();
    if (DEMO_USERS[username.toLowerCase()] || localUsers[username.toLowerCase()]) {
        setAuthAlert(`Username "${username}" is already taken. Please choose another.`);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>✨</span> Create Account &amp; Access System';
        }
        return;
    }

    const newUser = {
        username: username.toLowerCase(),
        password: password,
        fullName,
        role,
        assignedShopId
    };

    // Attempt Supabase insert
    const client = getSupabaseClient();
    if (client) {
        try {
            const { error: insErr } = await client.from('app_users').insert({
                username: newUser.username,
                password_hash: newUser.password,
                full_name: newUser.fullName,
                role: newUser.role,
                assigned_shop_id: newUser.assignedShopId
            });
            if (insErr) {
                console.warn("Supabase user insert notice:", insErr);
            }
        } catch (err) {
            console.warn("Supabase insert offline fallback:", err);
        }
    }

    // Save locally
    saveRegisteredUser(newUser);

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>✨</span> Create Account &amp; Access System';
    }

    currentUser = {
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        assignedShopId: newUser.assignedShopId
    };
    localStorage.setItem('valam_current_user', JSON.stringify(currentUser));

    closeAuthModal();
    applyRolePermissions();
    renderRequests();
    renderWarehouses();
    renderDispatches();
    showToast(`Account created successfully! Logged in as ${currentUser.fullName}.`, 'success');
};

// Sign Out Handler
window.signOut = function() {
    currentUser = null;
    localStorage.removeItem('valam_current_user');
    applyRolePermissions();
    renderRequests();
    renderWarehouses();
    renderDispatches();
    showToast('You have signed out. System is now in Guest (Read Only) mode.', 'info');
};

// Initial boot
setupUrgencySelector();
initAuth();
loadData();
