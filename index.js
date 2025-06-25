import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import pkg from "pg";

// Load environment variables
dotenv.config();

const { Pool } = pkg;

// Create the pool with logging
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
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
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      ok: true, 
      time: result.rows[0].now,
      database: 'connected'
    });
  } catch (err) {
    console.error('Health check failed:', err);
    res.status(500).json({ 
      ok: false, 
      error: err.message,
      database: 'disconnected'
    });
  }
});

// Get user history by email
app.get("/api/history/:email", async (req, res) => {
  const client = await pool.connect();
  try {
    const email = decodeURIComponent(req.params.email);
    console.log('Fetching history for email:', email);

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
      ORDER BY id DESC
    `;

    const result = await client.query(query, [email]);
    
    // Transform data to match frontend expectations
    const transformedData = result.rows.map(row => {
      let formData;
      try {
        formData = JSON.parse(row.formData);
      } catch (e) {
        formData = { text: row.formData };
      }

      return {
        id: row.id,
        formData: formData,
        aiResponse: row.aiResponse || '',
        templateSlug: row.templateSlug,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        // Add these fields to match frontend expectations
        query: formData.input || formData.prompt || JSON.stringify(formData),
        response: row.aiResponse || ''
      };
    });

    console.log(`Found ${result.rows.length} history items`);
    return res.json(transformedData);

  } catch (error) {
    console.error('Error in /api/history/:email:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch history',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
