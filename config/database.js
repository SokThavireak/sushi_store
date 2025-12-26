import pg from 'pg';
import env from "dotenv";

// Load environment variables
env.config();

const { Pool } = pg;

// Check if we are in production (Render) or local development
const isProduction = process.env.NODE_ENV === 'production';

// Get the database connection string from .env or Render settings
const connectionString = process.env.DATABASE_URL;

// Create a new pool instance
export const pool = new Pool({
  connectionString: connectionString,
  // Render requires SSL for production database connections
  ssl: isProduction ? { rejectUnauthorized: false } : false
});