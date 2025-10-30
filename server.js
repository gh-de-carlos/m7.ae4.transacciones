import express from 'express';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/init.js';
import { runComprehensiveTestSuite, runQuickTest } from './tests/demo.js';
import { closePool } from './config/database.js';
import * as orderService from './services/orderService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * PostgreSQL Transaction Management System
 * Clean server - ASCII output only, no emojis
 */

app.get('/', (req, res) => {
    res.json({
        name: 'PostgreSQL Transaction Management System',
        version: '1.0.0',
        endpoints: {
            'GET /health': 'Health check',
            'POST /api/orders': 'Create order',
            'GET /api/orders': 'List orders', 
            'GET /api/inventory': 'Show inventory',
            'POST /tests/run': 'Run full test suite',
            'POST /tests/quick': 'Quick test'
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
        const { cliente, producto, cantidad, simulateError } = req.body;
        
        if (!cliente?.nombre || !cliente?.email || !producto || !cantidad) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields'
            });
        }
        
        const orderData = { cliente, producto, cantidad: parseInt(cantidad), simulateError };
        const result = await orderService.processCompleteOrder(orderData);
        
        res.status(201).json({
            status: 'success',
            data: { order_id: result.pedidoId, total: result.total }
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
        const summary = await orderService.getOrderSummary();
        res.json({
            status: 'success',
            data: summary.pedidos || []
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.get('/api/inventory', async (req, res) => {
    try {
        const { default: InventarioDAO } = await import('./dao/inventarioDAO.js');
        const { getClient } = await import('./config/database.js');
        const dao = new InventarioDAO();
        const client = await getClient();
        
        try {
            const inventory = await dao.getAll(client);
            res.json({ status: 'success', data: inventory });
        } finally {
            client.release();
        }
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/tests/run', async (req, res) => {
    try {
        console.log('\n>> Starting test suite...');
        const results = await runComprehensiveTestSuite();
        
        res.json({
            status: 'success',
            tests_run: results.individual.length,
            successful: results.individual.filter(r => r.success).length
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

app.post('/tests/quick', async (req, res) => {
    try {
        const result = await runQuickTest();
        res.json({
            status: 'success', 
            result: result.success ? 'passed' : 'failed'
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
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
        
        if (process.env.NODE_ENV !== 'production') {
            setTimeout(async () => {
                try {
                    await runComprehensiveTestSuite();
                } catch (error) {
                    console.error('>> Auto-test error:', error.message);
                }
            }, 3000);
        }
        
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
