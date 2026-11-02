package tests;

import data.SampleData;
import model.DeliveryRequest;
import model.FairPriceShop;
import model.Warehouse;
import service.DispatchService;

import java.util.List;

/** Automated test scenarios. Run from the menu (option 20) or: java Main --tests */
public class TestScenarios {

    private static int passed = 0;
    private static int failed = 0;

    public static void main(String[] args) {
        runAll();
    }

    private static void check(String description, boolean condition) {
        System.out.println("   [" + (condition ? "PASS" : "FAIL") + "] " + description);
        if (condition) passed++; else failed++;
    }

    private static void title(String t) {
        System.out.println("\n=== " + t + " ===");
    }

    public static void runAll() {
        passed = 0;
        failed = 0;
        normalOperation();
        insufficientStock();
        overloadedRequest();
        inaccessibleShop();
        twoRequestsLastStock();
        urgencyChangeReinsert();
        noVehicleThenRetry();
        nearestEligibleWarehouse();
        invalidInputsAndDuplicateReceipt();
        System.out.println("\n----------------------------------------");
        System.out.println("TOTAL: " + passed + " passed, " + failed + " failed");
    }

    // 1. Normal operation
    static void normalOperation() {
        title("Test 1: Normal operation (S3 requests Rice 100, Wheat 50)");
        DispatchService s = SampleData.buildNetwork();
        s.submitRequest("T1", "S3", SampleData.items("Rice", 100, "Wheat", 50), 3);
        System.out.println(s.processNext());
        Warehouse w1 = s.getWarehouses().get("W1");
        FairPriceShop s3 = s.getShops().get("S3");
        check("Request dispatched", s.getAllRequests().get("T1").getStatus() == DeliveryRequest.Status.DISPATCHED);
        check("Nearest warehouse W1 used; Rice 1000 -> 900", w1.getCommodityStock().getStock("Rice") == 900);
        check("Shop stock unchanged until receipt", s3.getCommodityStock().getStock("Rice") == 0);
        System.out.println(s.confirmReceipt("T1"));
        check("After receipt shop Rice = 100", s3.getCommodityStock().getStock("Rice") == 100);
        check("Vehicle available again", s.getVehicles().get("V001").isAvailable());
        check("Dispatch and receipt history each have 1 entry",
                s.getDispatchHistory().size() == 1 && s.getReceiptHistory().size() == 1);
    }

    // 2. Insufficient stock
    static void insufficientStock() {
        title("Test 2: Insufficient stock (S1 requests Sugar 700; W1 has 500, W2 has 300)");
        DispatchService s = SampleData.buildNetwork();
        s.submitRequest("T2", "S1", SampleData.items("Sugar", 700), 5);
        System.out.println(s.processNext());
        DeliveryRequest r = s.getAllRequests().get("T2");
        check("Request stays PENDING", r.getStatus() == DeliveryRequest.Status.PENDING);
        check("Reason mentions insufficient stock", r.getPendingReason().startsWith("Insufficient stock"));
        check("No stock deducted or left reserved",
                s.getWarehouses().get("W1").getCommodityStock().getStock("Sugar") == 500
                && s.getWarehouses().get("W1").getCommodityStock().getReserved("Sugar") == 0);
    }

    // 3. Overloaded request
    static void overloadedRequest() {
        title("Test 3: Overloaded request (Rice 1000 + Wheat 800 + Sugar 500 = 2300 kg; largest vehicle 2000 kg)");
        DispatchService s = SampleData.buildNetwork();
        s.submitRequest("T3", "S2", SampleData.items("Rice", 1000, "Wheat", 800, "Sugar", 500), 5);
        System.out.println(s.processNext());
        DeliveryRequest r = s.getAllRequests().get("T3");
        check("Request stays PENDING", r.getStatus() == DeliveryRequest.Status.PENDING);
        check("Reason says overloaded", r.getPendingReason().startsWith("Overloaded"));
        check("Reservation released (W1 reserved Rice = 0, on hand 1000)",
                s.getWarehouses().get("W1").getCommodityStock().getReserved("Rice") == 0
                && s.getWarehouses().get("W1").getCommodityStock().getStock("Rice") == 1000);
    }

    // 4. Inaccessible shop
    static void inaccessibleShop() {
        title("Test 4: Inaccessible shop (road J4-S8 blocked, S8 requests Rice 100)");
        DispatchService s = SampleData.buildNetwork();
        s.getGraph().blockRoad("J4", "S8");
        s.submitRequest("T4", "S8", SampleData.items("Rice", 100), 5);
        System.out.println(s.processNext());
        DeliveryRequest r = s.getAllRequests().get("T4");
        check("Request stays PENDING", r.getStatus() == DeliveryRequest.Status.PENDING);
        check("Reason says shop inaccessible", r.getPendingReason().startsWith("Shop inaccessible"));
        s.getGraph().unblockRoad("J4", "S8");
        s.retryPending();
        System.out.println("After road reopened: " + s.processNext());
        check("Request dispatched once the road reopens", r.getStatus() == DeliveryRequest.Status.DISPATCHED);
    }

    // 5. Two requests sharing the last stock
    static void twoRequestsLastStock() {
        title("Test 5: Two requests share the last Sugar (800 kg total; each wants 450)");
        DispatchService s = SampleData.buildNetwork();
        s.submitRequest("T5-LOW", "S2", SampleData.items("Sugar", 450), 2);   // arrives first, lower urgency
        s.submitRequest("T5-HIGH", "S1", SampleData.items("Sugar", 450), 5);  // arrives second, higher urgency
        for (String m : s.processAll()) System.out.println(m);
        check("Higher-urgency request wins the stock",
                s.getAllRequests().get("T5-HIGH").getStatus() == DeliveryRequest.Status.DISPATCHED);
        check("Lower-urgency request stays PENDING",
                s.getAllRequests().get("T5-LOW").getStatus() == DeliveryRequest.Status.PENDING);
        check("Stock was not double allocated (W1 Sugar 500 -> 50, never negative)",
                s.getWarehouses().get("W1").getCommodityStock().getStock("Sugar") == 50);
    }

    // 6. Urgency change: remove and reinsert
    static void urgencyChangeReinsert() {
        title("Test 6: Urgency change re-ranks the queue");
        DispatchService s = SampleData.buildNetwork();
        s.submitRequest("A", "S1", SampleData.items("Rice", 100), 2);
        s.submitRequest("B", "S2", SampleData.items("Rice", 100), 3);
        check("Before change B is first", s.getQueueSnapshot().get(0).getRequestId().equals("B"));
        s.changeUrgency("A", 5);
        check("After raising A to 5, A is first", s.getQueueSnapshot().get(0).getRequestId().equals("A"));
        s.submitRequest("C", "S3", SampleData.items("Rice", 100), 5);
        check("Tie on urgency: earlier arrival (A) stays ahead of C",
                s.getQueueSnapshot().get(0).getRequestId().equals("A")
                && s.getQueueSnapshot().get(1).getRequestId().equals("C"));
    }

    // 7. All vehicles busy, then retry after receipt
    static void noVehicleThenRetry() {
        title("Test 7: No vehicle available, then retry after a vehicle returns");
        DispatchService s = SampleData.buildNetwork();
        s.submitRequest("V1", "S1", SampleData.items("Rice", 300), 5);
        s.submitRequest("V2", "S2", SampleData.items("Rice", 300), 4);
        s.submitRequest("V3", "S3", SampleData.items("Rice", 300), 3);
        s.submitRequest("V4", "S4", SampleData.items("Rice", 300), 2);
        for (String m : s.processAll()) System.out.println(m);
        DeliveryRequest v4 = s.getAllRequests().get("V4");
        check("First three dispatched, fourth PENDING",
                v4.getStatus() == DeliveryRequest.Status.PENDING
                && s.getInTransit().size() == 3);
        check("Pending reason says no available vehicle", v4.getPendingReason().startsWith("No available vehicle"));
        check("Fourth request's stock was released, not held",
                s.getWarehouses().get("W2").getCommodityStock().getReserved("Rice") == 0
                && s.getWarehouses().get("W1").getCommodityStock().getReserved("Rice") == 0);
        System.out.println(s.confirmReceipt("V1"));
        s.retryPending();
        List<String> out = s.processAll();
        for (String m : out) System.out.println(m);
        check("After a vehicle returns, the pending request is dispatched",
                v4.getStatus() == DeliveryRequest.Status.DISPATCHED);
    }

    // 8. The nearest warehouse may be ineligible; choose the nearest complete supplier.
    static void nearestEligibleWarehouse() {
        title("Test 8: Nearest warehouse lacks one commodity");
        DispatchService s = SampleData.buildNetwork();
        s.getWarehouses().get("W1").updateStock("Wheat", 0);
        s.submitRequest("T8", "S2", SampleData.items("Rice", 100, "Wheat", 50), 5);
        System.out.println(s.processNext());
        check("Farther eligible warehouse W2 is selected",
                s.getDispatchHistory().get(0).getWarehouseId().equals("W2"));
    }

    // 9. Invalid input and receipt replay must not mutate state.
    static void invalidInputsAndDuplicateReceipt() {
        title("Test 9: Invalid input and duplicate receipt protection");
        DispatchService s = SampleData.buildNetwork();
        boolean invalidUrgencyRejected = false;
        try {
            s.submitRequest("T9", "S1", SampleData.items("Rice", 10), 6);
        } catch (IllegalArgumentException e) {
            invalidUrgencyRejected = true;
        }
        check("Urgency outside 1-5 is rejected", invalidUrgencyRejected);

        s.submitRequest("T9", "S1", SampleData.items("Rice", 10), 1);
        s.processNext();
        s.confirmReceipt("T9");
        double received = s.getShops().get("S1").getCommodityStock().getStock("Rice");
        String replay = s.confirmReceipt("T9");
        check("Duplicate receipt is reported", replay.startsWith("No in-transit delivery"));
        check("Duplicate receipt does not increase shop stock",
                s.getShops().get("S1").getCommodityStock().getStock("Rice") == received);
    }
}
