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

async function verifyDatabase() {
  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'aiOutput'
      );
    `);
    console.log('aiOutput table exists:', tableCheck.rows[0].exists);

    if (tableCheck.rows[0].exists) {
      // Check table structure
      const tableStructure = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'aiOutput';
      `);
      console.log('\nTable structure:');
      console.table(tableStructure.rows);

      // Get sample data
      const sampleData = await pool.query(`
        SELECT * FROM "aiOutput" LIMIT 1;
      `);
      console.log('\nSample data:', sampleData.rows[0]);

      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) FROM "aiOutput";
      `);
      console.log('\nTotal records:', countResult.rows[0].count);
    }
  } catch (error) {
    console.error('Error verifying database:', error);
  } finally {
    await pool.end();
  }
}

verifyDatabase();
