package model;

import java.util.Map;

/** A fair-price shop that asks for deliveries. It owns a CommodityStock. */
public class FairPriceShop {

    private final String id;     // also the node name in the road graph
    private final String name;
    private final CommodityStock commodityStock = new CommodityStock();

    public FairPriceShop(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public CommodityStock getCommodityStock() { return commodityStock; }

    /** Adds one commodity (used for opening stock). */
    public void receiveStock(String commodity, double quantity) {
        commodityStock.addStock(commodity, quantity);
    }

    /** Confirmed receipt of a whole delivery: shop stock goes up. */
    public void receiveDelivery(Map<String, Double> items) {
        for (Map.Entry<String, Double> item : items.entrySet()) {
            commodityStock.addStock(item.getKey(), item.getValue());
        }
    }

    @Override
    public String toString() {
        return id + " - " + name + " | Stock: " + commodityStock;
    }
}
