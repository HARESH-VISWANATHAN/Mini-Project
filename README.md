# Mini Project 7: Government Public Distribution Supply Chain Optimization

Java console application (OOP + data structures) for the fictional district of Valam.
It ranks shop shortages, picks a warehouse with COMPLETE stock, reserves the stock,
chooses a vehicle that can carry the load, and finds the fastest route.

## How to run

Install a JDK (Java 17 or later recommended), then open this folder in VS Code.

### Desktop frontend (default)

Open the VS Code terminal in the `SupplyChain` folder and run:

    javac -d out -sourcepath src src/Main.java
    java -cp out Main

This opens a Java Swing desktop dashboard with tabs for Dashboard, Warehouses,
Fair Price Shops, Vehicles, Requests, New Request, Dispatch & Receipts, and History.
The interface uses the same `DispatchService` business logic as the original project.
The dashboard uses a professional navy/teal visual theme, summary cards, sortable
tables, high-contrast action buttons, and clear request and delivery workflows.

### Console frontend

    java -cp out Main --console

### Automated tests

    java -cp out Main --tests

The test suite covers normal operation, insufficient stock, overloaded loads,
blocked roads, competing last stock, urgency re-ranking, unavailable vehicles,
nearest eligible warehouse selection, invalid urgency, and duplicate receipt
protection. The expected result is **29 passed, 0 failed**.

On Windows, you can also double-click `run.bat` to compile and launch the desktop app.

## Folder structure (one class per file)

    src/
    ├── Main.java                      entry point
    ├── model/                         the "things" in the system
    │   ├── CommodityStock.java        on-hand + reserved stock (encapsulation)
    │   ├── Warehouse.java             contains a CommodityStock
    │   ├── FairPriceShop.java         contains a CommodityStock
    │   ├── DeliveryRequest.java       shop request, urgency, status, pending reason
    │   ├── DispatchRecord.java        history entry (ArrayList)
    │   └── ReceiptRecord.java         history entry (ArrayList)
    ├── vehicle/                       inheritance + polymorphism
    │   ├── DeliveryVehicle.java       abstract parent, abstract canCarry()
    │   ├── SmallVan.java              canCarry(): 0 < load <= capacity
    │   └── SupplyTruck.java           canCarry(): 250 kg <= load <= capacity
    ├── graph/                         road network
    │   ├── Graph.java                 weighted graph + hand-written Dijkstra (min-heap)
    │   ├── Edge.java                  one road
    │   └── RouteResult.java           path + travel time
    ├── policy/                        abstraction
    │   ├── ReplenishmentPolicy.java   abstract: how requests are ranked
    │   └── ShortagePriorityPolicy.java  urgency, then arrival, then request ID
    ├── service/
    │   └── DispatchService.java       the allocation pipeline (PriorityQueue, pending list)
    ├── data/
    │   └── SampleData.java            2 warehouses, 8 shops, 3 vehicles, 14 locations, 18 requests
    ├── ui/
    │   └── ConsoleMenu.java           menu: only input and printing, no business logic
    └── tests/
        └── TestScenarios.java         normal, insufficient stock, overloaded, inaccessible shop,
                                       two requests sharing last stock, urgency change, no vehicle

## Allocation rules

1. Rank requests by urgency (high first), then arrival order, then request ID.
2. Shop must be reachable by an open road; warehouses are tried nearest first.
3. Use the nearest warehouse that holds the COMPLETE request.
4. Reserve every commodity together (all or nothing).
5. Dispatch only if an available vehicle `canCarry()` the load (smallest one first);
   otherwise release the stock and keep the request PENDING with a reason.
6. Deduct warehouse stock on dispatch; add shop stock on confirmed receipt.
7. One shop request per trip. No globally optimal fleet schedule is claimed.

Input and state protections:

- Request IDs, shop IDs, commodity names, and vehicle IDs are required.
- Commodity quantities and vehicle capacities must be finite and positive.
- Urgency must be between 1 and 5.
- Invalid requests are rejected without entering the queue.
- A receipt can be confirmed only once; replaying it reports an explicit message
  and does not change shop stock.

## Why each data structure

| Data structure | Used for | Why it fits |
|---|---|---|
| Weighted graph (adjacency list) | Roads between warehouses, junctions, shops | Natural model of a road network with travel times |
| PriorityQueue | Waiting requests | Always gives the most urgent request in O(log n) |
| Dijkstra + min-heap | Fastest route, reachable warehouses | Correct for positive travel times; heap makes it efficient |
| HashMap / TreeMap | Stock per commodity, vehicles, requests by ID | Fast lookup by name or ID |
| ArrayList | Dispatch and receipt history, pending list | Keeps insertion order for display |

## Database-backed website

The browser version keeps the same control-center navbar and screens as the
desktop application, but its editable data is stored in MySQL/MariaDB through
the PHP API.

1. Start **Apache** and **MySQL** in XAMPP.
2. Import `database/schema.sql` in phpMyAdmin, then import `database/seed.sql`.
3. Open [http://localhost/SupplyChain/web/](http://localhost/SupplyChain/web/).
4. Select a warehouse row, choose **Update selected warehouse stock**, and
   enter the new quantity. The `update_warehouse` API action writes the value
   to the `warehouses` table.
5. Submit a new request from **New Request**. It is saved in
   `delivery_requests` and `request_items`.
6. Use **Process next request**. The `process_request` transaction checks
   complete stock, deducts all requested commodities together, and changes the
   request to `DISPATCHED`.
7. Confirm a receipt. The `confirm_receipt` transaction adds the commodities
   to the shop and changes the request to `DELIVERED`.

The PHP connection settings are in `web/config.php`. The current default is
the XAMPP MariaDB setup (`root` with an empty password); change it if the local
database has a password.
