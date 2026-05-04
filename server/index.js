import express from 'express'
import mysql from 'mysql2/promise'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// Initialize database tables
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection()

    // Create roads table if it doesn't exist
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS roads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        road_type VARCHAR(50),
        max_tonnage INT,
        jurisdiction VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX(name),
        INDEX(jurisdiction)
      )
    `)

    // Create michigan_roads table for state road data
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS michigan_roads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        road_name VARCHAR(255),
        road_type VARCHAR(50),
        county VARCHAR(100),
        geometry JSON,
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(road_name),
        INDEX(county)
      )
    `)

    connection.release()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Error initializing database:', error)
    process.exit(1)
  }
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// Get all roads
app.get('/api/roads', async (req, res) => {
  try {
    const connection = await pool.getConnection()
    const [rows] = await connection.execute('SELECT * FROM roads ORDER BY name')
    connection.release()
    res.json(rows)
  } catch (error) {
    console.error('Error fetching roads:', error)
    res.status(500).json({ error: 'Failed to fetch roads' })
  }
})

// Add a road
app.post('/api/roads', async (req, res) => {
  const { name, road_type, max_tonnage, jurisdiction, notes } = req.body

  if (!name || !road_type || max_tonnage === undefined) {
    return res.status(400).json({ error: 'Missing required fields: name, road_type, max_tonnage' })
  }

  try {
    const connection = await pool.getConnection()
    const [result] = await connection.execute(
      'INSERT INTO roads (name, road_type, max_tonnage, jurisdiction, notes) VALUES (?, ?, ?, ?, ?)',
      [name, road_type, max_tonnage, jurisdiction || null, notes || null]
    )
    connection.release()
    res.status(201).json({ id: result.insertId, message: 'Road added successfully' })
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Road already exists' })
    }
    console.error('Error adding road:', error)
    res.status(500).json({ error: 'Failed to add road' })
  }
})

// Update a road
app.put('/api/roads/:id', async (req, res) => {
  const { id } = req.params
  const { name, road_type, max_tonnage, jurisdiction, notes } = req.body

  try {
    const connection = await pool.getConnection()
    const [result] = await connection.execute(
      'UPDATE roads SET name = ?, road_type = ?, max_tonnage = ?, jurisdiction = ?, notes = ? WHERE id = ?',
      [name, road_type, max_tonnage, jurisdiction || null, notes || null, id]
    )
    connection.release()

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Road not found' })
    }

    res.json({ message: 'Road updated successfully' })
  } catch (error) {
    console.error('Error updating road:', error)
    res.status(500).json({ error: 'Failed to update road' })
  }
})

// Delete a road
app.delete('/api/roads/:id', async (req, res) => {
  const { id } = req.params

  try {
    const connection = await pool.getConnection()
    const [result] = await connection.execute('DELETE FROM roads WHERE id = ?', [id])
    connection.release()

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Road not found' })
    }

    res.json({ message: 'Road deleted successfully' })
  } catch (error) {
    console.error('Error deleting road:', error)
    res.status(500).json({ error: 'Failed to delete road' })
  }
})

// Search roads by name
app.get('/api/roads/search/:query', async (req, res) => {
  const { query } = req.params

  try {
    const connection = await pool.getConnection()
    const [rows] = await connection.execute(
      'SELECT * FROM roads WHERE name LIKE ? OR jurisdiction LIKE ?',
      [`%${query}%`, `%${query}%`]
    )
    connection.release()
    res.json(rows)
  } catch (error) {
    console.error('Error searching roads:', error)
    res.status(500).json({ error: 'Failed to search roads' })
  }
})

// Get roads by jurisdiction
app.get('/api/roads/jurisdiction/:jurisdiction', async (req, res) => {
  const { jurisdiction } = req.params

  try {
    const connection = await pool.getConnection()
    const [rows] = await connection.execute(
      'SELECT * FROM roads WHERE jurisdiction = ?',
      [jurisdiction]
    )
    connection.release()
    res.json(rows)
  } catch (error) {
    console.error('Error fetching roads by jurisdiction:', error)
    res.status(500).json({ error: 'Failed to fetch roads' })
  }
})

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const connection = await pool.getConnection()

    const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM roads')
    const [jurisdictionResult] = await connection.execute(
      'SELECT DISTINCT jurisdiction FROM roads WHERE jurisdiction IS NOT NULL'
    )

    connection.release()

    res.json({
      total_roads: countResult[0].total,
      jurisdictions: jurisdictionResult.map(r => r.jurisdiction)
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`TOM Route Optimizer Server running on port ${PORT}`)
  initializeDatabase()
})
