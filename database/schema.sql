USE valam_supply_chain;

-- 1. Warehouses Table
CREATE TABLE IF NOT EXISTS warehouses (
    warehouse_id VARCHAR(10) PRIMARY KEY,
    warehouse_name VARCHAR(100) NOT NULL,
    rice_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    wheat_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    sugar_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
);

-- 2. Fair Price Shops Table
CREATE TABLE IF NOT EXISTS shops (
    shop_id VARCHAR(10) PRIMARY KEY,
    shop_name VARCHAR(120) NOT NULL,
    location_name VARCHAR(120) NOT NULL,
    rice_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    wheat_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    sugar_kg DECIMAL(10,2) NOT NULL DEFAULT 0
);

-- 3. Delivery Requests Table
CREATE TABLE IF NOT EXISTS delivery_requests (
    request_id VARCHAR(20) PRIMARY KEY,
    shop_id VARCHAR(10) NOT NULL,
    urgency INT NOT NULL,
    total_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    details VARCHAR(500) DEFAULT '',
    arrival_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES shops(shop_id)
);

-- 4. Request Items Table (Normalized commodity items)
CREATE TABLE IF NOT EXISTS request_items (
    item_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id VARCHAR(20) NOT NULL,
    commodity_name VARCHAR(30) NOT NULL,
    quantity_kg DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (request_id) REFERENCES delivery_requests(request_id) ON DELETE CASCADE
);