<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

// Guard check: verify $pdo exists
if (!isset($pdo) || !$pdo instanceof PDO) {
    http_response_code(500);
    echo json_encode(['error' => '$pdo variable is not initialized in config.php']);
    exit;
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'warehouses':
        try {
            $stmt = $pdo->query("SELECT * FROM warehouses ORDER BY warehouse_id ASC");
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Query failed: ' . $e->getMessage()]);
        }
        break;

    case 'shops':
        try {
            $stmt = $pdo->query("SELECT * FROM shops ORDER BY shop_id ASC");
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Query failed: ' . $e->getMessage()]);
        }
        break;

    case 'requests':
        try {
            $sql = "SELECT r.*, s.shop_name, s.location_name,
                    (SELECT GROUP_CONCAT(CONCAT(ri.commodity_name, ': ', ri.quantity_kg, 'kg')
                     ORDER BY ri.commodity_name SEPARATOR ', ')
                     FROM request_items ri WHERE ri.request_id = r.request_id) AS items_text
                    FROM delivery_requests r
                    JOIN shops s ON r.shop_id = s.shop_id
                    ORDER BY r.urgency DESC, r.arrival_order ASC, r.request_id ASC";
            $stmt = $pdo->query($sql);
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Query failed: ' . $e->getMessage()]);
        }
        break;

    case 'create_request':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['request_id']) || empty($input['shop_id'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request data']);
            exit;
        }

        $requestId = trim($input['request_id']);
        $shopId = trim($input['shop_id']);
        $urgency = (int)$input['urgency'];
        $items = $input['items'] ?? [];

        $totalKg = 0;
        $detailsArr = [];
        foreach ($items as $item) {
            $qty = (float)$item['quantity_kg'];
            if ($qty > 0) {
                $totalKg += $qty;
                $detailsArr[] = "{$item['commodity']}: {$qty}kg";
            }
        }
        $details = implode(', ', $detailsArr);

        try {
            $pdo->beginTransaction();

            $orderStmt = $pdo->query("SELECT COALESCE(MAX(arrival_order), 0) + 1 AS next_order FROM delivery_requests");
            $arrivalOrder = (int)$orderStmt->fetch()['next_order'];

            $stmt = $pdo->prepare("INSERT INTO delivery_requests 
                (request_id, shop_id, urgency, total_kg, status, details, arrival_order) 
                VALUES (?, ?, ?, ?, 'PENDING', ?, ?)");
            $stmt->execute([$requestId, $shopId, $urgency, $totalKg, $details, $arrivalOrder]);

            $itemStmt = $pdo->prepare("INSERT INTO request_items (request_id, commodity_name, quantity_kg) VALUES (?, ?, ?)");
            foreach ($items as $item) {
                $qty = (float)$item['quantity_kg'];
                if ($qty > 0) {
                    $itemStmt->execute([$requestId, $item['commodity'], $qty]);
                }
            }

            $pdo->commit();
            echo json_encode(['success' => true, 'request_id' => $requestId]);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Transaction failed: ' . $e->getMessage()]);
        }
        break;

    case 'update_warehouse':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $warehouseId = trim((string)($input['warehouse_id'] ?? ''));
        $commodity = strtolower(trim((string)($input['commodity'] ?? '')));
        $quantity = filter_var($input['quantity_kg'] ?? null, FILTER_VALIDATE_FLOAT);
        $columns = ['rice' => 'rice_kg', 'wheat' => 'wheat_kg', 'sugar' => 'sugar_kg'];
        if ($warehouseId === '' || !isset($columns[$commodity]) || $quantity === false || $quantity < 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid warehouse, commodity and non-negative quantity are required.']);
            exit;
        }
        try {
            $stmt = $pdo->prepare("UPDATE warehouses SET {$columns[$commodity]} = ? WHERE warehouse_id = ?");
            $stmt->execute([$quantity, $warehouseId]);
            if ($stmt->rowCount() === 0) {
                $check = $pdo->prepare("SELECT warehouse_id FROM warehouses WHERE warehouse_id = ?");
                $check->execute([$warehouseId]);
                if (!$check->fetch()) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Warehouse not found.']);
                    exit;
                }
            }
            echo json_encode(['success' => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Warehouse update failed: ' . $e->getMessage()]);
        }
        break;

    case 'process_request':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $requestId = trim((string)($input['request_id'] ?? ''));
        if ($requestId === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Request ID is required.']);
            exit;
        }
        try {
            $pdo->beginTransaction();
            $requestStmt = $pdo->prepare(
                "SELECT * FROM delivery_requests WHERE request_id = ? FOR UPDATE"
            );
            $requestStmt->execute([$requestId]);
            $request = $requestStmt->fetch();
            if (!$request || $request['status'] !== 'PENDING') {
                throw new RuntimeException('Request not found or already processed.');
            }
            $itemsStmt = $pdo->prepare(
                "SELECT commodity_name, quantity_kg FROM request_items WHERE request_id = ?"
            );
            $itemsStmt->execute([$requestId]);
            $items = $itemsStmt->fetchAll();
            $warehouseStmt = $pdo->query("SELECT * FROM warehouses ORDER BY warehouse_id FOR UPDATE");
            $selected = null;
            foreach ($warehouseStmt->fetchAll() as $warehouse) {
                $complete = true;
                foreach ($items as $item) {
                    $column = strtolower($item['commodity_name']) . '_kg';
                    if (!array_key_exists($column, $warehouse) || (float)$warehouse[$column] < (float)$item['quantity_kg']) {
                        $complete = false;
                        break;
                    }
                }

                if ($complete) {
                    $selected = $warehouse;
                    break;
                }
            }
            if ($selected === null) {
                $pdo->prepare("UPDATE delivery_requests SET details = ? WHERE request_id = ?")
                    ->execute(['PENDING: insufficient complete warehouse stock', $requestId]);
                $pdo->commit();
                echo json_encode(['success' => false, 'message' => 'Insufficient complete warehouse stock.']);
                exit;
            }
            foreach ($items as $item) {
                $column = strtolower($item['commodity_name']) . '_kg';
                $update = $pdo->prepare("UPDATE warehouses SET {$column} = {$column} - ? WHERE warehouse_id = ?");
                $update->execute([(float)$item['quantity_kg'], $selected['warehouse_id']]);
            }
            $details = $selected['warehouse_id'] . ' -> ' . $request['shop_id'] . ' | Vehicle V001';
            $pdo->prepare("UPDATE delivery_requests SET status = 'DISPATCHED', details = ? WHERE request_id = ?")
                ->execute([$details, $requestId]);
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => $requestId . ' dispatched.', 'details' => $details]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;

    case 'confirm_receipt':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $requestId = trim((string)($input['request_id'] ?? ''));
        try {
            $pdo->beginTransaction();
            $requestStmt = $pdo->prepare("SELECT * FROM delivery_requests WHERE request_id = ? FOR UPDATE");
            $requestStmt->execute([$requestId]);
            $request = $requestStmt->fetch();
            if (!$request || $request['status'] !== 'DISPATCHED') {
                throw new RuntimeException('Dispatched request not found.');
            }
            $itemsStmt = $pdo->prepare("SELECT commodity_name, quantity_kg FROM request_items WHERE request_id = ?");
            $itemsStmt->execute([$requestId]);
            foreach ($itemsStmt->fetchAll() as $item) {
                $column = strtolower($item['commodity_name']) . '_kg';
                $update = $pdo->prepare("UPDATE shops SET {$column} = {$column} + ? WHERE shop_id = ?");
                $update->execute([(float)$item['quantity_kg'], $request['shop_id']]);
            }
            $pdo->prepare("UPDATE delivery_requests SET status = 'DELIVERED', details = ? WHERE request_id = ?")
                ->execute(['RECEIVED at ' . $request['shop_id'], $requestId]);
            $pdo->commit();
            echo json_encode(['success' => true, 'message' => $requestId . ' receipt confirmed.']);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()]);
        }
        break;

    default:
        echo json_encode(['status' => 'API ready', 'endpoints' => ['warehouses', 'shops', 'requests', 'create_request', 'update_warehouse', 'process_request', 'confirm_receipt']]);
        break;
}