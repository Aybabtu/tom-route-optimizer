import React, { useState, useRef, useEffect } from 'react'
import { GoogleMap, LoadScript } from '@react-google-maps/api'
import RouteInput from './components/RouteInput'
import RouteResults from './components/RouteResults'
import SegmentClassifier from './components/SegmentClassifier'
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
const GOOGLE_MAPS_LIBRARIES = ['geometry']
const TRUCK_RATE_PER_HOUR = 75
const MAX_CLASS_A_TONNAGE = 80
const MAX_CLASS_B_TONNAGE = 50

function App() {
  const [routes, setRoutes] = useState([])
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [transitionMarkers, setTransitionMarkers] = useState([])
  const [segments, setSegments] = useState([])
  const [selectedSegment, setSelectedSegment] = useState(null)
  const [showSegmentClassifier, setShowSegmentClassifier] = useState(false)
  const [rerouteMessage, setRerouteMessage] = useState(null)
  const mapsRef = useRef(null)
  const directionsServiceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const markersRef = useRef([])
  const segmentPolylinesRef = useRef([])
  const stepPolylinesRef = useRef([])
  const segmentsRef = useRef([])
  const routesRef = useRef([])
  const selectedRouteRef = useRef(null)

  // Keep refs in sync so callbacks always have fresh data
  useEffect(() => { segmentsRef.current = segments }, [segments])
  useEffect(() => { routesRef.current = routes }, [routes])
  useEffect(() => { selectedRouteRef.current = selectedRoute }, [selectedRoute])

  useEffect(() => { loadSegments() }, [])

  const loadSegments = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/segments`
      )
      if (!response.ok) throw new Error('Failed to load segments')
      const data = await response.json()
      setSegments(data)
      return data
    } catch (error) {
      console.error('Error loading segments:', error)
      return []
    }
  }

  const checkAndRerouteIfRestricted = (freshSegments) => {
    const currentRoutes = routesRef.current
    const currentSelectedId = selectedRouteRef.current
    if (!currentRoutes.length || currentSelectedId === null) return

    const T = 0.0003
    const findSegmentIn = (segs, startLat, startLng, endLat, endLng) =>
      segs.find(seg =>
        Math.abs(parseFloat(seg.start_lat) - startLat) < T &&
        Math.abs(parseFloat(seg.start_lng) - startLng) < T &&
        Math.abs(parseFloat(seg.end_lat) - endLat) < T &&
        Math.abs(parseFloat(seg.end_lng) - endLng) < T
      ) || null

    const routeHasRestricted = (route) =>
      route.directionsResult.routes[0].legs[0].steps.some(step => {
        const seg = findSegmentIn(
          freshSegments,
          step.start_location.lat(), step.start_location.lng(),
          step.end_location.lat(), step.end_location.lng()
        )
        return seg?.classification === 'restricted'
      })

    // Find the current route by id, not by array index
    const currentRoute = currentRoutes.find(r => r.id === currentSelectedId)
    if (!currentRoute || !routeHasRestricted(currentRoute)) return

    const countClassA = (route) =>
      route.directionsResult.routes[0].legs[0].steps.filter(
        step => classifyStep(step) === 'A'
      ).length

    const alternatives = currentRoutes
      .filter(r => r.id !== currentSelectedId && !routeHasRestricted(r))
      .sort((a, b) => countClassA(b) - countClassA(a) || b.efficiency - a.efficiency)

    if (alternatives.length > 0) {
      setSelectedRoute(alternatives[0].id)
      setRerouteMessage(`Route updated to avoid restricted road — now using ${alternatives[0].summary}`)
    } else {
      setRerouteMessage('Warning: All available routes pass through restricted segments.')
    }
  }

  const handleSegmentAdded = async (segmentData) => {
    const freshSegments = await loadSegments()
    setShowSegmentClassifier(false)
    setRerouteMessage(null)
    if (segmentData?.classification === 'restricted') {
      checkAndRerouteIfRestricted(freshSegments)
    }
  }

  const findNearbySegment = (startLat, startLng, endLat, endLng) => {
    const THRESHOLD = 0.0003 // ~30 metres
    return segmentsRef.current.find(seg =>
      Math.abs(parseFloat(seg.start_lat) - startLat) < THRESHOLD &&
      Math.abs(parseFloat(seg.start_lng) - startLng) < THRESHOLD &&
      Math.abs(parseFloat(seg.end_lat) - endLat) < THRESHOLD &&
      Math.abs(parseFloat(seg.end_lng) - endLng) < THRESHOLD
    ) || null
  }

  const handleStepClick = (step) => {
    const startLat = step.start_location.lat()
    const startLng = step.start_location.lng()
    const endLat = step.end_location.lat()
    const endLng = step.end_location.lng()
    const roadName = step.instructions?.replace(/<[^>]*>/g, '') || ''

    const existing = findNearbySegment(startLat, startLng, endLat, endLng)
    if (existing) {
      setSelectedSegment(existing)
    } else {
      setSelectedSegment({
        start_lat: startLat,
        start_lng: startLng,
        end_lat: endLat,
        end_lng: endLng,
        road_name: roadName,
      })
    }
    setShowSegmentClassifier(true)
  }

  const STEP_COLORS = {
    'class-a':   '#4caf50',
    'class-b':   '#ff9800',
    'restricted': '#f44336',
    'unclassified': '#9c27b0',
  }

  const renderRouteSteps = (routeData) => {
    stepPolylinesRef.current.forEach(p => p.setMap(null))
    stepPolylinesRef.current = []

    if (!mapsRef.current || !window.google || !routeData) return

    const leg = routeData.directionsResult.routes[0].legs[0]

    leg.steps.forEach(step => {
      let path
      if (step.polyline?.points) {
        path = window.google.maps.geometry.encoding.decodePath(step.polyline.points)
      } else {
        path = step.path?.length > 1 ? step.path : [step.start_location, step.end_location]
      }

      const existing = findNearbySegment(
        step.start_location.lat(), step.start_location.lng(),
        step.end_location.lat(), step.end_location.lng()
      )

      const color = existing
        ? (STEP_COLORS[existing.classification] || '#999')
        : classifyStep(step) === 'A' ? STEP_COLORS['class-a'] : STEP_COLORS['unclassified']

      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: color,
        strokeOpacity: 0.85,
        strokeWeight: 6,
        map: mapsRef.current,
        clickable: true,
        zIndex: 60,
      })

      polyline.addListener('mouseover', () => {
        polyline.setOptions({ strokeWeight: 9, strokeOpacity: 1 })
      })
      polyline.addListener('mouseout', () => {
        polyline.setOptions({ strokeWeight: 6, strokeOpacity: 0.85 })
      })
      polyline.addListener('click', () => handleStepClick(step))

      stepPolylinesRef.current.push(polyline)
    })
  }

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

  // Clear any leftover segment polylines (legacy cleanup)
  useEffect(() => {
    segmentPolylinesRef.current.forEach(p => p.setMap(null))
    segmentPolylinesRef.current = []
  }, [segments])

  // Re-color route steps whenever segments change (e.g. after saving a classification)
  useEffect(() => {
    const activeRoute = routes.find(r => r.id === selectedRoute)
    if (activeRoute) renderRouteSteps(activeRoute)
  }, [segments])

  useEffect(() => {
    const activeRoute = routes.find(r => r.id === selectedRoute)

    if (!mapsRef.current || !activeRoute) {
      stepPolylinesRef.current.forEach(p => p.setMap(null))
      stepPolylinesRef.current = []
      return
    }

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
    }
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    if (window.google) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapsRef.current,
        suppressPolylines: true,
        suppressMarkers: false,
      })
      directionsRendererRef.current.setDirections(activeRoute.directionsResult)
      directionsRendererRef.current.setRouteIndex(0)

      const transitions = findTransitions(activeRoute.directionsResult.routes[0])
      setTransitionMarkers(transitions)

      transitions.forEach(transition => {
        const colorMap = {
          'A': '#4caf50',
          'B': '#ff9800',
          'unknown': '#9c27b0'
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

      renderRouteSteps(activeRoute)
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
    stepPolylinesRef.current.forEach(p => p.setMap(null))
    stepPolylinesRef.current = []

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

        let maxTonnage = MAX_CLASS_A_TONNAGE
        const warnings = []

        if (routeClass === 'unknown') {
          warnings.push({
            level: 'warning',
            message: '⚠️ This route contains roads not confirmed on Oakland County TOM. Verify against map before routing.'
          })
          maxTonnage = MAX_CLASS_B_TONNAGE
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
            message: `Load EXCEEDS limit (${maxTonnage}t max). Route is NOT legal for this load.`
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
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
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

          {rerouteMessage && (
            <div className={`reroute-message ${rerouteMessage.startsWith('Warning') ? 'reroute-warning' : 'reroute-info'}`}>
              {rerouteMessage}
              <button className="reroute-dismiss" onClick={() => setRerouteMessage(null)}>✕</button>
            </div>
          )}

          {routes.length > 0 && (
            <>
              <RouteResults
                routes={routes}
                selectedRouteId={selectedRoute}
                onSelectRoute={setSelectedRoute}
                transitions={transitionMarkers}
              />
              <div className="classify-hint">
                Click any segment on the route to classify it
              </div>
            </>
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

        {showSegmentClassifier && selectedSegment && (
          <SegmentClassifier
            segment={{
              id: selectedSegment.id || null,
              start: { lat: parseFloat(selectedSegment.start_lat), lng: parseFloat(selectedSegment.start_lng) },
              end: { lat: parseFloat(selectedSegment.end_lat), lng: parseFloat(selectedSegment.end_lng) },
              classification: selectedSegment.classification || null,
              notes: selectedSegment.notes || null,
              jurisdiction: selectedSegment.jurisdiction || null,
              roadName: selectedSegment.road_name || null,
            }}
            onClose={() => setShowSegmentClassifier(false)}
            onSegmentAdded={handleSegmentAdded}
          />
        )}
      </div>
    </LoadScript>
  )
}

export default App
