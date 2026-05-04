<?php
/**
 * TOM Route Optimizer API - PHP Version
 * Handles all road data management and routing
 */

// Enable CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database configuration
$db_host = 'localhost';
$db_user = 'bidmyrou_Claude_Code';
$db_password = 'pZ.5[8EUdNbQWIWh';
$db_name = 'bidmyrou_Road_Data';
$db_port = 3306;

// Connect to database
try {
    $pdo = new PDO(
        "mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]));
}

// Initialize database tables
function initializeDatabase($pdo) {
    try {
        // Create roads table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS roads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                road_type VARCHAR(50),
                max_tonnage INT,
                jurisdiction VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX(name),
                INDEX(jurisdiction)
            )
        ");

        // Create michigan_roads table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS michigan_roads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                road_name VARCHAR(255),
                road_type VARCHAR(50),
                county VARCHAR(100),
                geometry JSON,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(road_name),
                INDEX(county)
            )
        ");

        // Create road_segments table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS road_segments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                start_lat DECIMAL(10, 8) NOT NULL,
                start_lng DECIMAL(11, 8) NOT NULL,
                end_lat DECIMAL(10, 8) NOT NULL,
                end_lng DECIMAL(11, 8) NOT NULL,
                classification VARCHAR(50) NOT NULL,
                jurisdiction VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX(start_lat, start_lng),
                INDEX(end_lat, end_lng),
                INDEX(classification),
                INDEX(jurisdiction)
            )
        ");
    } catch (PDOException $e) {
        error_log('Database initialization error: ' . $e->getMessage());
    }
}

// Parse request
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('/road_data/tom-route-optimizer/server/api.php', '', $path);

// Route handling
$routes = [
    'GET' => [
        '/health' => 'getHealth',
        '/roads' => 'getRoads',
        '/stats' => 'getStats',
        '/roads/search/' => 'searchRoads',
        '/roads/jurisdiction/' => 'getRoadsByJurisdiction'
    ],
    'POST' => [
        '/roads' => 'addRoad'
    ],
    'PUT' => [
        '/roads/' => 'updateRoad'
    ],
    'DELETE' => [
        '/roads/' => 'deleteRoad'
    ]
];

// Initialize database
initializeDatabase($pdo);

// Route dispatcher
function dispatch($method, $path, $pdo) {
    // Health check
    if ($method === 'GET' && $path === '/health') {
        return getHealth();
    }

    // Get all roads
    if ($method === 'GET' && $path === '/roads') {
        return getRoads($pdo);
    }

    // Get statistics
    if ($method === 'GET' && $path === '/stats') {
        return getStats($pdo);
    }

    // Search roads
    if ($method === 'GET' && strpos($path, '/roads/search/') === 0) {
        $query = substr($path, strlen('/roads/search/'));
        return searchRoads($pdo, urldecode($query));
    }

    // Get roads by jurisdiction
    if ($method === 'GET' && strpos($path, '/roads/jurisdiction/') === 0) {
        $jurisdiction = substr($path, strlen('/roads/jurisdiction/'));
        return getRoadsByJurisdiction($pdo, urldecode($jurisdiction));
    }

    // Add road
    if ($method === 'POST' && $path === '/roads') {
        $data = json_decode(file_get_contents('php://input'), true);
        return addRoad($pdo, $data);
    }

    // Update road
    if ($method === 'PUT' && strpos($path, '/roads/') === 0) {
        $id = substr($path, strlen('/roads/'));
        $data = json_decode(file_get_contents('php://input'), true);
        return updateRoad($pdo, $id, $data);
    }

    // Delete road
    if ($method === 'DELETE' && strpos($path, '/roads/') === 0) {
        $id = substr($path, strlen('/roads/'));
        return deleteRoad($pdo, $id);
    }

    // Get all segments
    if ($method === 'GET' && $path === '/segments') {
        return getSegments($pdo);
    }

    // Add segment
    if ($method === 'POST' && $path === '/segments') {
        $data = json_decode(file_get_contents('php://input'), true);
        return addSegment($pdo, $data);
    }

    // Update segment
    if ($method === 'PUT' && strpos($path, '/segments/') === 0) {
        $id = substr($path, strlen('/segments/'));
        $data = json_decode(file_get_contents('php://input'), true);
        return updateSegment($pdo, $id, $data);
    }

    // Delete segment
    if ($method === 'DELETE' && strpos($path, '/segments/') === 0) {
        $id = substr($path, strlen('/segments/'));
        return deleteSegment($pdo, $id);
    }

    // Find segments near coordinates
    if ($method === 'GET' && strpos($path, '/segments/near/') === 0) {
        $coords = substr($path, strlen('/segments/near/'));
        return findNearbySegments($pdo, $coords);
    }

    // 404
    http_response_code(404);
    return ['error' => 'Endpoint not found'];
}

// Endpoint handlers

function getHealth() {
    return ['status' => 'ok', 'message' => 'Server is running'];
}

function getRoads($pdo) {
    try {
        $stmt = $pdo->query('SELECT * FROM roads ORDER BY name');
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to fetch roads'];
    }
}

function addRoad($pdo, $data) {
    if (!isset($data['name']) || !isset($data['road_type']) || !isset($data['max_tonnage'])) {
        http_response_code(400);
        return ['error' => 'Missing required fields: name, road_type, max_tonnage'];
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO roads (name, road_type, max_tonnage, jurisdiction, notes)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['name'],
            $data['road_type'],
            $data['max_tonnage'],
            $data['jurisdiction'] ?? null,
            $data['notes'] ?? null
        ]);

        http_response_code(201);
        return [
            'id' => $pdo->lastInsertId(),
            'message' => 'Road added successfully'
        ];
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            http_response_code(409);
            return ['error' => 'Road already exists'];
        }
        http_response_code(500);
        return ['error' => 'Failed to add road'];
    }
}

function updateRoad($pdo, $id, $data) {
    try {
        $stmt = $pdo->prepare(
            'UPDATE roads SET name = ?, road_type = ?, max_tonnage = ?, jurisdiction = ?, notes = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $data['name'],
            $data['road_type'],
            $data['max_tonnage'],
            $data['jurisdiction'] ?? null,
            $data['notes'] ?? null,
            $id
        ]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            return ['error' => 'Road not found'];
        }

        return ['message' => 'Road updated successfully'];
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to update road'];
    }
}

function deleteRoad($pdo, $id) {
    try {
        $stmt = $pdo->prepare('DELETE FROM roads WHERE id = ?');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            return ['error' => 'Road not found'];
        }

        return ['message' => 'Road deleted successfully'];
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to delete road'];
    }
}

function searchRoads($pdo, $query) {
    try {
        $stmt = $pdo->prepare(
            'SELECT * FROM roads WHERE name LIKE ? OR jurisdiction LIKE ? ORDER BY name'
        );
        $searchTerm = "%$query%";
        $stmt->execute([$searchTerm, $searchTerm]);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to search roads'];
    }
}

function getRoadsByJurisdiction($pdo, $jurisdiction) {
    try {
        $stmt = $pdo->prepare('SELECT * FROM roads WHERE jurisdiction = ? ORDER BY name');
        $stmt->execute([$jurisdiction]);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to fetch roads'];
    }
}

function getStats($pdo) {
    try {
        $stmt = $pdo->query('SELECT COUNT(*) as total FROM roads');
        $countResult = $stmt->fetch();

        $stmt = $pdo->query('SELECT DISTINCT jurisdiction FROM roads WHERE jurisdiction IS NOT NULL');
        $jurisdictions = $stmt->fetchAll(PDO::FETCH_COLUMN);

        return [
            'total_roads' => $countResult['total'],
            'jurisdictions' => $jurisdictions
        ];
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to fetch statistics'];
    }
}

// Segment handlers

function getSegments($pdo) {
    try {
        $stmt = $pdo->query('SELECT * FROM road_segments ORDER BY created_at DESC');
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to fetch segments'];
    }
}

function addSegment($pdo, $data) {
    if (!isset($data['start_lat']) || !isset($data['start_lng']) ||
        !isset($data['end_lat']) || !isset($data['end_lng']) ||
        !isset($data['classification'])) {
        http_response_code(400);
        return ['error' => 'Missing required fields: start_lat, start_lng, end_lat, end_lng, classification'];
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO road_segments (start_lat, start_lng, end_lat, end_lng, classification, jurisdiction, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $data['start_lat'],
            $data['start_lng'],
            $data['end_lat'],
            $data['end_lng'],
            $data['classification'],
            $data['jurisdiction'] ?? null,
            $data['notes'] ?? null
        ]);

        http_response_code(201);
        return [
            'id' => $pdo->lastInsertId(),
            'message' => 'Segment added successfully'
        ];
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to add segment: ' . $e->getMessage()];
    }
}

function updateSegment($pdo, $id, $data) {
    try {
        $stmt = $pdo->prepare(
            'UPDATE road_segments SET start_lat = ?, start_lng = ?, end_lat = ?, end_lng = ?, classification = ?, jurisdiction = ?, notes = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $data['start_lat'],
            $data['start_lng'],
            $data['end_lat'],
            $data['end_lng'],
            $data['classification'],
            $data['jurisdiction'] ?? null,
            $data['notes'] ?? null,
            $id
        ]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            return ['error' => 'Segment not found'];
        }

        return ['message' => 'Segment updated successfully'];
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to update segment'];
    }
}

function deleteSegment($pdo, $id) {
    try {
        $stmt = $pdo->prepare('DELETE FROM road_segments WHERE id = ?');
        $stmt->execute([$id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            return ['error' => 'Segment not found'];
        }

        return ['message' => 'Segment deleted successfully'];
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to delete segment'];
    }
}

function findNearbySegments($pdo, $coords) {
    // Parse coordinates: lat,lng,radius
    $parts = explode(',', $coords);
    if (count($parts) !== 3) {
        http_response_code(400);
        return ['error' => 'Invalid coordinates format. Use: lat,lng,radius'];
    }

    $lat = (float)$parts[0];
    $lng = (float)$parts[1];
    $radius = (float)$parts[2]; // in degrees (approximately 111km per degree)

    try {
        $stmt = $pdo->prepare(
            'SELECT * FROM road_segments
             WHERE start_lat BETWEEN ? AND ?
             AND start_lng BETWEEN ? AND ?
             AND end_lat BETWEEN ? AND ?
             AND end_lng BETWEEN ? AND ?'
        );
        $stmt->execute([
            $lat - $radius, $lat + $radius,
            $lng - $radius, $lng + $radius,
            $lat - $radius, $lat + $radius,
            $lng - $radius, $lng + $radius
        ]);
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        http_response_code(500);
        return ['error' => 'Failed to search segments'];
    }
}

// Execute and output
$response = dispatch($method, $path, $pdo);
echo json_encode($response);
?>
