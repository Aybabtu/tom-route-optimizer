# Oakland County Truck Route Optimizer

A prototype web application for optimizing truck routes based on road classifications, weight restrictions, and time-cost tradeoffs.

## Features

- **Multi-route calculation**: Gets multiple route alternatives from Google Maps
- **Smart efficiency ranking**: Rates routes by throughput per cost (ton-miles/hour per dollar)
- **Weight warnings**: Alerts for tonnage exceeding road class limits
- **Road classification**: Identifies Class A (highway) vs Class B (local) routes
- **Time-cost analysis**: Shows duration, distance, and truck operating costs for each route

## Setup

### Prerequisites
- Node.js 16+ and npm

### Installation

1. Navigate to the project directory:
```bash
cd /Users/michaelpelletier/tom-route-optimizer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## How to Use

1. **Enter origin and destination** addresses
2. **Input the load weight** in tons
3. **Click "Calculate Routes"** - the app will:
   - Fetch multiple route options from Google Maps
   - Calculate efficiency metrics for each
   - Show warnings for weight restrictions
   - Recommend the best route by efficiency

4. **Review results**:
   - Routes are ranked by efficiency (ton-miles per hour per dollar)
   - Click a route to view it on the map
   - Check warnings for weight/clearance concerns

## Road Classifications

- **Class A** (Red/Green on TOM map): State highways and special-designated roads
  - Maximum tonnage: 80 tons
  - Preferred for heavy loads
  
- **Class B** (Black on TOM map): Local roads
  - Maximum tonnage: 50 tons
  - Used only when necessary

## Future Enhancements

- [ ] Import actual TOM map data (bridge weights, overhead clearances)
- [ ] Add height/width/axle-config inputs
- [ ] Integrate with actual truck cost database
- [ ] Add manual restriction zones/overrides
- [ ] Support for time-window constraints
- [ ] Historical route data and actual drive times

## API Keys

The app uses Google Maps API. The current API key in the code is for testing only. For production, you should:
1. Generate your own API key at https://console.cloud.google.com/
2. Enable the Directions API and Maps JavaScript API
3. Replace the key in `src/App.jsx`

## Architecture

- **Frontend**: React 18 with Vite
- **Mapping**: Google Maps API
- **Routing**: Google Directions Service
- **Algorithm**: Custom efficiency calculation based on:
  - Travel duration (affects truck hourly cost)
  - Load tonnage (affects throughput)
  - Road classifications (affects legal weight limits)

## Notes

This is an early prototype. The routing algorithm uses simplified heuristics:
- Road class detection based on highway names (I-, US-, State routes)
- Simplified weight limits (80t for Class A, 50t for Class B)
- Actual TOM data should be integrated for production use
