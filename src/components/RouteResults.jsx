import React from 'react'
import './RouteResults.css'

function RouteResults({ routes, selectedRouteId, onSelectRoute, transitions = [] }) {
  if (!routes || routes.length === 0) {
    return null
  }

  const selectedRoute = routes.find(r => r.id === selectedRouteId)

  return (
    <div className="route-results">
      <div className="results-header">
        <h3>📍 Route Options</h3>
        <span className="route-count">{routes.length} routes found</span>
      </div>

      <div className="routes-list">
        {routes.map((route, index) => (
          <div
            key={route.id}
            className={`route-card ${selectedRouteId === route.id ? 'selected' : ''} ${index === 0 ? 'recommended' : ''}`}
            onClick={() => onSelectRoute(route.id)}
          >
            <div className="route-header">
              <div className="route-rank">
                {index === 0 && <span className="badge recommended-badge">⭐ Recommended</span>}
                <span className="route-number">Route {route.id + 1}</span>
              </div>
              <div className="route-class">
                <span className={`class-badge class-${route.routeClass}`}>
                  {route.routeClass === 'unknown' ? '❓ Unknown' : `Class ${route.routeClass.toUpperCase()}`}
                </span>
              </div>
            </div>

            <div className="route-summary">{route.summary}</div>

            <div className="route-metrics">
              <div className="metric">
                <span className="metric-label">Distance</span>
                <span className="metric-value">{route.distance.toFixed(1)} mi</span>
              </div>
              <div className="metric">
                <span className="metric-label">Duration</span>
                <span className="metric-value">{route.durationMinutes} min</span>
              </div>
              <div className="metric">
                <span className="metric-label">Truck Cost</span>
                <span className="metric-value">${route.truckCost.toFixed(0)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Cost/Ton</span>
                <span className="metric-value">${route.costPerTon.toFixed(2)}</span>
              </div>
            </div>

            <div className="efficiency-meter">
              <div className="meter-label">
                <span>Efficiency</span>
                <span className="meter-value">{(route.tonMilesPerHour).toFixed(1)} ton-mi/hr</span>
              </div>
              <div className="meter-bar">
                <div
                  className="meter-fill"
                  style={{ width: `${Math.min(100, (route.efficiency / Math.max(...routes.map(r => r.efficiency))) * 100)}%` }}
                ></div>
              </div>
            </div>

            {route.warnings.length > 0 && (
              <div className="warnings">
                {route.warnings.map((warning, idx) => (
                  <div key={idx} className={`warning warning-${warning.level}`}>
                    <span className="warning-icon">
                      {warning.level === 'error' && '🚫'}
                      {warning.level === 'warning' && '⚠️'}
                      {warning.level === 'info' && 'ℹ️'}
                    </span>
                    <span className="warning-text">{warning.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedRoute && (
        <div className="route-details">
          <h4>Selected Route Details</h4>
          <div className="details-grid">
            <div className="detail">
              <span className="detail-label">Total Distance:</span>
              <span className="detail-value">{selectedRoute.distance.toFixed(1)} miles</span>
            </div>
            <div className="detail">
              <span className="detail-label">Estimated Time:</span>
              <span className="detail-value">{Math.floor(selectedRoute.durationHours)}h {Math.round((selectedRoute.durationHours % 1) * 60)}m</span>
            </div>
            <div className="detail">
              <span className="detail-label">Truck Cost:</span>
              <span className="detail-value">${selectedRoute.truckCost.toFixed(2)}</span>
            </div>
            <div className="detail">
              <span className="detail-label">Route Class:</span>
              <span className="detail-value">
                {selectedRoute.routeClass === 'unknown' ? '❓ Unknown' : `Class ${selectedRoute.routeClass.toUpperCase()}`}
              </span>
            </div>
          </div>

          {transitions.length > 0 && (
            <div className="transitions-list">
              <h5>🔄 Road Class Transitions</h5>
              <div className="transitions">
                {transitions.map((t, idx) => (
                  <div key={idx} className="transition-item">
                    <span className={`class-indicator class-${t.from}`}>A</span>
                    <span className="transition-arrow">→</span>
                    <span className={`class-indicator class-${t.to}`}>{t.to.toUpperCase()}</span>
                    <span className="transition-instruction">{t.instruction?.replace(/<[^>]*>/g, '') || 'Turn'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RouteResults
