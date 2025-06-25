import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pkg from "pg";

// Load environment variables
dotenv.config();

const { Pool } = pkg;

// Log the DATABASE_URL to verify it's loaded (remove in production)
console.log('Database URL configured:', process.env.DATABASE_URL ? 'Yes' : 'No');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

const app = express();
const PORT = process.env.PORT || 8080; // Updated port for Railway

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check endpoint
app.get("/api/ping", async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ ok: true, time: new Date().toISOString() });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// History endpoint
app.get("/api/history", async (req, res) => {
  try {
    const { email } = req.query;
    console.log('Received request for email:', email);

    if (!email || typeof email !== 'string') {
      console.log('Email is missing or invalid');
      return res.status(400).json({ error: 'Email is required' });
    }

    // Debug: log the exact email string
    console.log('Querying for email:', `>${email}<`);

    console.log('Checking database connection...');
    try {
      await pool.query('SELECT 1');
      console.log('Database connection is working');
    } catch (err) {
      console.error('Database connection test failed:', err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    console.log('Executing query with email:', email);
    try {
      // Query the aiOutput table
      const result = await pool.query(
        'SELECT id, "formData", "aiResponse", "templateSlug", "createdBy", "createdAt" FROM "aiOutput" WHERE "createdBy" = $1 ORDER BY "createdAt" DESC',
        [email]
      );
      // Debug: log the result
      console.log('Query result:', result.rows);
      return res.json(result.rows);
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
    return;
  }
});

// Get user history
app.get("/api/history/:userId", async (req, res) => {
  try {
    console.log('Fetching history for user:', req.params.userId);
    const { userId } = req.params;
    
    const query = `
      SELECT * FROM user_history 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [userId]);
    console.log(`Found ${result.rows.length} history items`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error in /api/history/:userId:', error);
    res.status(500).json({ 
      error: 'Failed to fetch history',
      details: error.message 
    });
  }
});

// Create history entry
app.post("/api/history", async (req, res) => {
  try {
    console.log('Creating history entry:', req.body);
    const { userId, query, response } = req.body;
    
    const sqlQuery = `
      INSERT INTO user_history (user_id, query, response)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(sqlQuery, [userId, query, response]);
    console.log('History entry created:', result.rows[0]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error in POST /api/history:', error);
    res.status(500).json({ 
      error: 'Failed to create history entry',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
