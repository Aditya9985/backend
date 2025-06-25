const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Checking aiOutput table...');
    const result = await pool.query('SELECT * FROM "aiOutput" WHERE "createdBy" = $1', ['mahaprasad.behera27@gmail.com']);
    console.log('Found records:', result.rows.length);
    console.log('Data:', JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

main();
