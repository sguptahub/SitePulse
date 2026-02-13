import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Try to use DATABASE_URL first, fallback to individual PostgreSQL environment variables
let connectionString = process.env.DATABASE_URL;

if (!connectionString || connectionString.includes('neon.tech')) {
  // Construct connection string from individual PostgreSQL variables
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  
  if (!PGHOST || !PGPORT || !PGUSER || !PGPASSWORD || !PGDATABASE) {
    // Database not configured - this is OK if using MemStorage
    // Only throw error when DatabaseStorage is actually used
    console.warn("Database connection not configured. Using in-memory storage (MemStorage).");
    connectionString = undefined;
  } else {
    connectionString = `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?sslmode=require`;
  }
}

// Only create pool and db if connection string is available
export const pool = connectionString ? new Pool({ connectionString }) : null;
export const db = pool ? drizzle(pool, { schema }) : null;
