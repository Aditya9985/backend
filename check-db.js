import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDatabase() {
  const client = await pool.connect();
  try {
    console.log('Connected to database successfully');
    
    // Try to query the aiOutput table
    const result = await client.query('SELECT COUNT(*) FROM "aiOutput"');
    console.log('Total records in aiOutput:', result.rows[0].count);
    
    // Try to query for the specific email
    const email = 'mahaprasad.behera27@gmail.com';
    const userResult = await client.query('SELECT COUNT(*) FROM "aiOutput" WHERE "createdBy" = $1', [email]);
    console.log(`Records for email ${email}:`, userResult.rows[0].count);
    
    // Show sample data
    const sampleResult = await client.query('SELECT id, "createdBy", "createdAt", "formData" FROM "aiOutput" WHERE "createdBy" = $1 LIMIT 1', [email]);
    if (sampleResult.rows.length > 0) {
      console.log('Sample record:', JSON.stringify(sampleResult.rows[0], null, 2));
    } else {
      console.log('No records found for this email');
    }
    
  } catch (err) {
    console.error('Database check failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

checkDatabase().catch(console.error);
