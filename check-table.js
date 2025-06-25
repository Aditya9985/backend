import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    require: true
  }
});

async function checkTable() {
  const client = await pool.connect();
  try {
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'aiOutput'
      );
    `);
    console.log('Table exists:', tableExists.rows[0].exists);

    // Get table structure
    const tableStructure = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'aiOutput'
      ORDER BY ordinal_position;
    `);
    console.log('\nTable structure:');
    console.table(tableStructure.rows);

    // Try to get data for specific email
    const email = 'mahaprasad.behera27@gmail.com';
    const data = await client.query(`
      SELECT id, "formData", "aiResponse", "templateSlug", "createdBy", "createdAt"
      FROM "aiOutput"
      WHERE "createdBy" = $1
    `, [email]);
    console.log(`\nFound ${data.rows.length} rows for email ${email}`);
    if (data.rows.length > 0) {
      console.log('Sample row:', data.rows[0]);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.release();
    await pool.end();
  }
}

checkTable();
