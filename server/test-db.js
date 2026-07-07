const { Pool } = require('pg');

const passwords = [
  'rootroot', 'adminadmin', 'postgrespostgres', 
  'system', 'manager', '1234567890'
];

async function testPasswords() {
  for (const pw of passwords) {
    console.log(`Testing password: "${pw}"...`);
    const pool = new Pool({
      user: 'postgres',
      password: pw,
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      connectionTimeoutMillis: 2000
    });

    try {
      const client = await pool.connect();
      console.log(`SUCCESS! Password is: "${pw}"`);
      client.release();
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.log(`Failed for "${pw}": ${err.message}`);
      await pool.end();
    }
  }
  console.log('All passwords failed.');
  process.exit(1);
}

testPasswords();
