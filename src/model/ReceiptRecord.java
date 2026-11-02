package model;

import java.util.Map;
import java.util.TreeMap;

/** History entry: one delivery that a shop has confirmed. */
public class ReceiptRecord {

    private final int receiptNo;
    private final String requestId;
    private final String shopId;
    private final String vehicleId;
    private final Map<String, Double> items;

    public ReceiptRecord(int receiptNo, String requestId, String shopId,
                         String vehicleId, Map<String, Double> items) {
        this.receiptNo = receiptNo;
        this.requestId = requestId;
        this.shopId = shopId;
        this.vehicleId = vehicleId;
        this.items = new TreeMap<>(items);
    }

    @Override
    public String toString() {
        return "RC" + receiptNo + " | " + requestId + " received at " + shopId
                + " | Vehicle " + vehicleId + " | " + items;
    }
}
