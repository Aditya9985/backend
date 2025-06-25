import pg from 'pg';
const { Pool } = pg;

async function main() {
  const pool = new Pool({
    connectionString: 'postgresql://devmeup_owner:sN9EUaxi0pTH@ep-rough-star-a5nurafs-pooler.us-east-2.aws.neon.tech/devmeup',
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
