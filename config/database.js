import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Validamos la existencia de las variables de entorno necesarias
// Esto está muy entrete y no se suele enseñar. Comúnmente nos 
// vamos por la happy-path con estas variables, sin validar nada.
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Cueeec: Te falta definir las siguientes variables de entorno:');
    missingVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });

    console.error('\n💡 Asegúrate de que el archivo .env existe y contiene todas las variables requeridas.');
    console.error('   Sapea el .env.example como referencia.');
    process.exit(1);
}

// DB settings. Solemos poner este archivo en pool.js pero quiero
// probar configuraciones distintas para aprender el cómo funciona
// además de un patrón particular cualquiera.
const dbConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 5432,
    max: 20, // Conexiones máximas en el pool
    idleTimeoutMillis: 30000, // Tiempo máximo que un cliente puede estar inactivo
    connectionTimeoutMillis: 2000, // Tiempo máximo para intentar conectar antes de rendirse
};

// Creamos el pool de conexiones pasando el
// objeto recién creado como argumento.
export const pool = new Pool(dbConfig);

// Pool event handlers
pool.on('connect', () => {
    console.log('✓ Conectado a PostgreSQL');
});

pool.on('error', (err) => {
    console.error('✗ Error inesperado en el pool de conexiones:', err);
    process.exit(-1);
});

/**
 * Get a client from the pool for transaction handling
 * @returns {Promise<pg.PoolClient>} Database client
 */
export const getClient = async () => {
    try {
        return await pool.connect();
    } catch (error) {
        console.error('Error obteniendo cliente de la pool:', error);
        throw error;
    }
};

/**
 * Close the pool and all connections
 */
export const closePool = async () => {
    try {
        await pool.end();
        console.log('✓ Pool de conexiones cerrado');
    } catch (error) {
        console.error('Error cerrando pool de conexiones:', error);
        throw error;
    }
};