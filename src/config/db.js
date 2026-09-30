const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: 'db.vtsszztighyimgntuqdf.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '127s4yuehjs', // Reemplaza por tu contraseña sin corchetes
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (error) => {
  console.error('Error inesperado en cliente inactivo de PostgreSQL:', error);
});

module.exports = pool;  