import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/init.js';
import { closePool } from './config/database.js';
import * as orderService from './services/orderService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

/**
 * Demonstration of PostgreSQL transactions with Node.js
 * This application showcases:
 * 1. Creating a new client
 * 2. Registering a new order for that client
 * 3. Updating inventory by subtracting ordered units
 * 4. Proper transaction control with BEGIN, COMMIT, ROLLBACK
 * 5. Error handling and rollback scenarios
 */

// Sample data for demonstrations
const sampleOrders = [
    {
        cliente: {
            nombre: 'Juan Pérez',
            email: 'juan.perez@email.com',
            telefono: '+56912345678',
            direccion: 'Av. Principal 123, Santiago'
        },
        producto: 'Laptop Gaming',
        cantidad: 2,
        simulateError: false
    },
    {
        cliente: {
            nombre: 'María González',
            email: 'maria.gonzalez@email.com',
            telefono: '+56987654321',
            direccion: 'Calle Secundaria 456, Valparaíso'
        },
        producto: 'Mouse Inalámbrico',
        cantidad: 3,
        simulateError: false
    },
    {
        cliente: {
            nombre: 'Carlos López',
            email: 'carlos.lopez@email.com',
            telefono: '+56955555555',
            direccion: 'Plaza Central 789, Concepción'
        },
        producto: 'Monitor 4K',
        cantidad: 1,
        simulateError: true // This will trigger a ROLLBACK
    }
];

/**
 * Demonstration Functions
 */

// Demo 1: Successful transaction
const demonstrateSuccessfulTransaction = async () => {
    console.log('\n🎯 DEMOSTRACIÓN 1: TRANSACCIÓN EXITOSA');
    console.log('='.repeat(50));
    
    try {
        const result = await orderService.processCompleteOrder(sampleOrders[0]);
        
        console.log('\n📊 RESULTADO DE LA TRANSACCIÓN:');
        console.log('✅ Estado: COMMIT ejecutado exitosamente');
        console.log('📋 Resumen:', result.resumen);
        
        return result;
    } catch (error) {
        console.error('❌ Error inesperado:', error.message);
        throw error;
    }
};

// Demo 2: Transaction with rollback (simulated error)
const demonstrateRollbackTransaction = async () => {
    console.log('\n🎯 DEMOSTRACIÓN 2: TRANSACCIÓN CON ROLLBACK');
    console.log('='.repeat(50));
    
    try {
        const result = await orderService.processCompleteOrder(sampleOrders[2]);
        console.log('❌ ERROR: Esta transacción debería haber fallado');
        return result;
    } catch (error) {
        console.log('\n📊 RESULTADO DE LA TRANSACCIÓN:');
        console.log('🔄 Estado: ROLLBACK ejecutado correctamente');
        console.log('❌ Error capturado:', error.message);
        console.log('✅ Todas las operaciones fueron revertidas');
        console.log('ℹ️ La base de datos mantiene su integridad');
        
        return { error: error.message, rollback: true };
    }
};

// Demo 3: Multiple transactions (some successful, some with errors)
const demonstrateMultipleTransactions = async () => {
    console.log('\n🎯 DEMOSTRACIÓN 3: MÚLTIPLES TRANSACCIONES');
    console.log('='.repeat(50));
    
    try {
        const result = await orderService.batchProcessOrders(sampleOrders, false);
        
        console.log('\n📊 RESUMEN DEL PROCESAMIENTO EN LOTE:');
        console.log(`📦 Total de pedidos: ${result.total}`);
        console.log(`✅ Exitosos: ${result.successful}`);
        console.log(`❌ Fallidos: ${result.failed}`);
        
        if (result.errors.length > 0) {
            console.log('\n🔍 ERRORES ENCONTRADOS:');
            result.errors.forEach((error, index) => {
                console.log(`${index + 1}. Pedido ${error.index + 1}: ${error.error}`);
            });
        }
        
        return result;
    } catch (error) {
        console.error('❌ Error en procesamiento en lote:', error.message);
        throw error;
    }
};

// Demo 4: Inventory check and low stock demonstration
const demonstrateInventoryManagement = async () => {
    console.log('\n🎯 DEMOSTRACIÓN 4: GESTIÓN DE INVENTARIO');
    console.log('='.repeat(50));
    
    try {
        const summary = await orderService.getOrderSummary();
        
        console.log('\n📊 ESTADÍSTICAS GENERALES:');
        console.log(`📦 Total de pedidos: ${summary.estadisticas.total_pedidos}`);
        console.log(`💰 Ingresos totales: $${summary.estadisticas.ingresos_totales}`);
        console.log(`📈 Promedio por pedido: $${parseFloat(summary.estadisticas.promedio_pedido).toFixed(2)}`);
        console.log(`👥 Clientes únicos: ${summary.estadisticas.clientes_unicos}`);
        
        if (summary.productos_stock_bajo.length > 0) {
            console.log('\n⚠️ PRODUCTOS CON STOCK BAJO:');
            summary.productos_stock_bajo.forEach(producto => {
                console.log(`- ${producto.producto}: ${producto.stock} unidades (mínimo: ${producto.stock_minimo})`);
            });
        }
        
        return summary;
    } catch (error) {
        console.error('❌ Error obteniendo resumen:', error.message);
        throw error;
    }
};

/**
 * Main demonstration function
 */
const runDemonstrations = async () => {
    console.log('🚀 INICIANDO DEMOSTRACIONES DE TRANSACCIONES SQL');
    console.log('=' * 60);
    
    try {
        // Initialize database
        await initializeDatabase();
        
        // Run demonstrations
        await demonstrateSuccessfulTransaction();
        await demonstrateRollbackTransaction();
        await demonstrateMultipleTransactions();
        await demonstrateInventoryManagement();
        
        console.log('\n🎉 TODAS LAS DEMOSTRACIONES COMPLETADAS EXITOSAMENTE');
        console.log('=' * 60);
        
    } catch (error) {
        console.error('\n❌ ERROR EN LAS DEMOSTRACIONES:', error);
    }
};

/**
 * Express Routes (optional - for HTTP API access)
 */

app.get('/', (req, res) => {
    res.json({
        message: 'Sistema de Transacciones PostgreSQL',
        descripcion: 'Demostración de transacciones SQL con Node.js y pg',
        endpoints: {
            '/demo': 'Ejecutar todas las demostraciones',
            '/demo/success': 'Demostración de transacción exitosa',
            '/demo/rollback': 'Demostración de ROLLBACK',
            '/demo/batch': 'Demostración de múltiples transacciones',
            '/demo/inventory': 'Demostración de gestión de inventario'
        }
    });
});

app.post('/demo', async (req, res) => {
    try {
        await runDemonstrations();
        res.json({ status: 'success', message: 'Demostraciones ejecutadas exitosamente' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/demo/success', async (req, res) => {
    try {
        const result = await demonstrateSuccessfulTransaction();
        res.json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/demo/rollback', async (req, res) => {
    try {
        const result = await demonstrateRollbackTransaction();
        res.json({ status: 'rollback', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/demo/batch', async (req, res) => {
    try {
        const result = await demonstrateMultipleTransactions();
        res.json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/demo/inventory', async (req, res) => {
    try {
        const result = await demonstrateInventoryManagement();
        res.json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * Custom order endpoint for testing
 */
app.post('/orders', async (req, res) => {
    try {
        const { cliente, producto, cantidad, simulateError } = req.body;
        
        if (!cliente || !producto || !cantidad) {
            return res.status(400).json({
                status: 'error',
                message: 'Datos requeridos: cliente, producto, cantidad'
            });
        }
        
        const orderData = { cliente, producto, cantidad, simulateError };
        const result = await orderService.processCompleteOrder(orderData);
        
        res.json({ status: 'success', data: result });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

/**
 * Server startup and graceful shutdown
 */
const startServer = async () => {
    try {
        // Test database connection
        console.log('🔧 Verificando conexión a base de datos...');
        await initializeDatabase();
        
        // Start server
        app.listen(PORT, () => {
            console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
            console.log(`📖 Documentación: http://localhost:${PORT}`);
            console.log(`🧪 Ejecutar demos: http://localhost:${PORT}/demo`);
        });
        
        // Run demonstrations automatically if not in production
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n⏳ Ejecutando demostraciones automáticamente en 2 segundos...');
            setTimeout(runDemonstrations, 2000);
        }
        
    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 Señal ${signal} recibida. Iniciando cierre graceful...`);
    
    try {
        await closePool();
        console.log('✅ Cierre completado exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante el cierre:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

// Start the application
startServer();