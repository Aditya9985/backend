import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const app = express();
const PORT = process.env.PORT || 4000;

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
    const result = await pool.query("SELECT NOW() as now");
    res.json({ ok: true, now: result.rows[0].now });
  } catch (err) {
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
    const { userId } = req.params;
    const query = `
      SELECT * FROM user_history 
      WHERE user_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create history entry
app.post("/api/history", async (req, res) => {
  try {
    const { userId, query, response } = req.body;
    const sqlQuery = `
      INSERT INTO user_history (user_id, query, response)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const result = await pool.query(sqlQuery, [userId, query, response]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating history entry:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
