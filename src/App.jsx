import React, { useState, useRef, useEffect } from 'react'
import { GoogleMap, LoadScript } from '@react-google-maps/api'
import RouteInput from './components/RouteInput'
import RouteResults from './components/RouteResults'
import './App.css'

const mapContainerStyle = {
  width: '100%',
  height: '100%'
}

const defaultCenter = {
  lat: 42.7335,
  lng: -83.2126
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyDxV19ti05Hv48SGe4KDgyiSuaaz1hGa54'
const TRUCK_RATE_PER_HOUR = 75
const MAX_CLASS_A_TONNAGE = 80
const MAX_CLASS_B_TONNAGE = 50

function App() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [transitionMarkers, setTransitionMarkers] = useState([])
  const mapsRef = useRef(null)
  const directionsServiceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const markersRef = useRef([])

  const initializeDirectionsService = () => {
    if (window.google && !directionsServiceRef.current) {
      directionsServiceRef.current = new window.google.maps.DirectionsService()
    }
  }

  const classifyStep = (step) => {
    const instruction = step.instructions?.toLowerCase() || ''
    const highway = step.highway

    // Check for Class A: known interstates, US routes, Michigan state routes
    const isClassA = highway ||
                     instruction.includes('i-') ||
                     instruction.includes('interstate') ||
                     instruction.includes('us-') ||
                     instruction.includes('us route') ||
                     instruction.includes('m-') ||
                     instruction.match(/\bm\s+\d+/)

    if (isClassA) return 'A'

    // If we can't confidently identify the road, mark as unknown
    // User can verify against Oakland County TOM map
    return 'unknown'
  }

  const findTransitions = (route) => {
    const transitions = []
    let prevClass = null

    route.legs.forEach((leg, legIdx) => {
      leg.steps.forEach((step, stepIdx) => {
        const currentClass = classifyStep(step)
        if (prevClass && prevClass !== currentClass) {
          transitions.push({
            location: step.start_location,
            from: prevClass,
            to: currentClass,
            instruction: step.instructions
          })
        }
        prevClass = currentClass
      })
    })

    return transitions
  }

  useEffect(() => {
    if (!mapsRef.current || selectedRoute === null || !routes[selectedRoute]) {
      return
    }

    // Clear previous renderer and markers
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
    }
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    // Create new renderer for selected route
    if (window.google) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapsRef.current,
        polylineOptions: {
          zIndex: 50,
          strokeColor: '#1976d2',
          strokeWeight: 5,
        },
        suppressMarkers: false,
      })
      directionsRendererRef.current.setDirections(routes[selectedRoute].directionsResult)
      directionsRendererRef.current.setRouteIndex(0)

      // Find and mark transitions
      const transitions = findTransitions(routes[selectedRoute].directionsResult.routes[0])
      setTransitionMarkers(transitions)

      transitions.forEach(transition => {
        const colorMap = {
          'A': '#4caf50',      // Green for Class A
          'B': '#ff9800',      // Orange for Class B
          'unknown': '#9c27b0' // Purple for Unknown
        }
        const marker = new window.google.maps.Marker({
          position: transition.location,
          map: mapsRef.current,
          title: `${transition.from === 'unknown' ? '❓ Unknown' : transition.from.toUpperCase()} → ${transition.to === 'unknown' ? '❓ Unknown' : transition.to.toUpperCase()}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: colorMap[transition.to] || '#999',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        })
        markersRef.current.push(marker)
      })
    }
  }, [selectedRoute, routes])

  const handleRouteSearch = async (origin, destination, tonnage) => {
    if (!directionsServiceRef.current) {
      setError('Google Maps not loaded yet')
      return
    }

    setLoading(true)
    setError(null)
    setRoutes([])
    setSelectedRoute(null)

    try {
      // Request multiple routes
      const result = await new Promise((resolve, reject) => {
        directionsServiceRef.current.route(
          {
            origin: origin,
            destination: destination,
            travelMode: 'DRIVING',
            provideRouteAlternatives: true,
          },
          (result, status) => {
            if (status === 'OK') {
              resolve(result)
            } else {
              reject(new Error(`Directions request failed: ${status}`))
            }
          }
        )
      })

      // Process each route
      const processedRoutes = result.routes.map((route, index) => {
        const leg = route.legs[0]
        const durationSeconds = leg.duration.value
        const durationHours = durationSeconds / 3600
        const distance = leg.distance.value / 1609.34 // Convert to miles

        // Estimate road class based on route
        // A = highways only; Unknown = contains unidentified roads
        const stepClasses = leg.steps?.map(s => classifyStep(s)) || []
        const hasUnknown = stepClasses.includes('unknown')
        const hasNonA = stepClasses.some(c => c !== 'A')
        const routeClass = hasUnknown ? 'unknown' : (hasNonA ? 'B' : 'A')

        // Calculate costs and efficiency
        const truckCost = durationHours * TRUCK_RATE_PER_HOUR
        const costPerTon = truckCost / tonnage
        const tonMilesPerHour = (tonnage * distance) / durationHours

        // Determine tonnage warnings
        const warnings = []
        let maxTonnage = MAX_CLASS_A_TONNAGE

        if (routeClass === 'unknown') {
          warnings.push({
            level: 'warning',
            message: '⚠️ This route contains roads not confirmed on Oakland County TOM. Verify against map before routing.'
          })
          maxTonnage = MAX_CLASS_B_TONNAGE // Be conservative with unknown roads
        } else if (routeClass === 'B') {
          warnings.push({
            level: 'info',
            message: 'This route uses Class B roads. Check bridge weight limits and overhead clearances.'
          })
          maxTonnage = MAX_CLASS_B_TONNAGE
        }

        if (tonnage > maxTonnage) {
          warnings.push({
            level: 'error',
            message: `Load exceeds limit (${maxTonnage}t max). Route may be illegal.`
          })
        } else if (tonnage > maxTonnage * 0.8) {
          warnings.push({
            level: 'warning',
            message: `Load near ${maxTonnage}t limit. Verify with dispatcher.`
          })
        }

        const routeOnlyResult = {
          ...result,
          routes: [route]
        }

        return {
          id: index,
          directionsResult: routeOnlyResult,
          routeIndex: 0,
          distance: distance,
          durationHours: durationHours,
          durationMinutes: Math.round(durationSeconds / 60),
          truckCost: truckCost,
          costPerTon: costPerTon,
          tonMilesPerHour: tonMilesPerHour,
          efficiency: tonMilesPerHour / costPerTon, // Higher = better
          routeClass: routeClass,
          warnings: warnings,
          summary: route.summary || `Route ${index + 1}`
        }
      })

      // Sort by efficiency
      processedRoutes.sort((a, b) => b.efficiency - a.efficiency)
      setRoutes(processedRoutes)

      if (processedRoutes.length > 0) {
        setSelectedRoute(processedRoutes[0].id)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <div className="app-container">
        <div className="sidebar">
          <div className="header">
            <h1>🚛 Oakland County</h1>
            <h2>Route Optimizer</h2>
          </div>

          <RouteInput
            onSearch={handleRouteSearch}
            loading={loading}
          />

          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          {routes.length > 0 && (
            <RouteResults
              routes={routes}
              selectedRouteId={selectedRoute}
              onSelectRoute={setSelectedRoute}
              transitions={transitionMarkers}
            />
          )}

          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>Calculating optimal routes...</p>
            </div>
          )}
        </div>

        <div className="map-container">
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={10}
            onLoad={(map) => {
              mapsRef.current = map
              initializeDirectionsService()
            }}
          />
        </div>
      </div>
    </LoadScript>
  )
}

export default App
