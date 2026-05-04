import React, { useState } from 'react'
import { roadsApi } from '../utils/api'
import './PontiacRoadManager.css'

const PONTIAC_CLASSIFICATIONS = {
  'class-a-pink': { label: 'Class A (Pink)', maxTonnage: 80 },
  'class-a-mdot': { label: 'MDOT Class A (Lime Green)', maxTonnage: 80 },
  'class-b': { label: 'Class B (Blue)', maxTonnage: 50 },
  'restricted-3tn': { label: 'City Restricted - 3 TN (Orange)', maxTonnage: 3 },
  'restricted-6tn': { label: 'City Restricted - 6 TN per axle (Dark Green)', maxTonnage: 6 },
  'restricted-grey': { label: 'City Weight Restricted (Grey)', maxTonnage: 10 },
  'oakland-county': { label: 'Oakland County Jurisdiction (Burnt Orange)', maxTonnage: 80 }
}

function PontiacRoadManager({ roads, onAddRoad, onDeleteRoad }) {
  const [showForm, setShowForm] = useState(false)
  const [roadName, setRoadName] = useState('')
  const [classification, setClassification] = useState('class-a-pink')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (roadName.trim()) {
      try {
        // Map classification to road_type for API
        const road = {
          name: roadName.trim(),
          road_type: classification,
          max_tonnage: PONTIAC_CLASSIFICATIONS[classification].maxTonnage,
          jurisdiction: 'Pontiac'
        }
        await roadsApi.add(road)
        onAddRoad(road)
        setRoadName('')
        setClassification('class-a-pink')
        setShowForm(false)
      } catch (error) {
        alert('Error adding road: ' + error.message)
      }
    }
  }

  return (
    <div className="pontiac-manager">
      <div className="manager-header">
        <h3>📍 Pontiac Roads</h3>
        <button
          className="toggle-button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕' : '+ Add Road'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="road-form">
          <div className="form-group">
            <label>Road Name</label>
            <input
              type="text"
              placeholder="e.g., Main St, Martin Luther King Blvd"
              value={roadName}
              onChange={(e) => setRoadName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Classification</label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
            >
              {Object.entries(PONTIAC_CLASSIFICATIONS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="submit-button">
            Add Road
          </button>
        </form>
      )}

      {roads.length > 0 && (
        <div className="roads-list">
          {roads.map((road, idx) => (
            <div key={idx} className="road-item">
              <div className="road-info">
                <span className="road-name">{road.name}</span>
                <span className="road-classification">
                  {PONTIAC_CLASSIFICATIONS[road.classification]?.label}
                </span>
                <span className="road-tonnage">
                  Max: {PONTIAC_CLASSIFICATIONS[road.classification]?.maxTonnage}T
                </span>
              </div>
              <button
                className="delete-button"
                onClick={() => onDeleteRoad(idx)}
                title="Delete road"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {roads.length === 0 && !showForm && (
        <p className="empty-message">No Pontiac roads added yet</p>
      )}
    </div>
  )
}

export default PontiacRoadManager
