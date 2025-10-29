import { getClient } from '../config/database.js';

/**
 * Transaction Manager
 * Provides utilities for handling database transactions with proper error handling
 */

/**
 * Execute a function within a database transaction
 * Automatically handles BEGIN, COMMIT, and ROLLBACK
 * @param {Function} transactionFn - Function that executes the transaction logic
 * @param {Object} options - Transaction options
 * @param {boolean} options.logQueries - Whether to log SQL queries (default: false)
 * @returns {Promise<any>} Result of the transaction function
 */
export const executeTransaction = async (transactionFn, options = {}) => {
    const { logQueries = false } = options;
    let client;
    
    try {
        // Get client from pool
        client = await getClient();
        
        if (logQueries) {
            console.log('🔄 Iniciando transacción...');
        }
        
        // Begin transaction
        await client.query('BEGIN');
        
        if (logQueries) {
            console.log('✓ BEGIN ejecutado');
        }
        
        // Execute transaction function
        const result = await transactionFn(client);
        
        // Commit transaction
        await client.query('COMMIT');
        
        if (logQueries) {
            console.log('✅ COMMIT ejecutado - Transacción completada exitosamente');
        }
        
        return result;
        
    } catch (error) {
        if (client) {
            try {
                await client.query('ROLLBACK');
                if (logQueries) {
                    console.log('🔄 ROLLBACK ejecutado - Transacción revertida');
                }
            } catch (rollbackError) {
                console.error('❌ Error ejecutando ROLLBACK:', rollbackError);
            }
        }
        
        // Log the error with context
        console.error('❌ Error en transacción:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            timestamp: new Date().toISOString()
        });
        
        throw error;
    } finally {
        if (client) {
            client.release();
            if (logQueries) {
                console.log('🔓 Cliente liberado del pool de conexiones');
            }
        }
    }
};

/**
 * Execute multiple transactions in sequence
 * If any transaction fails, all previous transactions remain committed
 * @param {Array<Function>} transactionFns - Array of transaction functions
 * @param {Object} options - Options for each transaction
 * @returns {Promise<Array>} Array of results from each transaction
 */
export const executeSequentialTransactions = async (transactionFns, options = {}) => {
    const results = [];
    
    for (let i = 0; i < transactionFns.length; i++) {
        try {
            console.log(`🔄 Ejecutando transacción ${i + 1} de ${transactionFns.length}...`);
            
            const result = await executeTransaction(transactionFns[i], options);
            results.push(result);
            
            console.log(`✅ Transacción ${i + 1} completada`);
        } catch (error) {
            console.error(`❌ Error en transacción ${i + 1}:`, error.message);
            throw new Error(`Transacción ${i + 1} falló: ${error.message}`);
        }
    }
    
    return results;
};

/**
 * Custom transaction wrapper for specific business operations
 * Provides detailed logging for business operations
 */
export class TransactionManager {
    /**
     * Execute an order placement transaction
     * @param {Function} orderFn - Function that handles the order placement
     * @param {Object} orderData - Order data for logging
     * @returns {Promise<any>} Transaction result
     */
    static async executeOrderTransaction(orderFn, orderData) {
        console.log('🛒 Iniciando transacción de pedido...');
        console.log('📦 Datos del pedido:', {
            cliente: orderData.cliente?.nombre || 'N/A',
            producto: orderData.producto || 'N/A',
            cantidad: orderData.cantidad || 0
        });
        
        return executeTransaction(async (client) => {
            const result = await orderFn(client);
            
            console.log('✅ Pedido procesado exitosamente:', {
                pedidoId: result.pedido?.id || 'N/A',
                clienteId: result.cliente?.id || 'N/A',
                productoId: result.producto?.id || 'N/A',
                total: result.pedido?.total || 0
            });
            
            return result;
        }, { logQueries: true });
    }
    
    /**
     * Execute an inventory update transaction
     * @param {Function} inventoryFn - Function that handles inventory updates
     * @param {Object} inventoryData - Inventory data for logging
     * @returns {Promise<any>} Transaction result
     */
    static async executeInventoryTransaction(inventoryFn, inventoryData) {
        console.log('📦 Iniciando transacción de inventario...');
        console.log('🔢 Datos del inventario:', inventoryData);
        
        return executeTransaction(async (client) => {
            const result = await inventoryFn(client);
            
            console.log('✅ Inventario actualizado exitosamente');
            
            return result;
        }, { logQueries: true });
    }
    
    /**
     * Execute a client management transaction
     * @param {Function} clientFn - Function that handles client operations
     * @param {Object} clientData - Client data for logging
     * @returns {Promise<any>} Transaction result
     */
    static async executeClientTransaction(clientFn, clientData) {
        console.log('👤 Iniciando transacción de cliente...');
        console.log('📝 Datos del cliente:', {
            nombre: clientData.nombre || 'N/A',
            email: clientData.email || 'N/A'
        });
        
        return executeTransaction(async (client) => {
            const result = await clientFn(client);
            
            console.log('✅ Cliente procesado exitosamente:', {
                clienteId: result.id || 'N/A',
                nombre: result.nombre || 'N/A'
            });
            
            return result;
        }, { logQueries: true });
    }
}

/**
 * Utility function to simulate errors for testing ROLLBACK
 * @param {number} errorProbability - Probability of error (0-1)
 * @param {string} errorMessage - Error message to throw
 */
export const simulateRandomError = (errorProbability = 0.3, errorMessage = 'Error simulado para prueba de ROLLBACK') => {
    if (Math.random() < errorProbability) {
        throw new Error(errorMessage);
    }
};

/**
 * Utility function to force an error for testing
 * @param {string} errorMessage - Error message to throw
 */
export const forceError = (errorMessage = 'Error forzado para prueba de ROLLBACK') => {
    throw new Error(errorMessage);
};