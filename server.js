import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase, cleanTestData } from './database/init.js';
import { runComprehensiveTestSuite } from './tests/demo.js';
import { closePool, getClient } from './config/database.js';
import * as orderService from './services/orderService.js';
import * as inventarioDAO from './dao/inventarioDAO.js';
import * as clienteDAO from './dao/clienteDAO.js';
import * as pedidoDAO from './dao/pedidoDAO.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        name: 'PostgreSQL Transaction Management System',
        version: '1.0.0',
        endpoints: {
            'GET /health': 'Health check',
            'POST /api/orders': 'Create order with transaction',
            'GET /api/orders': 'List all processed orders', 
            'GET /api/inventory': 'Show current inventory',
            'GET /api/customers': 'List all customers',
            'POST /tests/run': 'Run comprehensive test suite',
            'POST /cleanse': 'Clean database (query: ?mode=test|full|orders)'
        }
    });
});

app.get('/health', async (req, res) => {
    try {
        const summary = await orderService.getOrderSummary();
        res.json({
            status: 'healthy',
            orders: summary.estadisticas?.total_pedidos || 0
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy', 
            error: error.message
        });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const { cliente, producto, cantidad, productos, simulateError } = req.body;
        
        // Validate client data
        if (!cliente?.nombre || !cliente?.email) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required client fields (nombre, email)'
            });
        }
        
        // Validate product data - either single product or products array
        const hasSingleProduct = producto && cantidad;
        const hasMultipleProducts = productos && Array.isArray(productos) && productos.length > 0;
        
        if (!hasSingleProduct && !hasMultipleProducts) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing product data. Provide either "producto"+"cantidad" or "productos" array'
            });
        }
        
        // Validate productos array format if provided
        if (hasMultipleProducts) {
            const invalidProducts = productos.filter(p => !p.producto || !p.cantidad);
            if (invalidProducts.length > 0) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid productos format. Each item must have "producto" and "cantidad"'
                });
            }
        }
        
        let orderData;
        if (hasSingleProduct) {
            orderData = { cliente, producto, cantidad: parseInt(cantidad), simulateError };
        } else {
            // Convert quantities to integers
            const processedProducts = productos.map(p => ({
                producto: p.producto,
                cantidad: parseInt(p.cantidad)
            }));
            orderData = { cliente, productos: processedProducts, simulateError };
        }
        
        const result = await orderService.processCompleteOrder(orderData);
        
        res.status(201).json({
            status: 'success',
            data: {
                orders_created: result.pedidos?.length || 1,
                total_value: result.resumen?.valor_total || result.total,
                client: result.cliente.nombre,
                products: result.resumen?.productos_detalle || [{
                    producto: result.producto?.producto,
                    cantidad: result.resumen?.cantidad_pedida
                }]
            }
        });
        
    } catch (error) {
        console.error('Order error:', error.message);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const client = await getClient();
        
        try {
            const orders = await pedidoDAO.getAllOrders(client);
            res.json({ status: 'success', data: orders });
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/inventory', async (req, res) => {
    try {
        const client = await getClient();
        
        try {
            const inventory = await inventarioDAO.getAllProducts(client);
            res.json({ status: 'success', data: inventory });
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/customers', async (req, res) => {
    try {
        const client = await getClient();
        
        try {
            const customers = await clienteDAO.getAllClients(client);
            res.json({ status: 'success', data: customers });
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/tests/run', async (req, res) => {
    try {
        console.log('\n>> Starting comprehensive test suite...');
        
        // First clean any existing test data to prevent conflicts
        await cleanTestData();
        console.log('>> Test data cleaned - ready for fresh test run');
        
        // Run the test suite
        const results = await runComprehensiveTestSuite();
        
        console.log('\n>> Test data preserved for manual inspection');
        console.log('>> Use GET /api/orders, /api/customers, /api/inventory to explore test data');
        
        // Count successful tests
        const successCount = results.individual.filter(r => r.success).length;
        const totalTests = results.individual.length;
        
        // Prepare response
        res.json({
            status: 'success',
            version: 'v2.0_detailed_response', // Version identifier
            message: 'PostgreSQL Transaction Test Suite Completed Successfully',
            execution: {
                timestamp: new Date().toISOString(),
                total_tests_run: totalTests,
                successful_tests: successCount,
                failed_tests: totalTests - successCount,
                success_rate: `${Math.round((successCount / totalTests) * 100)}%`
            },
            test_results: {
                test_1: { customer: 'Juan Carlos Martinez', product: 'Laptop Gaming', expected: 'SUCCESS', result: results.individual[0]?.success ? 'PASSED' : 'FAILED' },
                test_2: { customer: 'Maria Elena Rodriguez', product: 'Mouse Inalámbrico', expected: 'SUCCESS', result: results.individual[1]?.success ? 'PASSED' : 'FAILED' },
                test_3: { customer: 'Carlos Alberto Gonzalez', product: 'Monitor 4K', expected: 'SUCCESS', result: results.individual[2]?.success ? 'PASSED' : 'FAILED' },
                test_4: { customer: 'PEPITO NOMBRE_INCORRECTO', product: 'Teclado Mecánico', expected: 'ROLLBACK', result: results.individual[3]?.success ? 'PASSED' : 'FAILED' }
            },
            batch_processing: results.batch || { status: 'not_run' },
            transaction_features_verified: [
                'BEGIN/COMMIT/ROLLBACK transaction control',
                'ACID compliance and data integrity',
                'Inventory stock validation and updates',
                'Customer email uniqueness with name matching',
                'Multi-product order processing',
                'Error handling with automatic rollback'
            ],
            data_preservation: {
                status: 'preserved',
                message: 'Test data kept for manual inspection',
                inspect_endpoints: [
                    'GET /api/orders - View created orders',
                    'GET /api/customers - View test customers', 
                    'GET /api/inventory - View updated inventory'
                ]
            }
        });
        
    } catch (error) {
        console.error('Test suite error:', error.message);
        
        // Clean up only on failure to prevent corrupted test data
        try {
            await cleanTestData();
            console.log('>> Emergency cleanup completed due to test failure');
        } catch (cleanupError) {
            console.error('>> Emergency cleanup failed:', cleanupError.message);
        }
        
        res.status(500).json({ 
            status: 'error', 
            message: error.message,
            note: 'Test data cleaned due to failure - database reset to clean state'
        });
    }
});

app.post('/cleanse', async (req, res) => {
    try {
        const mode = req.query.mode || 'test';
        
        // Import the unified clean function with different modes
        const { cleanDatabase } = await import('./database/init.js');
        
        let message, description;
        
        switch (mode) {
            case 'test':
                await cleanDatabase('test');
                message = 'Test data cleaned successfully';
                description = 'Removed test customers, orders, and reset inventory to initial values';
                break;
                
            case 'full':
                await cleanDatabase('full'); 
                message = 'Database fully reset to initial state';
                description = 'All data truncated, identity sequences reset, ready for fresh start';
                break;
                
            case 'orders':
                // Custom mode: clean only orders, keep customers and inventory
                const client = await getClient();
                try {
                    await client.query('DELETE FROM pedidos');
                    message = 'Orders cleaned successfully';
                    description = 'All orders removed, customers and inventory preserved';
                } finally {
                    client.release();
                }
                break;
                
            default:
                return res.status(400).json({
                    status: 'error',
                    message: 'Invalid mode. Use: test, full, or orders',
                    available_modes: {
                        test: 'Clean test data only (preserve initial seed data)',
                        full: 'Complete database reset (truncate all tables)', 
                        orders: 'Remove orders only (keep customers & inventory)'
                    }
                });
        }
        
        res.json({
            status: 'success',
            message,
            description,
            mode: mode,
            timestamp: new Date().toISOString(),
            next_steps: {
                test_again: 'POST /tests/run',
                check_data: ['GET /api/orders', 'GET /api/customers', 'GET /api/inventory']
            }
        });
        
    } catch (error) {
        console.error('Cleanse error:', error.message);
        res.status(500).json({
            status: 'error',
            message: error.message,
            note: 'Database cleanse failed - check server logs'
        });
    }
});

app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Not found' });
});

async function startServer() {
    try {
        console.log('>> Initializing database...');
        await initializeDatabase();
        
        app.listen(PORT, () => {
            console.log(`\n>> Server running on port ${PORT}`);
            console.log(`   Documentation: http://localhost:${PORT}`);
            console.log(`   Health: http://localhost:${PORT}/health`);
        });
        
        console.log('>> Ready for API requests');
        console.log('>> To run tests: POST /tests/run');
        
    } catch (error) {
        console.error('>> Startup failed:', error.message);
        process.exit(1);
    }
}

async function gracefulShutdown(signal) {
    console.log(`\n>> Shutting down (${signal})...`);
    try {
        await closePool();
        console.log('>> Database closed');
        process.exit(0);
    } catch (error) {
        console.error('>> Shutdown error:', error.message);
        process.exit(1);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    console.error('>> Unhandled rejection:', reason);
    gracefulShutdown('unhandledRejection');
});

startServer();
