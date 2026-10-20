import { Pool } from "pg";
import env from "dotenv";
env.config();

console.log("Testing connection to:", process.env.DB_HOST);
const pool1 = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
});

try {
  const client = await pool1.connect();
  console.log("Successfully connected!");
  const res = await client.query("SELECT NOW()");
  console.log("Query result:", res.rows[0]);
  client.release();
} catch (err) {
  console.error("Pool1 error:", err.message, err.code);
}

await pool1.end();
