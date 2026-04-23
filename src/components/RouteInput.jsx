import React, { useState } from 'react'
import './RouteInput.css'

function RouteInput({ onSearch, loading }) {
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [tonnage, setTonnage] = useState('45')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (origin && destination && tonnage) {
      onSearch(origin, destination, parseFloat(tonnage))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="route-input">
      <div className="form-group">
        <label htmlFor="origin">Origin</label>
        <input
          id="origin"
          type="text"
          placeholder="Enter starting address..."
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="destination">Destination</label>
        <input
          id="destination"
          type="text"
          placeholder="Enter destination address..."
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="tonnage">Load Weight (tons)</label>
        <input
          id="tonnage"
          type="number"
          min="1"
          max="150"
          step="0.5"
          value={tonnage}
          onChange={(e) => setTonnage(e.target.value)}
          disabled={loading}
        />
      </div>

      <button
        type="submit"
        disabled={loading || !origin || !destination || !tonnage}
        className="search-button"
      >
        {loading ? 'Calculating...' : 'Calculate Routes'}
      </button>
    </form>
  )
}

export default RouteInput
