import React, { useState } from 'react'
import { roadsApi } from '../utils/api'
import './SegmentClassifier.css'

const SEGMENT_CLASSIFICATIONS = {
  'class-a': { label: 'Class A', color: '#4caf50', maxTonnage: 60 },
  'class-b': { label: 'Class B', color: '#ff9800', maxTonnage: 50 },
  'restricted': { label: 'Restricted', color: '#f44336', maxTonnage: 0 }
}

function SegmentClassifier({ segment, onClose, onSegmentAdded }) {
  const [classification, setClassification] = useState(segment?.classification || 'class-a')
  const [notes, setNotes] = useState(segment?.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (!segment) return null

  const isEditing = !!segment.id

  const handleRemove = async () => {
    if (!segment.id) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || '/api'}/segments/${segment.id}`,
        { method: 'DELETE' }
      )
      if (!response.ok) throw new Error('Failed to remove classification')
      onSegmentAdded(null)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const segmentApi = {
        start_lat: segment.start.lat,
        start_lng: segment.start.lng,
        end_lat: segment.end.lat,
        end_lng: segment.end.lng,
        classification: classification,
        jurisdiction: segment.jurisdiction || 'Oakland County',
        road_name: segment.road_name || null,
        notes: notes || null
      }

      let response

      // If segment has an ID, update it; otherwise create new
      if (segment.id) {
        response = await fetch(
          `${import.meta.env.VITE_API_URL || '/api'}/segments/${segment.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(segmentApi)
          }
        )
      } else {
        response = await fetch(
          `${import.meta.env.VITE_API_URL || '/api'}/segments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(segmentApi)
          }
        )
      }

      if (!response.ok) throw new Error('Failed to save segment')

      const result = await response.json()
      onSegmentAdded({ ...segmentApi, id: segment.id || result.id })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="segment-classifier-overlay">
      <div className="segment-classifier-modal">
        <div className="modal-header">
          <h3>{isEditing ? 'Edit Classification' : 'Classify Route Segment'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="segment-info">
          {segment.road_name && (
            <p className="road-name"><strong>Road:</strong> {segment.road_name}</p>
          )}
          <p className="segment-coords">
            <strong>Start:</strong> {parseFloat(segment.start.lat).toFixed(5)}, {parseFloat(segment.start.lng).toFixed(5)}<br/>
            <strong>End:</strong> {parseFloat(segment.end.lat).toFixed(5)}, {parseFloat(segment.end.lng).toFixed(5)}
            {segment.id && <><br/><strong>DB ID:</strong> {segment.id}</>}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Classification</label>
            <div className="classification-options">
              {Object.entries(SEGMENT_CLASSIFICATIONS).map(([key, value]) => (
                <label key={key} className="radio-option">
                  <input
                    type="radio"
                    name="classification"
                    value={key}
                    checked={classification === key}
                    onChange={(e) => setClassification(e.target.value)}
                  />
                  <span
                    className="color-indicator"
                    style={{ backgroundColor: value.color }}
                  ></span>
                  <span className="label-text">
                    {value.label} ({value.maxTonnage}T max)
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this segment..."
              rows="3"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            {isEditing && (
              <button type="button" className="remove-btn" onClick={handleRemove} disabled={loading}>
                {loading ? '...' : 'Remove'}
              </button>
            )}
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SegmentClassifier
