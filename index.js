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
    // Decode the email from URL
    const email = decodeURIComponent(req.params.email);
    console.log('Attempting to fetch history for email:', email);

    // First verify if the table exists
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'aiOutput'
        );
      `);
      console.log('Table check result:', tableCheck.rows[0]);
    } catch (err) {
      console.error('Error checking table:', err);
    }

    // Then try to get a count of records
    try {
      const countQuery = await pool.query(`
        SELECT COUNT(*) FROM "aiOutput" 
        WHERE "createdBy" = $1
      `, [email]);
      console.log('Found records:', countQuery.rows[0].count);
    } catch (err) {
      console.error('Error counting records:', err);
    }

    // Now fetch the actual records
    const query = `
      SELECT 
        id,
        "formData",
        "aiResponse",
        "templateSlug",
        "createdBy",
        "createdAt"
      FROM "aiOutput" 
      WHERE "createdBy" = $1 
      ORDER BY "createdAt" DESC
    `;
    
    const result = await pool.query(query, [email]);
    console.log(`Successfully found ${result.rows.length} history items for email: ${email}`);
    
    return res.json(result.rows);
  } catch (error) {
    console.error('Detailed error in /api/history/:email:', {
      error: error.message,
      stack: error.stack,
      email: req.params.email
    });
    
    return res.status(500).json({ 
      error: 'Failed to fetch history',
      details: error.message,
      email: req.params.email 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
