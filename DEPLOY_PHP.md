# Deploy PHP API to NixiHost

Since Node.js is not available on NixiHost, we've created a PHP version of the API that has the same functionality.

## What Changed

- **Node.js API** → **PHP API** (`api.php`)
- Same database endpoints and structure
- Works with existing frontend
- Integrates with BidMyRoute project

## Deployment Steps

### Step 1: Download and Upload Files

1. Download the latest code from GitHub as ZIP
2. Upload to NixiHost via cPanel File Manager
3. Extract to: `/public_html/road_data/tom-route-optimizer/`

### Step 2: Upload PHP API File

The key file is:
```
server/api.php
```

This is now your API endpoint instead of the Node.js server.

### Step 3: Configure the Frontend

On your Mac, create or update `.env`:

```bash
VITE_API_URL=https://bidmyroute.com/road_data/tom-route-optimizer/server/api.php
```

### Step 4: Test the API

Visit in your browser:
```
https://bidmyroute.com/road_data/tom-route-optimizer/server/api.php?/health
```

You should see:
```json
{"status":"ok","message":"Server is running"}
```

### Step 5: Start Using It

The frontend will automatically connect to the PHP API when you:
```bash
npm run dev
```

## API Endpoints

All endpoints are now accessible via `api.php`:

- `GET /health` - Health check
- `GET /roads` - Get all roads
- `POST /roads` - Add a road
- `PUT /roads/{id}` - Update a road
- `DELETE /roads/{id}` - Delete a road
- `GET /roads/search/{query}` - Search roads
- `GET /roads/jurisdiction/{jurisdiction}` - Get roads by jurisdiction
- `GET /stats` - Get statistics

## Example Usage from Frontend

```javascript
const response = await fetch(
  'https://bidmyroute.com/road_data/tom-route-optimizer/server/api.php/roads'
);
const roads = await response.json();
```

## Database Connection

The PHP API connects to:
```
Host: localhost
User: bidmyrou_Claude_Code
Password: pZ.5[8EUdNbQWIWh
Database: bidmyrou_Road_Data
Port: 3306
```

## Integration with BidMyRoute

Since this lives on the same server as BidMyRoute:
- You can reference the same database tables
- Share roads and route data between projects
- Use consistent APIs across your applications

## PHP Requirements

Your NixiHost account needs:
- PHP 7.2+ (usually available)
- PDO MySQL extension (usually available)
- cURL support (for frontend requests)

Most shared hosts have these enabled by default.

## Troubleshooting

### "Database connection failed"
- Check that database credentials are correct
- Verify MySQL is running on NixiHost
- Try creating a simple PHP test file:
```php
<?php
$pdo = new PDO("mysql:host=localhost", "bidmyrou_Claude_Code", "pZ.5[8EUdNbQWIWh");
echo "Connected!";
?>
```

### "Endpoint not found"
- Make sure you're hitting the correct URL
- Check that `api.php` is in the correct location
- Verify URL paths in your requests

### CORS Issues
- The API sets CORS headers for all origins
- If you still see CORS errors, contact NixiHost support

## Updating the API

To update the API on NixiHost:
1. Download latest code from GitHub
2. Upload `server/api.php` to replace the old one
3. Frontend automatically uses the updated API

## Performance Notes

PHP API performance:
- Database queries are optimized with indexing
- Connection pooling via PDO
- Suitable for small to medium datasets
- If you need extreme performance, consider moving to Node.js hosting

## Security Notes

- `.env` is not needed (credentials are in `api.php`)
- Consider moving credentials to a separate config file later
- CORS is open to all origins (adjust if needed)
- Add authentication if exposing sensitive endpoints
