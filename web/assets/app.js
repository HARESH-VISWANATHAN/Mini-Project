let requests = [];
let warehouses = [];
let dispatches = [];
let history = [];
let itemsInNewRequest = [];
let selectedWarehouseId = null;

function parseItems(text) {
    return text.split(", ").map(item => {
        const parts = item.split(": ");
        return { name: parts[0], quantity: Number(String(parts[1]).replace(/kg$/i, "")) };
    });
}

function totalItems(items) {
    return items.reduce((sum, item) => sum + item.quantity, 0);
}

async function api(action, options = {}) {
    const response = await fetch(`api.php?action=${action}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || "API request failed.");
    return data;
}

function mapWarehouse(item) {
    return {
        id: item.warehouse_id, name: item.warehouse_name,
        rice: Number(item.rice_kg), wheat: Number(item.wheat_kg), sugar: Number(item.sugar_kg)
    };
}

function mapRequest(item) {
    return {
        id: item.request_id, shop: item.shop_id, urgency: Number(item.urgency),
        items: item.items_text || "", total: Number(item.total_kg),
        status: item.status, details: item.details || "", arrival: Number(item.arrival_order)
    };
}

async function loadData() {
    try {
        const [warehouseData, requestData, shopData] = await Promise.all([
            api("warehouses"), api("requests"), api("shops")
        ]);
        warehouses = warehouseData.map(mapWarehouse);
        requests = requestData.map(mapRequest);
        dispatches = requests.filter(request => request.status === "DISPATCHED").map(request => ({
            requestId: request.id, shop: request.shop, vehicle: "V001", details: request.details
        }));
        history = requests.filter(request => request.status === "DELIVERED").map((request, index) => ({
            record: `RC${index + 1}`,
            details: `${request.id} received at ${request.shop}`
        }));
        renderShopOptions(shopData);
        render();
    } catch (error) {
        alert(`Could not load database data: ${error.message}`);
    }
}

function renderShopOptions(shops) {
    const select = document.querySelector('select[name="shop"]');
    if (select && shops.length) {
        select.innerHTML = shops.map(shop =>
            `<option value="${shop.shop_id}">${shop.shop_id} - ${shop.shop_name}</option>`).join("");
    }
}

async function reset() {
    itemsInNewRequest = [];
    selectedWarehouseId = null;
    document.querySelector("#items-list").value = "";
    const selectedLabel = document.querySelector("#selected-warehouse");
    if (selectedLabel) selectedLabel.textContent = "No warehouse selected";
    await loadData();
}

function renderRequests() {
    const rows = document.querySelector("#request-rows");
    const ordered = [...requests].sort((a, b) =>
        b.urgency - a.urgency || a.arrival - b.arrival || a.id.localeCompare(b.id));
    rows.innerHTML = ordered.map(request => `
        <tr data-request-id="${request.id}">
            <td>${request.id}</td>
            <td>${request.shop}</td>
            <td>${request.urgency}</td>
            <td>${request.items}</td>
            <td>${request.total.toFixed(1)}</td>
            <td class="${request.status.toLowerCase()}">${request.status}</td>
            <td>${request.details || ""}</td>
        </tr>`).join("");
}

function renderWarehouses() {
    const rows = document.querySelector("#warehouses tbody");
    rows.innerHTML = warehouses.map(warehouse => `
        <tr data-warehouse-id="${warehouse.id}" class="${warehouse.id === selectedWarehouseId ? "selected-row" : ""}">
            <td>${warehouse.id}</td><td>${warehouse.name}</td>
            <td>${warehouse.rice.toFixed(1)}</td><td>${warehouse.wheat.toFixed(1)}</td>
            <td>${warehouse.sugar.toFixed(1)}</td><td>AVAILABLE</td>
        </tr>`).join("");
    rows.querySelectorAll("tr").forEach(row => {
        row.addEventListener("click", () => {
            selectedWarehouseId = row.dataset.warehouseId;
            const selectedLabel = document.querySelector("#selected-warehouse");
            if (selectedLabel) {
                const warehouse = warehouses.find(item => item.id === selectedWarehouseId);
                selectedLabel.textContent = `Selected: ${warehouse.id} - ${warehouse.name}`;
            }
            renderWarehouses();
        });
    });
}

function render() {
    renderRequests();
    renderWarehouses();
    const pending = requests.filter(request => request.status === "PENDING").length;
    const dispatched = requests.filter(request => request.status === "DISPATCHED").length;
    const delivered = requests.filter(request => request.status === "DELIVERED").length;

    document.querySelector("#console-output").textContent =
`SYSTEM OVERVIEW
==========================
Loaded requests : ${requests.length}
Waiting / pending: ${pending}
In transit      : ${dispatched}
Delivered       : ${delivered}
Dispatch records: ${dispatches.length}
Receipt records : ${delivered}

WORKFLOW
==========================
Submit shortage request -> priority queue
Find reachable warehouse -> verify complete stock
Choose suitable vehicle -> shortest route (Dijkstra)
Dispatch goods -> confirm receipt at the shop

NOTES
==========================
• Urgency is ranked from 5 (highest) to 1 (lowest).
• Stock is added to a shop only after receipt confirmation.
• Requests that cannot be served remain pending with a reason.
• Details can be changed using the controls on each screen.`;

    document.querySelector("#dispatch-rows").innerHTML = dispatches.length
        ? dispatches.map((item, index) => `
            <tr>
                <td>${item.requestId}</td><td>${item.shop}</td><td>${item.vehicle}</td>
                <td>${item.details}<br><button onclick="confirmReceipt(${index})">Confirm receipt</button></td>
            </tr>`).join("")
        : `<tr><td colspan="4"></td></tr>`;
    document.querySelector("#history-rows").innerHTML = history.length
        ? history.map((item, index) => `<tr><td>${item.record || "RC" + (index + 1)}</td><td>${item.details}</td></tr>`).join("")
        : `<tr><td colspan="2"></td></tr>`;
}

async function processOne() {
    const request = [...requests]
        .filter(item => item.status === "PENDING")
        .sort((a, b) => b.urgency - a.urgency || a.arrival - b.arrival || a.id.localeCompare(b.id))[0];
    if (!request) {
        alert("There are no pending requests.");
        return;
    }

    const requestedItems = parseItems(request.items);
    const warehouse = warehouses.find(item =>
        requestedItems.every(requested => item[requested.name.toLowerCase()] >= requested.quantity)
    );
    if (!warehouse) {
        request.details = "PENDING: insufficient complete warehouse stock";
        alert(`${request.id} remains pending because no warehouse has all requested commodities.`);
        await loadData();
        return;
    }
    try {
        const result = await api("process_request", {
            method: "POST",
            body: JSON.stringify({ request_id: request.id })
        });
        alert(result.message);
        await loadData();
    } catch (error) {
        alert(error.message);
    }
}

function changeSelectedUrgency() {
    const id = prompt("Enter the request ID to update:", "R001");
    if (!id) return;
    const request = requests.find(item => item.id.toUpperCase() === id.trim().toUpperCase());
    if (!request || request.status === "DISPATCHED" || request.status === "DELIVERED") {
        alert("Request not found or already dispatched.");
        return;
    }
    const urgency = Number(prompt("Enter new urgency (1-5):", String(request.urgency)));
    if (!Number.isInteger(urgency) || urgency < 1 || urgency > 5) {
        alert("Urgency must be a whole number from 1 to 5.");
        return;
    }
    request.urgency = urgency;
    renderRequests();
}

function updateSelectedWarehouseStock() {
    if (!selectedWarehouseId) {
        alert("Select a warehouse row first.");
        return;
    }
    const warehouse = warehouses.find(item => item.id === selectedWarehouseId);
    if (!warehouse) {
        alert("Warehouse not found.");
        return;
    }
    const commodity = prompt("Enter commodity (Rice, Wheat, or Sugar):", "Rice");
    const key = String(commodity).trim().toLowerCase();
    if (!["rice", "wheat", "sugar"].includes(key)) {
        alert("Unknown commodity.");
        return;
    }
    const quantity = Number(prompt(`Enter new ${commodity} stock in kg:`, String(warehouse[key])));
    if (!Number.isFinite(quantity) || quantity < 0) {
        alert("Stock must be zero or greater.");
        return;
    }
    api("update_warehouse", {
        method: "POST",
        body: JSON.stringify({ warehouse_id: warehouse.id, commodity: key, quantity_kg: quantity })
    }).then(async () => {
        await loadData();
        alert("Warehouse stock updated in MySQL.");
    }).catch(error => alert(error.message));
}

window.confirmReceipt = async index => {
    const delivery = dispatches[index];
    if (!delivery) return;
    try {
        const result = await api("confirm_receipt", {
            method: "POST",
            body: JSON.stringify({ request_id: delivery.requestId })
        });
        alert(result.message);
        await loadData();
    } catch (error) {
        alert(error.message);
    }
};

function addItem() {
    const commodity = document.querySelector("#commodity").value;
    const quantity = Number(document.querySelector("#quantity").value);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        alert("Quantity must be positive.");
        return;
    }
    itemsInNewRequest = itemsInNewRequest.filter(item => item.name !== commodity);
    itemsInNewRequest.push({ name: commodity, quantity });
    document.querySelector("#items-list").value =
        itemsInNewRequest.map(item => `${item.name}: ${item.quantity} kg`).join("\n");
}

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".section").forEach(section => section.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.section).classList.add("active");
}));

document.querySelector("#process-next").addEventListener("click", processOne);
document.querySelector("#process-all").addEventListener("click", async () => {
    while (requests.some(request => request.status === "PENDING")) {
        const before = requests.filter(request => request.status === "PENDING").length;
        await processOne();
        if (requests.filter(request => request.status === "PENDING").length === before) break;
    }
});
document.querySelector("#change-urgency").addEventListener("click", changeSelectedUrgency);
document.querySelector("#reset-button").addEventListener("click", reset);
document.querySelector("#add-item").addEventListener("click", addItem);
document.querySelector("#clear-items").addEventListener("click", () => {
    itemsInNewRequest = [];
    document.querySelector("#items-list").value = "";
});
document.querySelector("#request-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.target);
    if (!itemsInNewRequest.length) {
        document.querySelector("#form-message").textContent = "Add at least one item.";
        return;
    }
    try {
        await api("create_request", {
            method: "POST",
            body: JSON.stringify({
                request_id: form.get("id"), shop_id: form.get("shop"),
                urgency: Number(form.get("urgency")),
                items: itemsInNewRequest.map(item => ({
                    commodity: item.name, quantity_kg: item.quantity
                }))
            })
        });
        document.querySelector("#form-message").textContent = "Request saved to MySQL and added to the priority queue.";
        event.target.reset();
        itemsInNewRequest = [];
        document.querySelector("#items-list").value = "";
        await loadData();
    } catch (error) {
        document.querySelector("#form-message").textContent = error.message;
    }
});
document.querySelector("#warehouses .bottom-action").addEventListener("click", updateSelectedWarehouseStock);
document.querySelector("#requests").addEventListener("dblclick", event => {
    if (event.target.closest("tbody")) changeSelectedUrgency();
});
document.querySelector("#confirm-all").addEventListener("click", async () => {
    for (const delivery of [...dispatches]) {
        const index = dispatches.findIndex(item => item.requestId === delivery.requestId);
        if (index >= 0) await confirmReceipt(index);
    }
});
document.querySelector("#confirm-selected").addEventListener("click", () => {
    if (!dispatches.length) {
        alert("There are no in-transit deliveries.");
        return;
    }
    const id = prompt("Enter the request ID to confirm:", dispatches[0].requestId);
    const index = dispatches.findIndex(item => item.requestId.toUpperCase() === String(id).trim().toUpperCase());
    if (index < 0) {
        alert("Dispatch not found.");
        return;
    }
    confirmReceipt(index);
});
document.querySelector("#retry-pending").addEventListener("click", () => {
    alert("Pending requests are already available in the priority queue.");
});

loadData();
