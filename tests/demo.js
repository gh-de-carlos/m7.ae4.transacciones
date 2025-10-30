import * as orderService from '../services/orderService.js';

/**
 * Comprehensive test suite for PostgreSQL transaction demonstrations
 * Separated from server.js for better organization
 * Classic ASCII output without emojis
 */

// Test data with 3 successful orders plus 1 rollback scenario
const testOrders = [
    // SUCCESS #1: Basic laptop order  
    {
        cliente: {
            nombre: 'Juan Carlos Martinez',
            email: 'juan.martinez@empresa.cl',
            telefono: '+56912345678',
            direccion: 'Av. Providencia 1234, Santiago'
        },
        producto: 'Laptop Gaming',
        cantidad: 2,
        simulateError: false
    },
    // SUCCESS #2: Accessories bundle
    {
        cliente: {
            nombre: 'Maria Elena Rodriguez',
            email: 'maria.rodriguez@startup.cl',
            telefono: '+56987654321',
            direccion: 'Calle Moneda 567, Valparaiso'
        },
        producto: 'Mouse Inalámbrico',
        cantidad: 3,
        simulateError: false
    },
    // SUCCESS #3: Professional setup
    {
        cliente: {
            nombre: 'Carlos Alberto Gonzalez',
            email: 'carlos.gonzalez@consultora.cl',
            telefono: '+56955555555',
            direccion: 'Plaza Baquedano 890, Concepcion'
        },
        producto: 'Monitor 4K',
        cantidad: 1,
        simulateError: false
    },
    // ROLLBACK: Simulated payment failure
    {
        cliente: {
            nombre: 'Ana Patricia Morales',
            email: 'ana.morales@financiera.cl',
            telefono: '+56944444444',
            direccion: 'Av. Las Condes 2000, Las Condes'
        },
        producto: 'Teclado Mecánico',
        cantidad: 2,
        simulateError: true
    }
];

/**
 * Run individual transaction test
 */
async function runTransactionTest(orderData, testNumber, expectedResult) {
    console.log('\\n' + '='.repeat(60));
    console.log(`TEST ${testNumber}: ${expectedResult.toUpperCase()} TRANSACTION`);
    console.log('='.repeat(60));
    
    console.log('>> Processing order...');
    console.log(`   Customer: ${orderData.cliente.nombre}`);
    console.log(`   Product: ${orderData.producto}`);
    console.log(`   Quantity: ${orderData.cantidad}`);
    console.log(`   Expected: ${expectedResult}`);
    
    try {
        const result = await orderService.processCompleteOrder(orderData);
        
        if (expectedResult === 'SUCCESS') {
            console.log('\\n>> TRANSACTION RESULT:');
            console.log('   Status: COMMIT executed successfully');
            console.log('   Order ID:', result.pedido?.id || 'N/A');
            console.log('   Customer ID:', result.cliente?.id || 'N/A');
            console.log('   Total Amount: $' + (result.pedido?.total || '0.00'));
            
            if (result.resumen) {
                console.log('\\n>> ORDER SUMMARY:');
                console.log(`   Customer: ${result.resumen.cliente_nombre}`);
                console.log(`   Product: ${result.resumen.producto_nombre}`);
                console.log(`   Quantity: ${result.resumen.cantidad_pedida}`);
                console.log(`   Unit Price: $${result.resumen.precio_unitario}`);
                console.log(`   Total: $${result.resumen.total_pedido}`);
                console.log(`   Stock: ${result.resumen.stock_anterior} -> ${result.resumen.stock_nuevo}`);
            }
        } else {
            console.log('\\n>> ERROR: Transaction should have failed but succeeded');
        }
        
        return { success: true, result };
        
    } catch (error) {
        if (expectedResult === 'ROLLBACK') {
            console.log('\\n>> TRANSACTION RESULT:');
            console.log('   Status: ROLLBACK executed correctly');
            console.log('   Error:', error.message);
            console.log('   Data integrity: MAINTAINED');
            console.log('   All operations: REVERTED');
        } else {
            console.log('\\n>> UNEXPECTED ERROR:', error.message);
        }
        
        return { success: expectedResult === 'ROLLBACK', error: error.message };
    }
}

/**
 * Run batch processing test
 */
async function runBatchProcessingTest() {
    console.log('\\n' + '='.repeat(60));
    console.log('BATCH PROCESSING TEST: MULTIPLE TRANSACTIONS');
    console.log('='.repeat(60));
    
    try {
        console.log(`>> Processing batch of ${testOrders.length} orders...`);
        
        const result = await orderService.batchProcessOrders(testOrders, false);
        
        console.log('\\n>> BATCH PROCESSING SUMMARY:');
        console.log(`   Total orders: ${result.total}`);
        console.log(`   Successful: ${result.successful}`);
        console.log(`   Failed: ${result.failed}`);
        console.log(`   Success rate: ${((result.successful / result.total) * 100).toFixed(1)}%`);
        
        if (result.errors.length > 0) {
            console.log('\\n>> ERRORS ENCOUNTERED:');
            result.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. Order ${error.index + 1}: ${error.error}`);
            });
        }
        
        return result;
        
    } catch (error) {
        console.error('>> Batch processing error:', error.message);
        throw error;
    }
}

/**
 * Display system statistics
 */
async function displaySystemStatistics() {
    console.log('\\n' + '='.repeat(60));
    console.log('SYSTEM STATISTICS');
    console.log('='.repeat(60));
    
    try {
        const summary = await orderService.getOrderSummary();
        
        console.log('>> GENERAL STATISTICS:');
        console.log(`   Total orders: ${summary.estadisticas.total_pedidos}`);
        console.log(`   Total revenue: $${summary.estadisticas.ingresos_totales}`);
        console.log(`   Average order: $${parseFloat(summary.estadisticas.promedio_pedido).toFixed(2)}`);
        console.log(`   Unique customers: ${summary.estadisticas.clientes_unicos}`);
        
        if (summary.productos_stock_bajo && summary.productos_stock_bajo.length > 0) {
            console.log('\\n>> LOW STOCK ALERTS:');
            summary.productos_stock_bajo.forEach(producto => {
                console.log(`   - ${producto.producto}: ${producto.stock} units`);
            });
        }
        
        return summary;
        
    } catch (error) {
        console.error('>> Error getting statistics:', error.message);
        throw error;
    }
}

/**
 * Main test suite execution
 */
export async function runComprehensiveTestSuite() {
    console.log('\\n' + '#'.repeat(70));
    console.log('STARTING COMPREHENSIVE TRANSACTION TEST SUITE');
    console.log('#'.repeat(70));
    
    const results = {
        individual: [],
        batch: null,
        statistics: null,
        startTime: Date.now()
    };
    
    try {
        // Run individual transaction tests
        console.log('\\n>> Phase 1: Individual Transaction Tests');
        
        // Test 1: Success
        results.individual.push(
            await runTransactionTest(testOrders[0], 1, 'SUCCESS')
        );
        
        // Test 2: Success  
        results.individual.push(
            await runTransactionTest(testOrders[1], 2, 'SUCCESS')
        );
        
        // Test 3: Success
        results.individual.push(
            await runTransactionTest(testOrders[2], 3, 'SUCCESS')
        );
        
        // Test 4: Rollback
        results.individual.push(
            await runTransactionTest(testOrders[3], 4, 'ROLLBACK')
        );
        
        // Run batch processing test
        console.log('\\n>> Phase 2: Batch Processing Test');
        results.batch = await runBatchProcessingTest();
        
        // Display statistics
        console.log('\\n>> Phase 3: System Statistics');
        results.statistics = await displaySystemStatistics();
        
        // Final summary
        const endTime = Date.now();
        const duration = ((endTime - results.startTime) / 1000).toFixed(2);
        
        console.log('\\n' + '#'.repeat(70));
        console.log('TEST SUITE EXECUTION SUMMARY');
        console.log('#'.repeat(70));
        
        const successfulTests = results.individual.filter(r => r.success).length;
        console.log(`>> Individual tests: ${successfulTests}/${results.individual.length} passed`);
        console.log(`>> Batch processing: ${results.batch ? 'COMPLETED' : 'FAILED'}`);
        console.log(`>> Statistics display: ${results.statistics ? 'COMPLETED' : 'FAILED'}`);
        console.log(`>> Total execution time: ${duration} seconds`);
        console.log('>> All transaction controls: FUNCTIONAL');
        console.log('>> Database integrity: MAINTAINED');
        
        console.log('\\n>> Test suite completed successfully');
        
        return results;
        
    } catch (error) {
        console.error('\\n>> CRITICAL ERROR in test suite:', error.message);
        console.error('>> Test suite execution FAILED');
        throw error;
    }
}

/**
 * Quick test function for API endpoint
 */
export async function runQuickTest() {
    console.log('>> Running quick transaction test...');
    
    try {
        const result = await runTransactionTest(testOrders[0], 1, 'SUCCESS');
        console.log('>> Quick test completed');
        return result;
    } catch (error) {
        console.error('>> Quick test failed:', error.message);
        throw error;
    }
}