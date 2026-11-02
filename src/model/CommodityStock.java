package model;

import java.util.Map;
import java.util.TreeMap;

/**
 * Stock of commodities in kg. Two balances are kept for every commodity:
 *   on hand  = physically present in the store
 *   reserved = promised to a request but not yet dispatched
 * Available stock = on hand - reserved.
 *
 * ENCAPSULATION: both maps are private. The only way to change them is through
 * the methods below, so stock can never go negative or be promised twice.
 */
public class CommodityStock {

    private final Map<String, Double> onHand = new TreeMap<>();
    private final Map<String, Double> reserved = new TreeMap<>();

    // ---------- reading ----------

    public double getStock(String commodity) {
        return onHand.getOrDefault(commodity, 0.0);
    }

    public double getReserved(String commodity) {
        return reserved.getOrDefault(commodity, 0.0);
    }

    public double getAvailable(String commodity) {
        return getStock(commodity) - getReserved(commodity);
    }

    /** True only if EVERY requested commodity is available in full. */
    public boolean hasCompleteStock(Map<String, Double> required) {
        for (Map.Entry<String, Double> item : required.entrySet()) {
            if (getAvailable(item.getKey()) < item.getValue()) {
                return false;
            }
        }
        return true;
    }

    // ---------- changing ----------

    /** Adds stock (opening stock or a confirmed receipt). */
    public void addStock(String commodity, double quantity) {
        validateCommodity(commodity);
        if (!Double.isFinite(quantity) || quantity < 0) {
            throw new IllegalArgumentException("Quantity must be a finite non-negative value.");
        }
        onHand.put(commodity, getStock(commodity) + quantity);
    }

    /** Sets the physical stock level without changing any existing reservation. */
    public void setStock(String commodity, double quantity) {
        validateCommodity(commodity);
        if (!Double.isFinite(quantity) || quantity < 0) {
            throw new IllegalArgumentException("Quantity must be a finite non-negative value.");
        }
        if (quantity < getReserved(commodity)) {
            throw new IllegalArgumentException("Quantity cannot be below the reserved stock ("
                    + getReserved(commodity) + " kg).");
        }
        onHand.put(commodity, quantity);
    }

    /** Reserves all commodities together (all or nothing). */
    public boolean reserve(Map<String, Double> required) {
        if (!isValid(required) || !hasCompleteStock(required)) {
            return false;
        }
        for (Map.Entry<String, Double> item : required.entrySet()) {
            reserved.put(item.getKey(), getReserved(item.getKey()) + item.getValue());
        }
        return true;
    }

    /** Cancels a reservation (for example when no vehicle is free). */
    public boolean releaseReservation(Map<String, Double> required) {
        if (!isValid(required) || !hasReserved(required)) {
            return false;
        }
        for (Map.Entry<String, Double> item : required.entrySet()) {
            reserved.put(item.getKey(), getReserved(item.getKey()) - item.getValue());
        }
        return true;
    }

    /** Dispatches reserved stock: it leaves both "reserved" and "on hand". */
    public boolean dispatch(Map<String, Double> required) {
        if (!isValid(required) || !hasReserved(required)) {
            return false;
        }
        for (Map.Entry<String, Double> item : required.entrySet()) {
            String commodity = item.getKey();
            reserved.put(commodity, getReserved(commodity) - item.getValue());
            onHand.put(commodity, getStock(commodity) - item.getValue());
        }
        return true;
    }

    // ---------- private helpers ----------

    private boolean hasReserved(Map<String, Double> required) {
        for (Map.Entry<String, Double> item : required.entrySet()) {
            if (getReserved(item.getKey()) < item.getValue()) {
                return false;
            }
        }
        return true;
    }

    // A request must be non-empty and every quantity must be positive
    private boolean isValid(Map<String, Double> required) {
        if (required == null || required.isEmpty()) {
            return false;
        }
        for (Map.Entry<String, Double> item : required.entrySet()) {
            if (item.getKey() == null || item.getKey().trim().isEmpty()
                    || item.getValue() == null
                    || !Double.isFinite(item.getValue())
                    || item.getValue() <= 0) {
                return false;
            }
        }
        return true;
    }

    private void validateCommodity(String commodity) {
        if (commodity == null || commodity.trim().isEmpty()) {
            throw new IllegalArgumentException("Commodity name is required.");
        }
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder("{");
        for (Map.Entry<String, Double> item : onHand.entrySet()) {
            if (sb.length() > 1) {
                sb.append(", ");
            }
            sb.append(item.getKey()).append("=").append(item.getValue());
            double r = getReserved(item.getKey());
            if (r > 0) {
                sb.append(" (reserved ").append(r).append(")");
            }
        }
        return sb.append("}").toString();
    }
}
