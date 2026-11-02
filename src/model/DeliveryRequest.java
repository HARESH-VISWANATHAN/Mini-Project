package model;

import java.util.Map;
import java.util.TreeMap;

/** One shop's request for commodities, with its urgency and current status. */
public class DeliveryRequest {

    public enum Status { PENDING, RESERVED, DISPATCHED, DELIVERED }

    private final String requestId;
    private final FairPriceShop shop;
    private final Map<String, Double> requiredCommodities;
    private final long arrivalOrder;      // lower = arrived earlier
    private int urgency;                  // higher = more urgent
    private Status status = Status.PENDING;
    private String pendingReason = "";

    public DeliveryRequest(String requestId, FairPriceShop shop,
                           Map<String, Double> requiredCommodities,
                           int urgency, long arrivalOrder) {
        this.requestId = requestId;
        this.shop = shop;
        this.requiredCommodities = new TreeMap<>(requiredCommodities);  // private copy
        this.urgency = urgency;
        this.arrivalOrder = arrivalOrder;
    }

    public String getRequestId() { return requestId; }
    public FairPriceShop getShop() { return shop; }
    public int getUrgency() { return urgency; }
    public long getArrivalOrder() { return arrivalOrder; }
    public Status getStatus() { return status; }
    public String getPendingReason() { return pendingReason; }

    // Returns a copy so outside code cannot change the request's items
    public Map<String, Double> getRequiredCommodities() {
        return new TreeMap<>(requiredCommodities);
    }

    // To change urgency use DispatchService.changeUrgency(): it removes and
    // reinserts the request so the PriorityQueue stays correctly ordered.
    public void setUrgency(int urgency) { this.urgency = urgency; }
    public void setStatus(Status status) { this.status = status; }
    public void setPendingReason(String reason) { this.pendingReason = reason; }

    public double getTotalQuantity() {
        double total = 0;
        for (double quantity : requiredCommodities.values()) {
            total += quantity;
        }
        return total;
    }

    @Override
    public String toString() {
        String reason = (status == Status.PENDING && !pendingReason.isEmpty())
                ? " - " + pendingReason : "";
        return requestId + " | " + shop.getId() + " | Urgency: " + urgency
                + " | Arrival: " + arrivalOrder + " | Items: " + requiredCommodities
                + " (" + getTotalQuantity() + " kg) | " + status + reason;
    }
}
