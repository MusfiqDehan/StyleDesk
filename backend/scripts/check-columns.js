const { Client } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'employee'
  `);
  console.log(res.rows);
  await client.end();
}

checkColumns();
