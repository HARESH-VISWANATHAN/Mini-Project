package model;

import java.util.Map;

/** A government warehouse. It owns a CommodityStock (composition). */
public class Warehouse {

    private final String id;     // also the node name in the road graph
    private final String name;
    private final CommodityStock commodityStock = new CommodityStock();

    public Warehouse(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public CommodityStock getCommodityStock() { return commodityStock; }

    public void addStock(String commodity, double quantity) {
        commodityStock.addStock(commodity, quantity);
    }

    /** Updates the warehouse's physical stock level while preserving reservations. */
    public void updateStock(String commodity, double quantity) {
        commodityStock.setStock(commodity, quantity);
    }

    /** Does the warehouse hold ALL requested commodities? */
    public boolean hasCompleteStock(Map<String, Double> required) {
        return commodityStock.hasCompleteStock(required);
    }

    /** Reserves every commodity together; prevents double allocation. */
    public boolean reserveStock(Map<String, Double> required) {
        return commodityStock.reserve(required);
    }

    public boolean releaseReservation(Map<String, Double> required) {
        return commodityStock.releaseReservation(required);
    }

    /** Deducts the reserved stock when the vehicle leaves. */
    public boolean dispatchStock(Map<String, Double> required) {
        return commodityStock.dispatch(required);
    }

    @Override
    public String toString() {
        return id + " - " + name + " | Stock: " + commodityStock;
    }
}
