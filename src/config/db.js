const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vtsszztighyimgntuqdf:127s4yuehjs@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (error) => {
  console.error('Error inesperado en cliente inactivo de PostgreSQL:', error);
});

module.exports = pool;