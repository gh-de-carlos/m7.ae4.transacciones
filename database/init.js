import { pool } from '../config/database.js';

/**
 * Database initialization script
 * Creates tables, cleans existing data, and inserts fresh initial data
 */

/**
 * Unified database cleaning function with multiple modes
 * @param {string} mode - Cleaning mode: 'full', 'test', or 'drop'
 *   - 'full': Truncates all tables and resets identity sequences (for fresh start)
 *   - 'test': Removes only test-generated data (preserves initial seed data)
 *   - 'drop': Drops all tables completely (for complete reset)
 */
export const cleanDatabase = async (mode = 'full') => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        switch (mode) {
            case 'full':
                console.log('>> Cleaning all existing data...');
                
                // Truncate tables in correct order (respecting foreign key constraints)
                await client.query('TRUNCATE TABLE pedidos RESTART IDENTITY CASCADE');
                await client.query('TRUNCATE TABLE clientes RESTART IDENTITY CASCADE'); 
                await client.query('TRUNCATE TABLE inventario RESTART IDENTITY CASCADE');
                
                console.log('>> All existing data cleared');
                console.log('>> Identity sequences reset to 1');
                break;
                
            case 'test':
                console.log('>> Cleaning test-generated data...');
                
                // Delete test orders (keep initial data intact)
                await client.query(`
                    DELETE FROM pedidos 
                    WHERE cliente_id IN (
                        SELECT id FROM clientes 
                        WHERE email LIKE '%@empresa.cl' 
                           OR email LIKE '%@startup.cl' 
                           OR email LIKE '%@consultora.cl'
                           OR email LIKE 'test@%'
                    )
                `);
                
                // Delete test clients (created during test runs)
                await client.query(`
                    DELETE FROM clientes 
                    WHERE email LIKE '%@empresa.cl' 
                       OR email LIKE '%@startup.cl' 
                       OR email LIKE '%@consultora.cl'
                       OR email LIKE 'test@%'
                `);
                
                // Reset inventory to initial values
                await client.query(`
                    UPDATE inventario SET stock = 
                        CASE 
                            WHEN producto = 'Laptop Gaming' THEN 10
                            WHEN producto = 'Mouse Inalámbrico' THEN 50  
                            WHEN producto = 'Teclado Mecánico' THEN 25
                            WHEN producto = 'Monitor 4K' THEN 8
                            WHEN producto = 'Auriculares Bluetooth' THEN 15
                            ELSE stock
                        END
                `);
                
                console.log('>> Test data cleaned, inventory reset');
                break;
                
            case 'drop':
                console.log('>> Dropping all tables...');
                await client.query('DROP TABLE IF EXISTS pedidos CASCADE');
                await client.query('DROP TABLE IF EXISTS inventario CASCADE');
                await client.query('DROP TABLE IF EXISTS clientes CASCADE');
                console.log('>> All tables dropped');
                break;
                
            default:
                throw new Error(`Invalid cleaning mode: ${mode}. Use 'full', 'test', or 'drop'`);
        }
        
        await client.query('COMMIT');
        console.log(`[OK] Database cleaned successfully (mode: ${mode})`);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[ERROR] Error cleaning database (mode: ${mode}):`, error);
        throw error;
    } finally {
        client.release();
    }
};

// Legacy function alias for backward compatibility
export const cleanTestData = async () => await cleanDatabase('test');

const createTables = async () => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create clientes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS clientes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                telefono VARCHAR(20),
                direccion TEXT,
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create inventario table
        await client.query(`
            CREATE TABLE IF NOT EXISTS inventario (
                id SERIAL PRIMARY KEY,
                producto VARCHAR(100) NOT NULL UNIQUE,
                descripcion TEXT,
                precio DECIMAL(10,2) NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                stock_minimo INTEGER DEFAULT 5,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create pedidos table
        await client.query(`
            CREATE TABLE IF NOT EXISTS pedidos (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                producto_id INTEGER NOT NULL REFERENCES inventario(id) ON DELETE RESTRICT,
                cantidad INTEGER NOT NULL CHECK (cantidad > 0),
                precio_unitario DECIMAL(10,2) NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                estado VARCHAR(20) DEFAULT 'pendiente',
                fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create indexes for better performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pedidos_cliente_id ON pedidos(cliente_id)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_pedidos_producto_id ON pedidos(producto_id)
        `);

        await client.query('COMMIT');
        console.log('✓ Tablas creadas exitosamente');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('✗ Error creando tablas:', error);
        throw error;
    } finally {
        client.release();
    }
};

const insertInitialData = async () => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Insert sample inventory items
        const inventoryItems = [
            { producto: 'Laptop Gaming', descripcion: 'Laptop de alta gama para gaming', precio: 1299.99, stock: 10 },
            { producto: 'Mouse Inalámbrico', descripcion: 'Mouse ergonómico inalámbrico', precio: 29.99, stock: 50 },
            { producto: 'Teclado Mecánico', descripcion: 'Teclado mecánico RGB', precio: 79.99, stock: 25 },
            { producto: 'Monitor 4K', descripcion: 'Monitor 27 pulgadas 4K', precio: 399.99, stock: 8 },
            { producto: 'Auriculares Bluetooth', descripcion: 'Auriculares con cancelación de ruido', precio: 199.99, stock: 15 }
        ];

        for (const item of inventoryItems) {
            await client.query(`
                INSERT INTO inventario (producto, descripcion, precio, stock)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (producto) DO NOTHING
            `, [item.producto, item.descripcion, item.precio, item.stock]);
        }

        await client.query('COMMIT');
        console.log('✓ Datos iniciales insertados exitosamente');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('✗ Error insertando datos iniciales:', error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Initialize the database with tables and initial data
 * Cleans existing data first to ensure fresh state
 */
export const initializeDatabase = async () => {
    try {
        console.log('[CONFIG] Inicializando base de datos...');
        await createTables();
        await cleanDatabase('full'); // Use unified function for full cleanup
        await insertInitialData();
        console.log('[OK] Base de datos inicializada correctamente');
    } catch (error) {
        console.error('[ERROR] Error inicializando base de datos:', error);
        throw error;
    }
};

