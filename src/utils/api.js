// API utility for backend communication

// Use environment variable if set, otherwise use local proxy
// For PHP API, the base path is different than Node.js
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : '/api'

console.log('API Base URL:', API_BASE)

export const roadsApi = {
  // Get all roads
  getAll: async () => {
    try {
      const response = await fetch(`${API_BASE}/roads`)
      if (!response.ok) throw new Error('Failed to fetch roads')
      return await response.json()
    } catch (error) {
      console.error('Error fetching roads:', error)
      return []
    }
  },

  // Add a new road
  add: async (road) => {
    try {
      const response = await fetch(`${API_BASE}/roads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(road)
      })
      if (!response.ok) throw new Error('Failed to add road')
      return await response.json()
    } catch (error) {
      console.error('Error adding road:', error)
      throw error
    }
  },

  // Update a road
  update: async (id, road) => {
    try {
      const response = await fetch(`${API_BASE}/roads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(road)
      })
      if (!response.ok) throw new Error('Failed to update road')
      return await response.json()
    } catch (error) {
      console.error('Error updating road:', error)
      throw error
    }
  },

  // Delete a road
  delete: async (id) => {
    try {
      const response = await fetch(`${API_BASE}/roads/${id}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete road')
      return await response.json()
    } catch (error) {
      console.error('Error deleting road:', error)
      throw error
    }
  },

  // Search roads
  search: async (query) => {
    try {
      const response = await fetch(`${API_BASE}/roads/search/${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error('Failed to search roads')
      return await response.json()
    } catch (error) {
      console.error('Error searching roads:', error)
      return []
    }
  },

  // Get roads by jurisdiction
  getByJurisdiction: async (jurisdiction) => {
    try {
      const response = await fetch(`${API_BASE}/roads/jurisdiction/${encodeURIComponent(jurisdiction)}`)
      if (!response.ok) throw new Error('Failed to fetch roads')
      return await response.json()
    } catch (error) {
      console.error('Error fetching roads by jurisdiction:', error)
      return []
    }
  },

  // Get statistics
  getStats: async () => {
    try {
      const response = await fetch(`${API_BASE}/stats`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      return await response.json()
    } catch (error) {
      console.error('Error fetching stats:', error)
      return { total_roads: 0, jurisdictions: [] }
    }
  }
}
