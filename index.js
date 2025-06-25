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
const PORT = process.env.PORT || 8080;

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

// Get user history by email
app.get("/api/history/:email", async (req, res) => {
  try {
    console.log('Fetching history for email:', req.params.email);
    const email = req.params.email;
    
    const query = `
      SELECT id, "formData", "aiResponse", "templateSlug", "createdBy", "createdAt"
      FROM "aiOutput" 
      WHERE "createdBy" = $1 
      ORDER BY "createdAt" DESC
    `;
    
    const result = await pool.query(query, [email]);
    console.log(`Found ${result.rows.length} history items for email: ${email}`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error in /api/history/:email:', error);
    res.status(500).json({ 
      error: 'Failed to fetch history',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
