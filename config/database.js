import pg from 'pg';
import env from "dotenv";

env.config();

const { Pool } = pg;

// Check if we are in production (Render) or local
const isProduction = process.env.NODE_ENV === 'production';

// Get the connection string from Render environment variables
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString: connectionString,
  // Render requires SSL for external database connections
  ssl: isProduction ? { rejectUnauthorized: false } : false
});