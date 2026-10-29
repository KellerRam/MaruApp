const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vtsszztighyimgntuqdf:127s4yuehjs@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  },
  // Falla rápido si el pooler no responde, en lugar de dejar la petición colgada
  max: 5,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  query_timeout: 15000,
  statement_timeout: 15000
});

pool.on('error', (error) => {
  console.error('Error inesperado en cliente inactivo de PostgreSQL:', error);
});

module.exports = pool;