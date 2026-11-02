package service;

import graph.Graph;
import graph.RouteResult;
import model.*;
import policy.ReplenishmentPolicy;
import vehicle.DeliveryVehicle;

import java.util.*;

/**
 * The brain of the system. For every request (most urgent first) it does:
 *   1. check the shop is on the road network
 *   2. find warehouses reachable by an open road, nearest first (Dijkstra)
 *   3. pick the nearest warehouse that holds the COMPLETE request
 *   4. reserve every commodity together
 *   5. pick an available vehicle that canCarry() the load (smallest first)
 *   6. dispatch: deduct stock, vehicle becomes busy, save route and record
 * If a step fails the stock is released and the request stays PENDING with a reason.
 * (No globally optimal fleet schedule is claimed.)
 */
public class DispatchService {

    private final Graph graph;
    private final ReplenishmentPolicy policy;

    private final Map<String, Warehouse> warehouses = new LinkedHashMap<>();
    private final Map<String, FairPriceShop> shops = new LinkedHashMap<>();
    private final Map<String, DeliveryVehicle> vehicles = new LinkedHashMap<>();

    // Requests: waiting in the PriorityQueue, tried but unserved (pending), or all of them
    private final PriorityQueue<DeliveryRequest> queue;
    private final List<DeliveryRequest> pending = new ArrayList<>();
    private final Map<String, DeliveryRequest> allRequests = new LinkedHashMap<>();

    // Deliveries on the road, and the two history lists (ArrayList)
    private final Map<String, DispatchRecord> inTransit = new LinkedHashMap<>();
    private final List<DispatchRecord> dispatchHistory = new ArrayList<>();
    private final List<ReceiptRecord> receiptHistory = new ArrayList<>();

    private long nextArrival = 1;
    private int nextDispatchNo = 1;
    private int nextReceiptNo = 1;

    public DispatchService(Graph graph, ReplenishmentPolicy policy) {
        this.graph = graph;
        this.policy = policy;
        this.queue = new PriorityQueue<>(policy.getComparator());
    }

    // =====================================================================
    // Setup and getters
    // =====================================================================

    public void addWarehouse(Warehouse w) { warehouses.put(w.getId(), w); }
    public void addShop(FairPriceShop s) { shops.put(s.getId(), s); }
    public void addVehicle(DeliveryVehicle v) { vehicles.put(v.getVehicleId(), v); }

    public Graph getGraph() { return graph; }
    public Map<String, Warehouse> getWarehouses() { return warehouses; }
    public Map<String, FairPriceShop> getShops() { return shops; }
    public Map<String, DeliveryVehicle> getVehicles() { return vehicles; }
    public Map<String, DeliveryRequest> getAllRequests() { return allRequests; }
    public List<DeliveryRequest> getPending() { return pending; }
    public Map<String, DispatchRecord> getInTransit() { return inTransit; }
    public List<DispatchRecord> getDispatchHistory() { return dispatchHistory; }
    public List<ReceiptRecord> getReceiptHistory() { return receiptHistory; }

    // =====================================================================
    // Submitting requests and ranking them
    // =====================================================================

    /** Validates a new request and puts it in the queue. */
    public DeliveryRequest submitRequest(String id, String shopId,
                                         Map<String, Double> items, int urgency) {
        if (id == null || id.trim().isEmpty()) {
            throw new IllegalArgumentException("Request ID is required.");
        }
        if (allRequests.containsKey(id)) {
            throw new IllegalArgumentException("Request ID already exists: " + id);
        }
        if (shopId == null || shopId.trim().isEmpty()) {
            throw new IllegalArgumentException("Shop ID is required.");
        }
        FairPriceShop shop = shops.get(shopId);
        if (shop == null) {
            throw new IllegalArgumentException("Unknown shop: " + shopId);
        }
        if (urgency < 1 || urgency > 5) {
            throw new IllegalArgumentException("Urgency must be between 1 and 5.");
        }
        if (items == null || items.isEmpty()) {
            throw new IllegalArgumentException("Request must contain at least one commodity.");
        }
        for (Map.Entry<String, Double> item : items.entrySet()) {
            if (item.getKey() == null || item.getKey().trim().isEmpty()) {
                throw new IllegalArgumentException("Commodity name is required.");
            }
            if (item.getValue() == null || !Double.isFinite(item.getValue())
                    || item.getValue() <= 0) {
                throw new IllegalArgumentException("Quantities must be positive.");
            }
        }
        DeliveryRequest request = new DeliveryRequest(id, shop, items, urgency, nextArrival++);
        allRequests.put(id, request);
        queue.add(request);
        return request;
    }

    /**
     * Changes a request's urgency. The request is REMOVED from the queue,
     * changed, and REINSERTED - otherwise the PriorityQueue would stay in the old order.
     */
    public boolean changeUrgency(String requestId, int newUrgency) {
        if (newUrgency < 1 || newUrgency > 5) {
            return false;
        }
        DeliveryRequest request = allRequests.get(requestId);
        if (request == null
                || request.getStatus() == DeliveryRequest.Status.DISPATCHED
                || request.getStatus() == DeliveryRequest.Status.DELIVERED) {
            return false;
        }
        boolean wasQueued = queue.remove(request);
        request.setUrgency(newUrgency);
        if (wasQueued) {
            queue.add(request);
        }
        return true;
    }

    /** The waiting requests in processing order (the queue itself is not changed). */
    public List<DeliveryRequest> getQueueSnapshot() {
        List<DeliveryRequest> list = new ArrayList<>(queue);
        list.sort(policy.getComparator());
        return list;
    }

    // =====================================================================
    // Processing requests
    // =====================================================================

    /** Processes the most urgent request. Returns a message, or null if the queue is empty. */
    public String processNext() {
        DeliveryRequest request = queue.poll();
        if (request == null) {
            return null;
        }
        return process(request);
    }

    /** Processes the whole queue and returns one message per request. */
    public List<String> processAll() {
        List<String> messages = new ArrayList<>();
        String message = processNext();
        while (message != null) {
            messages.add(message);
            message = processNext();
        }
        return messages;
    }

    /** Moves every pending request back into the queue (e.g. after a vehicle returns). */
    public int retryPending() {
        int count = pending.size();
        queue.addAll(pending);
        pending.clear();
        return count;
    }

    // The 6-step pipeline described at the top of this class
    private String process(DeliveryRequest request) {
        Map<String, Double> items = request.getRequiredCommodities();
        double totalKg = request.getTotalQuantity();
        String shopNode = request.getShop().getId();

        // 1. is the shop on the road network?
        if (!graph.containsNode(shopNode)) {
            return makePending(request, "Shop is not connected to the road network");
        }

        // 2. warehouses reachable by an open road, nearest first
        List<Warehouse> reachable = findReachableWarehouses(shopNode);
        if (reachable.isEmpty()) {
            return makePending(request, "Shop inaccessible: no open road route to any warehouse");
        }

        // 3. nearest warehouse with the COMPLETE request
        Warehouse warehouse = findWarehouseWithStock(reachable, items);
        if (warehouse == null) {
            return makePending(request,
                    "Insufficient stock: no reachable warehouse holds the complete request");
        }

        // 4. reserve all commodities together
        if (!warehouse.reserveStock(items)) {
            return makePending(request, "Stock reservation failed");
        }
        request.setStatus(DeliveryRequest.Status.RESERVED);

        // 5. choose a vehicle (if none, give the reserved stock back)
        DeliveryVehicle vehicle = chooseVehicle(totalKg);
        if (vehicle == null) {
            warehouse.releaseReservation(items);
            return makePending(request, noVehicleReason(totalKg));
        }

        // 6. dispatch
        return dispatch(request, warehouse, vehicle);
    }

    // Warehouses with an open road to the shop, sorted by travel time (ties by ID)
    private List<Warehouse> findReachableWarehouses(String shopNode) {
        Map<String, Double> time = graph.distancesFrom(shopNode);
        List<Warehouse> reachable = new ArrayList<>();
        for (Warehouse w : warehouses.values()) {
            Double t = time.get(w.getId());
            if (t != null && t != Double.POSITIVE_INFINITY) {
                reachable.add(w);
            }
        }
        reachable.sort(Comparator
                .comparingDouble((Warehouse w) -> time.get(w.getId()))
                .thenComparing(Warehouse::getId));
        return reachable;
    }

    // First warehouse in the (already sorted) list that has everything, or null
    private Warehouse findWarehouseWithStock(List<Warehouse> sortedWarehouses,
                                             Map<String, Double> items) {
        for (Warehouse w : sortedWarehouses) {
            if (w.hasCompleteStock(items)) {
                return w;
            }
        }
        return null;
    }

    // Smallest available vehicle that can carry the load, or null
    private DeliveryVehicle chooseVehicle(double loadKg) {
        DeliveryVehicle best = null;
        for (DeliveryVehicle v : vehicles.values()) {
            if (v.isAvailable() && v.canCarry(loadKg)) {
                if (best == null || v.getCapacityKg() < best.getCapacityKg()) {
                    best = v;
                }
            }
        }
        return best;
    }

    private String noVehicleReason(double loadKg) {
        double largest = 0;
        for (DeliveryVehicle v : vehicles.values()) {
            largest = Math.max(largest, v.getCapacityKg());
        }
        if (loadKg > largest) {
            return "Overloaded: " + loadKg + " kg exceeds the largest vehicle capacity ("
                    + largest + " kg)";
        }
        return "No available vehicle can carry " + loadKg + " kg right now";
    }

    // Step 6: deduct the stock, send the vehicle, record the trip
    private String dispatch(DeliveryRequest request, Warehouse warehouse, DeliveryVehicle vehicle) {
        Map<String, Double> items = request.getRequiredCommodities();
        double totalKg = request.getTotalQuantity();
        String shopNode = request.getShop().getId();

        warehouse.dispatchStock(items);
        vehicle.setAvailable(false);
        RouteResult route = graph.shortestRoute(warehouse.getId(), shopNode);

        DispatchRecord record = new DispatchRecord(nextDispatchNo++, request.getRequestId(),
                shopNode, warehouse.getId(), vehicle.getVehicleId(), items, totalKg, route);
        dispatchHistory.add(record);
        inTransit.put(request.getRequestId(), record);

        request.setStatus(DeliveryRequest.Status.DISPATCHED);
        request.setPendingReason("");
        return request.getRequestId() + " DISPATCHED: " + warehouse.getId() + " -> " + shopNode
                + " by " + vehicle.getVehicleId() + " (" + vehicle.getVehicleType() + ", "
                + totalKg + " kg) | Route: " + route;
    }

    // Keeps the request PENDING and remembers why
    private String makePending(DeliveryRequest request, String reason) {
        request.setStatus(DeliveryRequest.Status.PENDING);
        request.setPendingReason(reason);
        if (!pending.contains(request)) {
            pending.add(request);
        }
        return request.getRequestId() + " PENDING: " + reason;
    }

    // =====================================================================
    // Receipt
    // =====================================================================

    /** The shop confirms receipt: its stock increases and the vehicle is free again. */
    public String confirmReceipt(String requestId) {
        DispatchRecord record = inTransit.remove(requestId);
        if (record == null) {
            return "No in-transit delivery found for request " + requestId + ".";
        }
        FairPriceShop shop = shops.get(record.getShopId());
        shop.receiveDelivery(record.getItems());
        vehicles.get(record.getVehicleId()).setAvailable(true);
        allRequests.get(requestId).setStatus(DeliveryRequest.Status.DELIVERED);

        receiptHistory.add(new ReceiptRecord(nextReceiptNo++, requestId,
                record.getShopId(), record.getVehicleId(), record.getItems()));
        return requestId + " RECEIVED at " + shop.getId() + ": " + record.getItems();
    }

    public List<String> confirmAllReceipts() {
        List<String> messages = new ArrayList<>();
        for (String id : new ArrayList<>(inTransit.keySet())) {
            messages.add(confirmReceipt(id));
        }
        return messages;
    }
}
