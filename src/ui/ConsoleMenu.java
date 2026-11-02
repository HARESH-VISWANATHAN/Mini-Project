package ui;

import data.SampleData;
import model.DeliveryRequest;
import model.DispatchRecord;
import model.FairPriceShop;
import model.ReceiptRecord;
import model.Warehouse;
import service.DispatchService;
import tests.TestScenarios;
import vehicle.DeliveryVehicle;

import java.util.List;
import java.util.Map;
import java.util.Scanner;
import java.util.TreeMap;

/** Menu-driven console application. It only reads input and prints; the logic is in DispatchService. */
public class ConsoleMenu {

    private final Scanner in = new Scanner(System.in);
    private DispatchService service;

    // =====================================================================
    // Main loop
    // =====================================================================

    public void run() {
        loadDemoData();
        System.out.println("==========================================");
        System.out.println("   VALAM PUBLIC DISTRIBUTION SYSTEM");
        System.out.println("   Supply Chain Optimization");
        System.out.println("==========================================");
        System.out.println("Demo data loaded: 2 warehouses, 8 shops, 3 vehicles, 14 locations, 18 requests.");

        boolean running = true;
        while (running) {
            printMenu();
            int choice = readInt("Enter choice: ");
            System.out.println();
            if (choice == 0) {
                running = false;
            } else {
                handleChoice(choice);
            }
        }
        System.out.println("Goodbye.");
    }

    private void handleChoice(int choice) {
        switch (choice) {
            case 1:  showWarehouses(); break;
            case 2:  showShops(); break;
            case 3:  showVehicles(); break;
            case 4:  service.getGraph().displayGraph(); break;
            case 5:  showQueue(); break;
            case 6:  submitRequest(); break;
            case 7:  changeUrgency(); break;
            case 8:  processNext(); break;
            case 9:  processAll(); break;
            case 10: showPending(); break;
            case 11: retryPending(); break;
            case 12: confirmReceipt(); break;
            case 13: confirmAll(); break;
            case 14: showInTransit(); break;
            case 15: showDispatchHistory(); break;
            case 16: showReceiptHistory(); break;
            case 17: changeRoad(true); break;
            case 18: changeRoad(false); break;
            case 19: loadDemoData(); System.out.println("Demo data reloaded."); break;
            case 20: TestScenarios.runAll(); break;
            default: System.out.println("Invalid choice.");
        }
    }

    private void printMenu() {
        System.out.println("\n---------------- MENU ----------------");
        System.out.println(" 1  View warehouse stock       11  Retry pending requests");
        System.out.println(" 2  View shop stock            12  Confirm receipt (one delivery)");
        System.out.println(" 3  View vehicles              13  Confirm all in-transit deliveries");
        System.out.println(" 4  View road network          14  View deliveries in transit");
        System.out.println(" 5  View request queue         15  View dispatch history");
        System.out.println(" 6  Submit new request         16  View receipt history");
        System.out.println(" 7  Change request urgency     17  Block a road");
        System.out.println(" 8  Process next request       18  Unblock a road");
        System.out.println(" 9  Process ALL requests       19  Reload demo data");
        System.out.println("10  View pending requests      20  Run automated test scenarios");
        System.out.println(" 0  Exit");
    }

    private void loadDemoData() {
        service = SampleData.buildNetwork();
        SampleData.loadDemoRequests(service);
    }

    // =====================================================================
    // Views (options 1-5, 10, 14-16)
    // =====================================================================

    private void showWarehouses() {
        System.out.println("--- WAREHOUSES ---");
        for (Warehouse w : service.getWarehouses().values()) {
            System.out.println(w);
        }
    }

    private void showShops() {
        System.out.println("--- SHOPS ---");
        for (FairPriceShop s : service.getShops().values()) {
            System.out.println(s);
        }
    }

    private void showVehicles() {
        System.out.println("--- VEHICLES ---");
        for (DeliveryVehicle v : service.getVehicles().values()) {
            System.out.println(v);
        }
    }

    private void showQueue() {
        System.out.println("--- QUEUE (processing order) ---");
        List<DeliveryRequest> list = service.getQueueSnapshot();
        if (list.isEmpty()) {
            System.out.println("Queue is empty.");
        }
        for (DeliveryRequest r : list) {
            System.out.println(r);
        }
    }

    private void showPending() {
        System.out.println("--- PENDING REQUESTS ---");
        if (service.getPending().isEmpty()) {
            System.out.println("None.");
        }
        for (DeliveryRequest r : service.getPending()) {
            System.out.println(r);
        }
    }

    private void showInTransit() {
        System.out.println("--- IN TRANSIT ---");
        if (service.getInTransit().isEmpty()) {
            System.out.println("None.");
        }
        for (DispatchRecord d : service.getInTransit().values()) {
            System.out.println(d);
        }
    }

    private void showDispatchHistory() {
        System.out.println("--- DISPATCH HISTORY ---");
        if (service.getDispatchHistory().isEmpty()) {
            System.out.println("None yet.");
        }
        for (DispatchRecord d : service.getDispatchHistory()) {
            System.out.println(d);
        }
    }

    private void showReceiptHistory() {
        System.out.println("--- RECEIPT HISTORY ---");
        if (service.getReceiptHistory().isEmpty()) {
            System.out.println("None yet.");
        }
        for (ReceiptRecord r : service.getReceiptHistory()) {
            System.out.println(r);
        }
    }

    // =====================================================================
    // Actions (options 6-9, 11-13, 17-18)
    // =====================================================================

    private void submitRequest() {
        System.out.print("Request ID (e.g. R019): ");
        String id = in.nextLine().trim();
        System.out.print("Shop ID (S1-S8): ");
        String shopId = in.nextLine().trim().toUpperCase();
        Map<String, Double> items = readItems();
        if (items == null) {
            return;
        }
        int urgency = readInt("Urgency (1 = low ... 5 = severe shortage): ");
        try {
            DeliveryRequest request = service.submitRequest(id, shopId, items, urgency);
            System.out.println("Queued: " + request);
        } catch (IllegalArgumentException e) {
            System.out.println("Could not add request: " + e.getMessage());
        }
    }

    private void changeUrgency() {
        System.out.print("Request ID: ");
        String id = in.nextLine().trim();
        int urgency = readInt("New urgency (1-5): ");
        System.out.println(service.changeUrgency(id, urgency)
                ? "Urgency updated; queue re-ranked."
                : "Request not found or already dispatched.");
    }

    private void processNext() {
        service.retryPending();
        String message = service.processNext();
        System.out.println(message == null
                ? "There are no queued or pending requests to process."
                : message);
    }

    private void processAll() {
        service.retryPending();
        List<String> messages = service.processAll();
        if (messages.isEmpty()) {
            System.out.println("There are no queued or pending requests to process.");
        }
        for (String message : messages) {
            System.out.println(message);
        }
    }

    private void retryPending() {
        int count = service.retryPending();
        System.out.println(count + " pending request(s) moved back to the queue. "
                + "Use option 8 or 9 to process them.");
    }

    private void confirmReceipt() {
        showInTransit();
        System.out.print("Request ID to confirm: ");
        String id = in.nextLine().trim();
        String message = service.confirmReceipt(id);
        System.out.println(message == null ? "No in-transit delivery with that request ID." : message);
    }

    private void confirmAll() {
        List<String> messages = service.confirmAllReceipts();
        if (messages.isEmpty()) {
            System.out.println("Nothing in transit.");
        }
        for (String message : messages) {
            System.out.println(message);
        }
    }

    // Blocks (block = true) or reopens (block = false) a road
    private void changeRoad(boolean block) {
        System.out.print("First location (e.g. J4): ");
        String a = in.nextLine().trim().toUpperCase();
        System.out.print("Second location (e.g. S8): ");
        String b = in.nextLine().trim().toUpperCase();
        boolean done = block ? service.getGraph().blockRoad(a, b)
                             : service.getGraph().unblockRoad(a, b);
        if (done) {
            System.out.println("Road " + a + "-" + b + (block ? " blocked." : " reopened."));
        } else {
            System.out.println("No such road (or it was not blocked).");
        }
    }

    // =====================================================================
    // Input helpers
    // =====================================================================

    // Reads text like "Rice=100,Wheat=50". Returns null if the text is invalid.
    private Map<String, Double> readItems() {
        System.out.print("Items in kg, e.g. Rice=100,Wheat=50 (commodities: Rice, Wheat, Sugar): ");
        String line = in.nextLine().trim();
        Map<String, Double> items = new TreeMap<>();
        try {
            for (String part : line.split(",")) {
                String[] pair = part.split("=");
                if (pair.length != 2) {
                    throw new IllegalArgumentException();
                }
                String name = matchCommodity(pair[0].trim());
                if (name == null) {
                    System.out.println("Unknown commodity: " + pair[0].trim());
                    return null;
                }
                double quantity = Double.parseDouble(pair[1].trim());
                if (quantity <= 0) {
                    System.out.println("Quantities must be positive.");
                    return null;
                }
                items.merge(name, quantity, Double::sum);
            }
        } catch (RuntimeException e) {
            System.out.println("Invalid format. Use Name=kg separated by commas.");
            return null;
        }
        return items;
    }

    // Ignores upper/lower case: "rice" -> "Rice"
    private String matchCommodity(String text) {
        for (String commodity : SampleData.COMMODITIES) {
            if (commodity.equalsIgnoreCase(text)) {
                return commodity;
            }
        }
        return null;
    }

    // Keeps asking until the user types a whole number
    private int readInt(String prompt) {
        while (true) {
            System.out.print(prompt);
            String line = in.nextLine().trim();
            try {
                return Integer.parseInt(line);
            } catch (NumberFormatException e) {
                System.out.println("Please enter a whole number.");
            }
        }
    }
}
