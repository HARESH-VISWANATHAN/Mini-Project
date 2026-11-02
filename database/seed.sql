USE valam_supply_chain;

-- Warehouses
INSERT INTO warehouses (warehouse_id, warehouse_name, rice_kg, wheat_kg, sugar_kg, status) VALUES
('W1', 'Central Warehouse', 1000.00, 800.00, 500.00, 'AVAILABLE'),
('W2', 'Regional Warehouse', 600.00, 500.00, 300.00, 'AVAILABLE');

-- Fair Price Shops
INSERT INTO shops (shop_id, shop_name, location_name, rice_kg, wheat_kg, sugar_kg) VALUES
('S1', 'Bazaar FPS 1', 'Market Street', 120.00, 80.00, 30.00),
('S2', 'South FPS 2', 'Temple Road', 450.00, 300.00, 150.00),
('S3', 'East FPS 3', 'River Colony', 50.00, 40.00, 10.00),
('S4', 'Lake Road FPS 4', 'Lake Junction', 600.00, 700.00, 300.00),
('S5', 'North Hill FPS 5', 'Hill Post', 20.00, 15.00, 5.00),
('S6', 'Cantonment FPS 6', 'Station Road', 300.00, 250.00, 80.00);

-- Initial Demo Requests
INSERT INTO delivery_requests (request_id, shop_id, urgency, total_kg, status, details, arrival_order) VALUES
('R001', 'S5', 5, 150.00, 'PENDING', 'Rice: 100kg, Wheat: 50kg', 1),
('R002', 'S3', 4, 200.00, 'PENDING', 'Rice: 150kg, Sugar: 50kg', 2);

-- Items for R001 & R002
INSERT INTO request_items (request_id, commodity_name, quantity_kg) VALUES
('R001', 'Rice', 100.00),
('R001', 'Wheat', 50.00),
('R002', 'Rice', 150.00),
('R002', 'Sugar', 50.00);