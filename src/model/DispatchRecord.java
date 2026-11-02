package model;

import graph.RouteResult;

import java.util.Map;
import java.util.TreeMap;

/** History entry: one delivery that left a warehouse. */
public class DispatchRecord {

    private final int recordNo;
    private final String requestId;
    private final String shopId;
    private final String warehouseId;
    private final String vehicleId;
    private final Map<String, Double> items;
    private final double totalKg;
    private final RouteResult route;

    public DispatchRecord(int recordNo, String requestId, String shopId, String warehouseId,
                          String vehicleId, Map<String, Double> items, double totalKg,
                          RouteResult route) {
        this.recordNo = recordNo;
        this.requestId = requestId;
        this.shopId = shopId;
        this.warehouseId = warehouseId;
        this.vehicleId = vehicleId;
        this.items = new TreeMap<>(items);
        this.totalKg = totalKg;
        this.route = route;
    }

    public String getRequestId() { return requestId; }
    public String getShopId() { return shopId; }
    public String getWarehouseId() { return warehouseId; }
    public String getVehicleId() { return vehicleId; }

    public Map<String, Double> getItems() {
        return new TreeMap<>(items);
    }

    @Override
    public String toString() {
        return "D" + recordNo + " | " + requestId + " | " + warehouseId + " -> " + shopId
                + " | Vehicle " + vehicleId + " | " + items + " (" + totalKg + " kg)"
                + " | Route: " + route;
    }
}
