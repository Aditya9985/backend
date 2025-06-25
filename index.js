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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

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

// Test DB connection endpoint
app.get("/api/test-db", async (req, res) => {
  const client = await pool.connect();
  try {
    // Test basic connection
    const result = await client.query('SELECT NOW()');
    
    // Test aiOutput table
    const tableTest = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'aiOutput'
      );
    `);
    
    // Get table structure
    const tableStructure = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'aiOutput';
    `);

    // Get row count
    const rowCount = await client.query('SELECT COUNT(*) FROM "aiOutput"');

    res.json({
      ok: true,
      time: result.rows[0].now,
      tableExists: tableTest.rows[0].exists,
      columns: tableStructure.rows,
      totalRows: rowCount.rows[0].count
    });
  } catch (err) {
    console.error('Database test failed:', err);
    res.status(500).json({
      ok: false,
      error: err.message
    });
  } finally {
    client.release();
  }
});

// Get user history by email
app.get("/api/history/:email", async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('Request params:', req.params);
    const email = decodeURIComponent(req.params.email);
    console.log('Decoded email:', email);
    
    // Validate email
    if (!email || !email.includes('@')) {
      console.log('Invalid email format');
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

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

    console.log('Executing query...');
    const result = await client.query(query, [email]);
    console.log(`Found ${result.rows.length} history items`);
    console.log('Raw data:', JSON.stringify(result.rows, null, 2));
    
    // Transform data to match frontend expectations
    const transformedData = result.rows.map((row, index) => {
      console.log(`Processing row ${index}:`, JSON.stringify(row, null, 2));
      let formData;
      try {
        // Handle different formData formats
        if (typeof row.formData === 'string') {
          try {
            formData = JSON.parse(row.formData);
            console.log('Parsed formData:', formData);
          } catch (e) {
            console.log('Failed to parse formData string:', e.message);
            formData = { text: row.formData };
          }
        } else if (typeof row.formData === 'object') {
          formData = row.formData;
          console.log('Using object formData:', formData);
        } else {
          console.log('Using fallback formData');
          formData = { text: String(row.formData) };
        }

        const transformedRow = {
          id: row.id,
          formData: formData,
          aiResponse: row.aiResponse || '',
          templateSlug: row.templateSlug || '',
          createdBy: row.createdBy,
          createdAt: row.createdAt,
          // Add these fields to match frontend expectations
          query: formData.input || formData.prompt || JSON.stringify(formData),
          response: row.aiResponse || ''
        };
        console.log('Transformed row:', JSON.stringify(transformedRow, null, 2));
        return transformedRow;
      } catch (e) {
        console.error('Error transforming row:', e.message);
        console.error('Problematic row:', JSON.stringify(row, null, 2));
        // Return a safe version of the row if transformation fails
        const safeRow = {
          id: row.id,
          formData: { error: 'Data format error' },
          aiResponse: row.aiResponse || '',
          templateSlug: row.templateSlug || '',
          createdBy: row.createdBy,
          createdAt: row.createdAt,
          query: 'Error: Could not parse query',
          response: row.aiResponse || ''
        };
        console.log('Using safe row:', JSON.stringify(safeRow, null, 2));
        return safeRow;
      }
    });

    console.log('Sending response with transformed data');
    return res.json(transformedData);

  } catch (error) {
    console.error('Error in /api/history/:email:', error);
    console.error('Stack trace:', error.stack);
    return res.status(500).json({ 
      error: 'Failed to fetch history',
      details: error.message,
      stack: error.stack
    });
  } finally {
    console.log('Releasing database connection');
    client.release();
  }
});

// Test endpoint for history
app.get("/api/history-test/:email", async (req, res) => {
  const client = await pool.connect();
  try {
    const email = decodeURIComponent(req.params.email);
    console.log('Test endpoint: fetching history for email:', email);

    const result = await client.query(`
      SELECT 
        id,
        "formData"::text,
        "aiResponse"::text,
        "templateSlug",
        "createdBy",
        "createdAt"
      FROM "aiOutput" 
      WHERE "createdBy" = $1 
      ORDER BY id DESC
    `, [email]);

    console.log('Raw results:', JSON.stringify(result.rows, null, 2));

    const transformedData = result.rows.map(row => {
      let formData;
      try {
        formData = JSON.parse(row.formData || '{}');
      } catch (e) {
        console.error('Error parsing formData:', e);
        formData = { error: 'Invalid format' };
      }

      return {
        id: row.id,
        formData,
        aiResponse: row.aiResponse || '',
        templateSlug: row.templateSlug || '',
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        query: formData.input || formData.prompt || formData.niche || JSON.stringify(formData),
        response: row.aiResponse || ''
      };
    });

    console.log('Transformed data:', JSON.stringify(transformedData, null, 2));
    return res.json(transformedData);

  } catch (error) {
    console.error('Error in test endpoint:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch history',
      details: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database URL: ${process.env.DATABASE_URL ? '(configured)' : '(missing)'}`);
});
