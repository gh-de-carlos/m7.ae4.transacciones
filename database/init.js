import { pool } from '../config/database.js';

/**
 * Database initialization script
 * Creates tables and inserts initial data
 */

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
 */
export const initializeDatabase = async () => {
    try {
        console.log('🔧 Inicializando base de datos...');
        await createTables();
        await insertInitialData();
        console.log('✅ Base de datos inicializada correctamente');
    } catch (error) {
        console.error('❌ Error inicializando base de datos:', error);
        throw error;
    }
};

/**
 * Clean up database (for testing purposes)
 */
export const cleanDatabase = async () => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        await client.query('DROP TABLE IF EXISTS pedidos CASCADE');
        await client.query('DROP TABLE IF EXISTS inventario CASCADE');
        await client.query('DROP TABLE IF EXISTS clientes CASCADE');
        
        await client.query('COMMIT');
        console.log('✓ Base de datos limpiada');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('✗ Error limpiando base de datos:', error);
        throw error;
    } finally {
        client.release();
    }
};