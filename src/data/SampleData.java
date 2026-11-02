package data;

import graph.Graph;
import model.FairPriceShop;
import model.Warehouse;
import policy.ShortagePriorityPolicy;
import service.DispatchService;
import vehicle.SmallVan;
import vehicle.SupplyTruck;

import java.util.Map;
import java.util.TreeMap;

/** Synthetic data for the fictional district of Valam. */
public class SampleData {

    public static final String[] COMMODITIES = {"Rice", "Wheat", "Sugar"};

    /** Builds 2 warehouses, 8 shops, 3 vehicles and 14 road locations (no requests yet). */
    public static DispatchService buildNetwork() {
        DispatchService service = new DispatchService(buildRoads(), new ShortagePriorityPolicy());
        addWarehouses(service);
        addShops(service);
        addVehicles(service);
        return service;
    }

    // Travel times are in minutes. W = warehouse, J = junction, S = shop.
    private static Graph buildRoads() {
        Graph g = new Graph();
        // warehouse - junction
        g.addRoad("W1", "J1", 8);
        g.addRoad("W1", "J2", 12);
        g.addRoad("W2", "J3", 10);
        g.addRoad("W2", "J4", 14);
        // junction - junction
        g.addRoad("J1", "J2", 6);
        g.addRoad("J2", "J3", 9);
        g.addRoad("J3", "J4", 7);
        g.addRoad("J1", "J3", 15);
        // junction - shop
        g.addRoad("J1", "S1", 5);
        g.addRoad("J1", "S2", 11);
        g.addRoad("J2", "S3", 4);
        g.addRoad("J2", "S4", 10);
        g.addRoad("J3", "S5", 6);
        g.addRoad("J3", "S6", 8);
        g.addRoad("J4", "S7", 5);
        g.addRoad("J4", "S8", 9);
        // shop - shop
        g.addRoad("S1", "S2", 7);
        g.addRoad("S5", "S6", 5);
        return g;
    }

    private static void addWarehouses(DispatchService service) {
        Warehouse w1 = new Warehouse("W1", "Central Warehouse");
        w1.addStock("Rice", 1000);
        w1.addStock("Wheat", 800);
        w1.addStock("Sugar", 500);

        Warehouse w2 = new Warehouse("W2", "Regional Warehouse");
        w2.addStock("Rice", 600);
        w2.addStock("Wheat", 500);
        w2.addStock("Sugar", 300);

        service.addWarehouse(w1);
        service.addWarehouse(w2);
    }

    private static void addShops(DispatchService service) {
        String[] names = {"Market Street", "Temple Road", "Bus Stand", "Panchayat Office",
                "River Side", "School Lane", "Hill View", "East Gate"};
        for (int i = 0; i < names.length; i++) {
            int number = i + 1;
            service.addShop(new FairPriceShop("S" + number, "Shop " + number + " (" + names[i] + ")"));
        }
    }

    private static void addVehicles(DispatchService service) {
        service.addVehicle(new SmallVan("V001", 500));
        service.addVehicle(new SmallVan("V002", 600));
        service.addVehicle(new SupplyTruck("V003", 2000));
    }

    /** Shortcut for building an item map: items("Rice", 100, "Wheat", 50). */
    public static Map<String, Double> items(Object... pairs) {
        Map<String, Double> map = new TreeMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            map.put((String) pairs[i], ((Number) pairs[i + 1]).doubleValue());
        }
        return map;
    }

    /** Loads 18 demo requests with mixed urgency. */
    public static void loadDemoRequests(DispatchService s) {
        s.submitRequest("R001", "S1", items("Rice", 100, "Wheat", 50), 3);
        s.submitRequest("R002", "S2", items("Rice", 200, "Sugar", 100), 5);
        s.submitRequest("R003", "S3", items("Wheat", 150), 2);
        s.submitRequest("R004", "S4", items("Rice", 120, "Wheat", 80, "Sugar", 40), 4);
        s.submitRequest("R005", "S5", items("Rice", 250, "Sugar", 50), 5);
        s.submitRequest("R006", "S6", items("Wheat", 200, "Sugar", 60), 3);
        s.submitRequest("R007", "S7", items("Rice", 300), 4);
        s.submitRequest("R008", "S8", items("Rice", 150, "Wheat", 100), 1);
        s.submitRequest("R009", "S1", items("Sugar", 120), 2);
        s.submitRequest("R010", "S2", items("Wheat", 220, "Rice", 80), 3);
        s.submitRequest("R011", "S3", items("Rice", 180, "Sugar", 70), 5);
        s.submitRequest("R012", "S4", items("Wheat", 90), 1);
        s.submitRequest("R013", "S5", items("Rice", 400, "Wheat", 300), 4);
        s.submitRequest("R014", "S6", items("Sugar", 150), 2);
        s.submitRequest("R015", "S7", items("Rice", 900, "Wheat", 700), 3);
        s.submitRequest("R016", "S8", items("Wheat", 130, "Sugar", 90), 5);
        s.submitRequest("R017", "S1", items("Rice", 60, "Wheat", 60, "Sugar", 60), 1);
        s.submitRequest("R018", "S3", items("Rice", 350, "Wheat", 250), 4);
    }
}
