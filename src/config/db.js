// src/config/db.js
const { Pool } = require('pg');
require('dotenv').config();

// Soporta tanto DATABASE_URL (para Supabase/Cloud) como variables individuales (para desarrollo local)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Vital para permitir conexiones seguras hacia Supabase
        }
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
);

// Sin esto, un error en un cliente inactivo del pool tumba todo el proceso Node
pool.on('error', (error) => {
  console.error('Error inesperado en cliente inactivo de PostgreSQL:', error);
});

module.exports = pool;