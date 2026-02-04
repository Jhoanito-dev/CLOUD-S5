const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgres://postgres:132416102004@localhost:5432/postgres'
});

async function runInit() {
  const client = await pool.connect();
  try {
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Exécution du script init.sql...');
    await client.query(sql);
    console.log('✅ Base de données initialisée avec succès !');
    console.log('📧 Compte manager: manager@roadworks.mg / password');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runInit();
