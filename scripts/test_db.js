import pg from 'pg';
import env from 'dotenv';
env.config();

const { Pool } = pg;

const connectionStrings = [
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}?ssl=true`,
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`,
];

for (const cs of connectionStrings) {
  console.log("Trying CS:", cs.replace(process.env.DB_PASSWORD, '****'));
  const pool = new Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    const client = await pool.connect();
    console.log("SUCCESS!");
    const res = await client.query('SELECT NOW()');
    console.log("Result:", res.rows);
    client.release();
    await pool.end();
    break;
  } catch (err) {
    console.error("FAILED:", err.message);
    await pool.end();
  }
}
process.exit();
