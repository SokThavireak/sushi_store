import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'opulent_pos',
  password: '051126',
  port: 5432,
  connectionTimeoutMillis: 5000,
});

try {
  const client = await pool.connect();
  console.log("✅ LOCAL POSTGRES CONNECTED SUCCESSFULLY TO opulent_pos!");
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log("Tables:", res.rows.map(r => r.table_name));
  client.release();
} catch (e) {
  console.error("Local connect error:", e);
}
await pool.end();
process.exit();
