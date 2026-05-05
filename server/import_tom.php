<?php
/**
 * One-time import script: SEMCOG All-Season Truck Routes → tom_segments table
 * Run from the browser once (or again to refresh Oakland County data).
 */

header('Content-Type: text/html; charset=utf-8');
echo "<pre>\n";
flush();

$db_host     = 'localhost';
$db_user     = 'bidmyrou_Claude_Code';
$db_password = 'pZ.5[8EUdNbQWIWh';
$db_name     = 'bidmyrou_Road_Data';

try {
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user, $db_password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("DB connection failed: " . $e->getMessage());
}

// Create table if not exists
$pdo->exec("
    CREATE TABLE IF NOT EXISTS tom_segments (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        road_name     VARCHAR(255),
        county        VARCHAR(100),
        classification VARCHAR(50) DEFAULT 'class-a',
        bmp           DECIMAL(10,6),
        emp           DECIMAL(10,6),
        nfc           TINYINT,
        start_lat     DECIMAL(10,8) NOT NULL,
        start_lng     DECIMAL(11,8) NOT NULL,
        end_lat       DECIMAL(10,8) NOT NULL,
        end_lng       DECIMAL(11,8) NOT NULL,
        source        VARCHAR(100) DEFAULT 'SEMCOG',
        imported_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(road_name),
        INDEX(county),
        INDEX(classification)
    )
");

// Wipe previous Oakland County SEMCOG import
$deleted = $pdo->exec("DELETE FROM tom_segments WHERE county = 'Oakland County' AND source = 'SEMCOG'");
echo "Cleared $deleted existing Oakland County records.\n";
flush();

$insert = $pdo->prepare("
    INSERT INTO tom_segments (road_name, county, classification, bmp, emp, nfc, start_lat, start_lng, end_lat, end_lng)
    VALUES (?, 'Oakland County', 'class-a', ?, ?, ?, ?, ?, ?, ?)
");

$base_url  = 'https://gis.semcog.org/server/rest/services/Hosted/All_Season_Truck_Routes/FeatureServer/13/query';
$page_size = 1000;
$offset    = 0;
$imported  = 0;
$errors    = 0;

do {
    $url = $base_url . '?' . http_build_query([
        'where'             => "PC_CO='63'",
        'outFields'         => 'road_name,bmp,emp,nfc',
        'resultOffset'      => $offset,
        'resultRecordCount' => $page_size,
        'outSR'             => '4326',
        'f'                 => 'json',
    ]);

    $raw = @file_get_contents($url);
    if ($raw === false) {
        echo "ERROR: Could not fetch data at offset $offset\n";
        $errors++;
        break;
    }

    $data = json_decode($raw, true);
    if (isset($data['error'])) {
        echo "API ERROR: " . $data['error']['message'] . "\n";
        break;
    }

    $features = $data['features'] ?? [];
    if (empty($features)) break;

    $pdo->beginTransaction();
    foreach ($features as $feature) {
        $a     = $feature['attributes'];
        $paths = $feature['geometry']['paths'] ?? [];
        if (empty($paths)) { $errors++; continue; }

        // ArcGIS returns paths as [[lng, lat], ...] — take first/last overall point
        $first_path = $paths[0];
        $last_path  = $paths[count($paths) - 1];
        $start      = $first_path[0];
        $end        = $last_path[count($last_path) - 1];

        try {
            $insert->execute([
                $a['road_name'] ?? null,
                $a['bmp']       ?? null,
                $a['emp']       ?? null,
                $a['nfc']       ?? null,
                $start[1], $start[0],   // lat, lng
                $end[1],   $end[0],
            ]);
            $imported++;
        } catch (PDOException $e) {
            $errors++;
        }
    }
    $pdo->commit();

    echo "Page: imported " . count($features) . " records (running total: $imported)\n";
    flush();
    $offset += count($features);

} while (count($features) === $page_size);

echo "\nDone. Imported: $imported  Errors: $errors\n";
echo "</pre>\n";
?>
