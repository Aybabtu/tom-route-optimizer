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
  const [waypoints, setWaypoints] = useState([]) // Intermediate waypoints for draggable routing
  const [routeStart, setRouteStart] = useState(null)
  const [routeEnd, setRouteEnd] = useState(null)
  const mapsRef = useRef(null)
  const directionsServiceRef = useRef(null)
  const directionsRendererRef = useRef(null)
  const markersRef = useRef([])
  const waypointMarkersRef = useRef([])
  const segmentPolylinesRef = useRef([])
  const stepPolylinesRef = useRef([])
  const segmentsRef = useRef([])
  const routesRef = useRef([])
  const selectedRouteRef = useRef(null)
  const tomRoadNamesRef = useRef(new Set())
  const restrictedRoadNamesRef = useRef(new Set())
  const shiftKeyPressedRef = useRef(false)

  // Keep refs in sync so callbacks always have fresh data
  useEffect(() => { segmentsRef.current = segments }, [segments])
  useEffect(() => { routesRef.current = routes }, [routes])
  useEffect(() => { selectedRouteRef.current = selectedRoute }, [selectedRoute])
  useEffect(() => { restrictedRoadNamesRef.current = buildRestrictedNamesSet(segments) }, [segments])

  useEffect(() => {
    loadSegments()
    loadTomRoadNames()

    // Track shift key for Shift+click on routes
    const handleKeyDown = (e) => {
      if (e.key === 'Shift') shiftKeyPressedRef.current = true
    }
    const handleKeyUp = (e) => {
      if (e.key === 'Shift') shiftKeyPressedRef.current = false
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Extract road name from a Google Maps step instruction
  const extractRoadName = (instructions) => {
    if (!instructions) return ''
    const text = instructions.replace(/<[^>]*>/g, '').trim()
    const m = text.match(/\bonto\s+(.+)/i) || text.match(/\bon\s+(.+)/i)
    return m ? m[1].trim().toLowerCase() : text.toLowerCase()
  }

  const buildRestrictedNamesSet = (segs) => {
    const restricted = new Set()
    segs.forEach(seg => {
      if (seg.classification === 'restricted' && seg.road_name) {
        restricted.add(seg.road_name.toLowerCase())
      }
    })
    console.log('Restricted roads built from segments:', Array.from(restricted), '(from', segs.length, 'segments)')
    return restricted
  }

  const loadTomRoadNames = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/tom/road-names`)
      if (!response.ok) return
      const names = await response.json()
      tomRoadNamesRef.current = new Set(names.map(n => n.toLowerCase()))
      console.log(`Loaded ${tomRoadNamesRef.current.size} Class A road names from TOM data`)
    } catch (e) {
      console.error('Error loading TOM road names:', e)
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
      return data
    } catch (error) {
      console.error('Error loading segments:', error)
      return []
    }
  }

  const checkAndRerouteIfRestricted = () => {
    console.log('checkAndRerouteIfRestricted called')
    const currentRoutes = routesRef.current
    const currentSelectedId = selectedRouteRef.current
    if (!currentRoutes.length || currentSelectedId === null) {
      console.log('No routes or selected route, returning')
      return
    }

    const routeHasRestricted = (route) =>
      route.directionsResult.routes[0].legs[0].steps.some(
        step => classifyStep(step) === 'restricted'
      )

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
    // Update restricted names ref immediately (state update is async)
    if (freshSegments) {
      restrictedRoadNamesRef.current = buildRestrictedNamesSet(freshSegments)
    }
    checkAndRerouteIfRestricted()
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

  const handleStepClick = (step, event) => {
    const startLat = step.start_location.lat()
    const startLng = step.start_location.lng()
    const endLat = step.end_location.lat()
    const endLng = step.end_location.lng()
    const roadName = extractRoadName(step.instructions)
    console.log('handleStepClick:', { shiftPressed: shiftKeyPressedRef.current, roadName })

    // Shift+click adds a waypoint; regular click classifies the segment
    if (shiftKeyPressedRef.current) {
      // Add waypoint at midpoint of this step (as LatLng object)
      if (!window.google) return
      const midLat = (startLat + endLat) / 2
      const midLng = (startLng + endLng) / 2
      const newWaypoint = new window.google.maps.LatLng(midLat, midLng)
      console.log('Adding waypoint at:', { midLat, midLng })
      setWaypoints([...waypoints, newWaypoint])
      return
    }

    const existing = findNearbySegment(startLat, startLng, endLat, endLng)
    if (existing) {
      // Merge existing segment data with current road name from step
      console.log('Editing existing segment, road_name being set to:', roadName)
      setSelectedSegment({
        ...existing,
        road_name: roadName  // Capture current road name for matching
      })
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

      const classified = classifyStep(step)
      const color = existing
        ? (STEP_COLORS[existing.classification] || '#999')
        : classified === 'A' ? STEP_COLORS['class-a']
        : classified === 'restricted' ? STEP_COLORS['restricted']
        : STEP_COLORS['unclassified']

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
      polyline.addListener('click', (event) => handleStepClick(step, event))

      stepPolylinesRef.current.push(polyline)
    })
  }

  const initializeDirectionsService = () => {
    if (window.google && !directionsServiceRef.current) {
      directionsServiceRef.current = new window.google.maps.DirectionsService()
    }
  }

  // Store tonnage and origin/dest for recalculation when dragging
  // These are locked in at the start of a new search and NEVER updated by route calculations
  const recalcInfoRef = useRef({ tonnage: 0, origin: null, destination: null })
  const isRecalculatingRef = useRef(false) // Track if routes came from waypoint recalc (not new search)

  const renderWaypointMarkers = () => {
    if (!mapsRef.current || !window.google || !routeStart || !routeEnd) {
      return
    }

    // Clear old waypoint markers
    waypointMarkersRef.current.forEach(marker => marker.setMap(null))
    waypointMarkersRef.current = []

    // Start marker (GREEN)
    const startMarker = new window.google.maps.Marker({
      position: routeStart,
      map: mapsRef.current,
      title: 'START (drag to move)',
      draggable: true,
      zIndex: 1000,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#4caf50',
        fillOpacity: 0.9,
        strokeColor: '#fff',
        strokeWeight: 2,
      }
    })
    startMarker.addListener('dragend', (e) => {
      console.log('Start marker dragged to', e.latLng)
      setRouteStart(e.latLng)
    })
    waypointMarkersRef.current.push(startMarker)

    // End marker (RED)
    const endMarker = new window.google.maps.Marker({
      position: routeEnd,
      map: mapsRef.current,
      title: 'END (drag to move)',
      draggable: true,
      zIndex: 1000,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#f44336',
        fillOpacity: 0.9,
        strokeColor: '#fff',
        strokeWeight: 2,
      }
    })
    endMarker.addListener('dragend', (e) => {
      console.log('End marker dragged to', e.latLng)
      setRouteEnd(e.latLng)
    })
    waypointMarkersRef.current.push(endMarker)

    // Waypoint markers (YELLOW - Shift+click on route to add, click to delete)
    waypoints.forEach((wp, idx) => {
      const wpMarker = new window.google.maps.Marker({
        position: wp,
        map: mapsRef.current,
        title: `Waypoint ${idx + 1} (drag to move, click to delete)`,
        draggable: true,
        zIndex: 999,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#ffeb3b',
          fillOpacity: 0.9,
          strokeColor: '#333',
          strokeWeight: 2,
        }
      })
      wpMarker.addListener('dragend', (e) => {
        console.log('Waypoint', idx, 'dragged to', e.latLng)
        const newWaypoints = [...waypoints]
        newWaypoints[idx] = e.latLng
        setWaypoints(newWaypoints)
      })
      wpMarker.addListener('click', () => {
        console.log('Deleting waypoint', idx)
        setWaypoints(waypoints.filter((_, i) => i !== idx))
      })
      waypointMarkersRef.current.push(wpMarker)
    })

    console.log('Waypoint markers rendered:', { start: startMarker ? 'yes' : 'no', end: endMarker ? 'yes' : 'no', waypoints: waypoints.length })
  }

  // Render markers whenever waypoints or endpoints change
  useEffect(() => {
    renderWaypointMarkers()
  }, [waypoints, routeStart, routeEnd])


  // Track if start/end drag is from user (not route update)
  const prevStartRef = useRef(null)
  const prevEndRef = useRef(null)

  // Recalculate route when user drags waypoints (but skip initial render)
  const prevWaypointsRef = useRef(null)
  useEffect(() => {
    if (!prevWaypointsRef.current) {
      prevWaypointsRef.current = waypoints
      return
    }

    // Only recalculate if waypoints actually changed AND we have recalc info
    if (waypoints.length > 0 && recalcInfoRef.current.tonnage > 0) {
      console.log('Waypoints changed, recalculating with waypoints:', waypoints.length)
      recalculateWithWaypoints(waypoints)
    }
    prevWaypointsRef.current = waypoints
  }, [waypoints])

  // Recalculate when start/end markers are dragged (skip initial setting from route)
  useEffect(() => {
    if (!prevStartRef.current || !prevEndRef.current) {
      prevStartRef.current = routeStart
      prevEndRef.current = routeEnd
      return
    }

    // Check if position actually changed (not just reference)
    const startChanged = routeStart && prevStartRef.current &&
      (routeStart.lat() !== prevStartRef.current.lat() || routeStart.lng() !== prevStartRef.current.lng())
    const endChanged = routeEnd && prevEndRef.current &&
      (routeEnd.lat() !== prevEndRef.current.lat() || routeEnd.lng() !== prevEndRef.current.lng())

    if ((startChanged || endChanged) && recalcInfoRef.current.tonnage > 0) {
      console.log('Start/end markers dragged, recalculating with waypoints:', waypoints.length)
      recalculateWithWaypoints(waypoints)
    }

    prevStartRef.current = routeStart
    prevEndRef.current = routeEnd
  }, [routeStart, routeEnd, waypoints])

  const recalculateWithWaypoints = async (waypointsToUse) => {
    if (!directionsServiceRef.current) return

    const { origin, destination, tonnage } = recalcInfoRef.current
    if (!origin || !destination) {
      console.error('Missing origin or destination in recalcInfoRef:', recalcInfoRef.current)
      return
    }

    console.log('Recalculating with:', {
      origin: origin?.toJSON?.() || origin,
      destination: destination?.toJSON?.() || destination,
      waypointCount: waypointsToUse.length,
      tonnage
    })

    setLoading(true)
    try {
      const result = await new Promise((resolve, reject) => {
        directionsServiceRef.current.route(
          {
            origin: origin,
            destination: destination,
            waypoints: waypointsToUse.map((wp, idx) => {
              console.log(`Waypoint ${idx}:`, wp?.toJSON?.() || wp)
              return {
                location: wp,
                stopover: true
              }
            }),
            travelMode: 'DRIVING',
            provideRouteAlternatives: true,
          },
          (result, status) => {
            if (status === 'OK') {
              resolve(result)
            } else {
              reject(new Error(`Recalculation failed: ${status}`))
            }
          }
        )
      })

      // Reprocess routes (same logic as handleRouteSearch)
      const processedRoutes = result.routes.map((route, index) => {
        const leg = route.legs[0]
        const durationSeconds = leg.duration.value
        const durationHours = durationSeconds / 3600
        const distance = leg.distance.value / 1609.34

        const stepClasses = leg.steps?.map(s => classifyStep(s)) || []
        const hasUnknown = stepClasses.includes('unknown')
        const hasNonA = stepClasses.some(c => c !== 'A')
        const routeClass = hasUnknown ? 'unknown' : (hasNonA ? 'B' : 'A')

        const truckCost = durationHours * TRUCK_RATE_PER_HOUR
        const costPerTon = truckCost / tonnage
        const tonMilesPerHour = (tonnage * distance) / durationHours

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
          efficiency: tonMilesPerHour / costPerTon,
          routeClass: routeClass,
          warnings: [],
          summary: route.summary || `Route ${index + 1}`,
          tonnage: tonnage
        }
      })

      processedRoutes.sort((a, b) => b.efficiency - a.efficiency)
      isRecalculatingRef.current = true // Flag that this is a recalculation, not a new search
      setRoutes(processedRoutes)
      if (processedRoutes.length > 0) {
        setSelectedRoute(processedRoutes[0].id)
      }
      console.log('Recalculated with waypoints:', processedRoutes.length, 'routes')
    } catch (err) {
      console.error('Error recalculating:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const classifyStep = (step) => {
    const instruction = (step.instructions || '').replace(/<[^>]*>/g, '').toLowerCase()
    const roadName = extractRoadName(step.instructions)

    // Restricted road names take highest priority
    for (const name of restrictedRoadNamesRef.current) {
      if (roadName === name || roadName.includes(name) || name.includes(roadName)) {
        console.log('RESTRICTED MATCH:', { roadName, restrictedName: name, instruction })
        return 'restricted'
      }
    }

    // Log road names we're checking against restrictions (for debugging)
    if (restrictedRoadNamesRef.current.size > 0) {
      console.log('Checked step:', { roadName, restrictedCount: restrictedRoadNamesRef.current.size, instruction })
    }

    // Interstates, US routes, Michigan state routes are always Class A
    if (instruction.includes('i-') || instruction.includes('interstate') ||
        instruction.includes('us-') || instruction.includes('us route') ||
        instruction.includes('m-') || /\bm\s+\d+/.test(instruction)) return 'A'

    // Check against TOM-imported Class A road names
    for (const name of tomRoadNamesRef.current) {
      if (instruction.includes(name)) return 'A'
    }

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
    console.log('Route rendering useEffect triggered:', { selectedRoute, routesCount: routes.length })
    const activeRoute = routes.find(r => r.id === selectedRoute)
    console.log('Active route found:', activeRoute ? 'yes' : 'no')

    if (!mapsRef.current || !activeRoute) {
      console.log('Missing map or active route, clearing polylines')
      stepPolylinesRef.current.forEach(p => p.setMap(null))
      stepPolylinesRef.current = []
      return
    }

    console.log('Proceeding to render route')

    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
    }
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current = []

    if (window.google) {
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        map: mapsRef.current,
        suppressPolylines: true,
        suppressMarkers: true,
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

      // Set draggable start/end points ONLY on new searches, not recalculations
      // (recalculations should keep the user's dragged positions)
      if (!isRecalculatingRef.current) {
        const leg = activeRoute.directionsResult.routes[0].legs[0]
        console.log('Setting route start/end from calculated route:', {
          start: leg.start_location?.toJSON?.(),
          end: leg.end_location?.toJSON?.()
        })
        setRouteStart(leg.start_location)
        setRouteEnd(leg.end_location)
        setWaypoints([])
      } else {
        console.log('Skipping route start/end reset (recalculation in progress)')
      }
      isRecalculatingRef.current = false // Reset flag
    }
  }, [selectedRoute, routes])

  const handleRouteSearch = async (origin, destination, tonnage) => {
    if (!directionsServiceRef.current) {
      setError('Google Maps not loaded yet')
      return
    }

    isRecalculatingRef.current = false // This is a new search, not a recalculation
    setLoading(true)
    setError(null)
    setRoutes([])
    setSelectedRoute(null)
    setWaypoints([]) // Clear waypoints for new search
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
          summary: route.summary || `Route ${index + 1}`,
          tonnage: tonnage // Store tonnage for drag route recalculation
        }
      })

      // Sort by efficiency
      processedRoutes.sort((a, b) => b.efficiency - a.efficiency)

      // Lock in the origin/destination for this search (used for all subsequent recalculations)
      if (processedRoutes.length > 0) {
        const leg = processedRoutes[0].directionsResult.routes[0].legs[0]
        recalcInfoRef.current = {
          tonnage: tonnage,
          origin: leg.start_location,
          destination: leg.end_location
        }
        console.log('Locked in recalc info for new search:', recalcInfoRef.current)
      }

      setRoutes(processedRoutes)

      if (processedRoutes.length > 0) {
        // Prefer a route with no restricted steps
        const routeHasRestricted = (r) =>
          r.directionsResult.routes[0].legs[0].steps.some(
            step => classifyStep(step) === 'restricted'
          )
        const best = processedRoutes.find(r => !routeHasRestricted(r)) || processedRoutes[0]
        setSelectedRoute(best.id)
        if (routeHasRestricted(processedRoutes[0]) && best.id !== processedRoutes[0].id) {
          setRerouteMessage(`Selected alternate route to avoid restricted roads — using ${best.summary}`)
        }
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

          {routes.length > 0 && (
            <div className="drag-route-info">
              <strong>📍 Drag Routes:</strong>
              <ul style={{ margin: '8px 0', fontSize: '12px', paddingLeft: '16px' }}>
                <li><strong>Green circle:</strong> Drag start point</li>
                <li><strong>Orange circle:</strong> Drag waypoints or click to remove</li>
                <li><strong>Red circle:</strong> Drag end point</li>
                <li><strong>Shift+Click:</strong> Add waypoint to a segment</li>
                <li><strong>Regular Click:</strong> Classify segment</li>
              </ul>
            </div>
          )}

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
              road_name: selectedSegment.road_name || null,
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
