import React, { useState, useRef, useEffect } from 'react'
import { GoogleMap, LoadScript } from '@react-google-maps/api'
import RouteInput from './components/RouteInput'
import RouteResults from './components/RouteResults'
import PontiacRoadManager from './components/PontiacRoadManager'
import SegmentClassifier from './components/SegmentClassifier'
import { roadsApi } from './utils/api'
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
  const [pontiacRoads, setPontiacRoads] = useState([])
  const [segments, setSegments] = useState([])
  const [selectedSegment, setSelectedSegment] = useState(null)
  const [showSegmentClassifier, setShowSegmentClassifier] = useState(false)
  const mapsRef = useRef(null)
  const directionsServiceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const markersRef = useRef([])
  const segmentPolylinesRef = useRef([])
  const stepPolylinesRef = useRef([])
  const segmentsRef = useRef([])

  // Keep segmentsRef current so click handlers always see the latest data
  useEffect(() => {
    segmentsRef.current = segments
  }, [segments])

  // Load Pontiac roads and segments from database
  useEffect(() => {
    loadPontiacRoads()
    loadSegments()
  }, [])

  const loadPontiacRoads = async () => {
    try {
      const roads = await roadsApi.getByJurisdiction('Pontiac')
      setPontiacRoads(roads)
    } catch (error) {
      console.error('Error loading Pontiac roads:', error)
    }
  }

  const loadSegments = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/segments`
      )
      if (!response.ok) throw new Error('Failed to load segments')
      const data = await response.json()
      setSegments(data)
    } catch (error) {
      console.error('Error loading segments:', error)
    }
  }

  const addPontiacRoad = (road) => {
    setPontiacRoads([...pontiacRoads, road])
    // Reload from database to ensure sync
    loadPontiacRoads()
  }

  const deletePontiacRoad = async (index) => {
    try {
      const road = pontiacRoads[index]
      if (road.id) {
        await roadsApi.delete(road.id)
      }
      setPontiacRoads(pontiacRoads.filter((_, i) => i !== index))
      loadPontiacRoads()
    } catch (error) {
      console.error('Error deleting road:', error)
      alert('Error deleting road')
    }
  }

  const handleSegmentAdded = async (segmentData) => {
    await loadSegments()
    setShowSegmentClassifier(false)
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

      const polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#1976d2',
        strokeOpacity: 0,
        strokeWeight: 20,
        map: mapsRef.current,
        clickable: true,
        zIndex: 60,
      })

      polyline.addListener('mouseover', () => {
        polyline.setOptions({ strokeOpacity: 0.25 })
      })
      polyline.addListener('mouseout', () => {
        polyline.setOptions({ strokeOpacity: 0 })
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

  const PONTIAC_CLASSIFICATIONS = {
    'class-a-pink': { maxTonnage: 80, name: 'Class A (Pink)' },
    'class-a-mdot': { maxTonnage: 80, name: 'MDOT Class A (Lime Green)' },
    'class-b': { maxTonnage: 50, name: 'Class B (Blue)' },
    'restricted-3tn': { maxTonnage: 3, name: 'City Restricted - 3 TN (Orange)' },
    'restricted-6tn': { maxTonnage: 6, name: 'City Restricted - 6 TN (Dark Green)' },
    'restricted-grey': { maxTonnage: 10, name: 'City Restricted (Grey)' },
    'oakland-county': { maxTonnage: 80, name: 'Oakland County (Burnt Orange)' }
  }

  const checkPontiacRoad = (instruction) => {
    const instructionLower = instruction?.toLowerCase() || ''
    for (const road of pontiacRoads) {
      if (instructionLower.includes(road.name.toLowerCase())) {
        return road
      }
    }
    return null
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

  const renderSegments = () => {
    if (!mapsRef.current || !window.google) return

    // Clear previous segment polylines
    segmentPolylinesRef.current.forEach(polyline => polyline.setMap(null))
    segmentPolylinesRef.current = []

    // Color mapping for classifications
    const classificationColors = {
      'class-a': { color: '#4caf50', weight: 6, opacity: 0.8 },    // Green
      'class-b': { color: '#ff9800', weight: 6, opacity: 0.8 },    // Orange
      'restricted': { color: '#f44336', weight: 6, opacity: 0.8 }  // Red
    }

    // Render each segment as a polyline
    segments.forEach(segment => {
      const path = [
        { lat: parseFloat(segment.start_lat), lng: parseFloat(segment.start_lng) },
        { lat: parseFloat(segment.end_lat), lng: parseFloat(segment.end_lng) }
      ]

      const styleConfig = classificationColors[segment.classification] || {
        color: '#999',
        weight: 4,
        opacity: 0.5
      }

      const polyline = new window.google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: styleConfig.color,
        strokeOpacity: styleConfig.opacity,
        strokeWeight: styleConfig.weight,
        map: mapsRef.current,
        title: `${segment.classification.toUpperCase()}: ${segment.notes || 'Unclassified'}`,
        clickable: true,
        segment: segment // Store segment data for access on click
      })

      // Handle click to open classifier
      polyline.addListener('click', () => {
        setSelectedSegment(segment)
        setShowSegmentClassifier(true)
      })

      segmentPolylinesRef.current.push(polyline)
    })
  }

  // Render segments whenever they change
  useEffect(() => {
    renderSegments()
  }, [segments])

  useEffect(() => {
    if (!mapsRef.current || selectedRoute === null || !routes[selectedRoute]) {
      stepPolylinesRef.current.forEach(p => p.setMap(null))
      stepPolylinesRef.current = []
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

      renderRouteSteps(routes[selectedRoute])
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

        // Check for Pontiac roads and determine restrictions
        let maxTonnage = MAX_CLASS_A_TONNAGE
        let hasPontiacRoads = false
        let restrictivePontiacRoad = null

        leg.steps.forEach(step => {
          const pontiacRoad = checkPontiacRoad(step.instructions)
          if (pontiacRoad) {
            hasPontiacRoads = true
            const classification = PONTIAC_CLASSIFICATIONS[pontiacRoad.classification]
            // Use the most restrictive Pontiac road limit
            if (!restrictivePontiacRoad || classification.maxTonnage < maxTonnage) {
              restrictivePontiacRoad = { ...pontiacRoad, classification }
              maxTonnage = classification.maxTonnage
            }
          }
        })

        // Determine tonnage warnings
        const warnings = []

        if (restrictivePontiacRoad) {
          warnings.push({
            level: 'info',
            message: `⚠️ Route uses Pontiac road: ${restrictivePontiacRoad.name} (${restrictivePontiacRoad.classification.name}, max ${maxTonnage}T)`
          })
        } else if (routeClass === 'unknown') {
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

          <PontiacRoadManager
            roads={pontiacRoads}
            onAddRoad={addPontiacRoad}
            onDeleteRoad={deletePontiacRoad}
          />

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
