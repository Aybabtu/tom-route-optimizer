# TOM Route Optimizer - Backend Server

Node.js/Express backend for the TOM Route Optimizer application. Handles all database operations for road data management.

## Setup

### 1. Create `.env` file

Copy `.env.example` to `.env` and update with your database credentials:

```bash
cp .env.example .env
```

Then edit `.env`:
```
DB_HOST=23.187.248.21
DB_USER=bidmyrou_Claude_Code
DB_PASSWORD=pZ.5[8EUdNbQWIWh
DB_NAME=bidmyrou_Road_Data
PORT=3001
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the server

**Development mode:**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will be available at `http://localhost:3001`

## API Endpoints

### Health Check
- `GET /api/health` - Check if server is running

### Roads Management
- `GET /api/roads` - Get all roads
- `POST /api/roads` - Add a new road
- `PUT /api/roads/:id` - Update a road
- `DELETE /api/roads/:id` - Delete a road
- `GET /api/roads/search/:query` - Search roads by name
- `GET /api/roads/jurisdiction/:jurisdiction` - Get roads by jurisdiction

### Statistics
- `GET /api/stats` - Get road statistics

## Road Object Structure

```json
{
  "id": 1,
  "name": "Main Street",
  "road_type": "class-a-pink",
  "max_tonnage": 80,
  "jurisdiction": "Pontiac",
  "notes": "Primary truck route",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

## Database Schema

### roads table
- `id` - Primary key
- `name` - Road name (unique)
- `road_type` - Classification (class-a-pink, class-b, restricted-3tn, etc.)
- `max_tonnage` - Maximum tonnage allowed
- `jurisdiction` - Jurisdiction (Pontiac, Oakland County, etc.)
- `notes` - Additional notes
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

## Security Notes

- `.env` file is in `.gitignore` and should never be committed
- Database credentials are stored server-side only
- Frontend communicates via API, never directly accesses database
- CORS is enabled for the frontend origin
