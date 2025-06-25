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

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

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
    console.log('Processing request for email:', email);

    // Begin transaction
    await client.query('BEGIN');

    // Check if the table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'aiOutput'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      throw new Error('aiOutput table does not exist');
    }

    // Get the actual data
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

    console.log('Executing query:', query);
    console.log('With parameters:', [email]);

    const result = await client.query(query, [email]);
    
    // Log the results
    console.log('Query completed. Found rows:', result.rows.length);
    
    // Commit transaction
    await client.query('COMMIT');

    return res.json(result.rows);

  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    
    console.error('Detailed error in /api/history/:email:', {
      error: error.message,
      stack: error.stack,
      email: req.params.email,
      query: error.query,
      parameters: error.parameters
    });

    return res.status(500).json({
      error: 'Failed to fetch history',
      details: error.message,
      email: req.params.email
    });
  } finally {
    // Release the client back to the pool
    client.release();
  }
});

// Test database endpoint
app.get("/api/test-db", async (req, res) => {
  const client = await pool.connect();
  try {
    // Test basic query
    const result1 = await client.query('SELECT NOW()');
    
    // Test aiOutput table
    const result2 = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'aiOutput'
      );
    `);
    
    // Get table structure
    const result3 = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'aiOutput';
    `);
    
    // Get row count
    const result4 = await client.query(`
      SELECT COUNT(*) FROM "aiOutput";
    `);
    
    res.json({
      database: 'connected',
      currentTime: result1.rows[0].now,
      tableExists: result2.rows[0].exists,
      tableStructure: result3.rows,
      totalRows: result4.rows[0].count
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({
      error: 'Database test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
});

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
  console.error('Server error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
