import * as clienteDAO from '../dao/clienteDAO.js';
import * as inventarioDAO from '../dao/inventarioDAO.js';
import * as pedidoDAO from '../dao/pedidoDAO.js';
import { TransactionManager, simulateRandomError, forceError } from '../utils/transactionManager.js';

/**
 * Order Service
 * Implements business logic for order processing with transactions
 */

/**
 * Process a complete order transaction
 * Creates client, registers order, and updates inventory in a single transaction
 * @param {Object} orderData - Complete order information
 * @param {Object} orderData.cliente - Client data
 * @param {string} orderData.producto - Product name
 * @param {number} orderData.cantidad - Quantity ordered
 * @param {boolean} orderData.simulateError - Whether to simulate an error for testing
 * @returns {Promise<Object>} Complete order result
 */
export const processCompleteOrder = async (orderData) => {
    const { cliente, producto, cantidad, simulateError = false } = orderData;
    
    return TransactionManager.executeOrderTransaction(async (client) => {
        let createdClient;
        let foundProduct;
        let createdOrder;
        let updatedProduct;
        
        try {
            // Step 1: Create or verify client
            console.log('1. Creando cliente...');
            createdClient = await clienteDAO.createClient(cliente, client);
            console.log(`[OK] Cliente creado: ${createdClient.nombre} (ID: ${createdClient.id})`);
            
            // Step 2: Verify product exists and get its data
            console.log('2. Verificando producto...');
            foundProduct = await inventarioDAO.getProductByName(producto, client);
            if (!foundProduct) {
                throw new Error(`Producto "${producto}" no encontrado en inventario`);
            }
            console.log(`[OK] Producto encontrado: ${foundProduct.producto} (Stock: ${foundProduct.stock})`);
            
            // Step 3: Check stock availability
            console.log('3. Verificando stock...');
            const hasStock = await inventarioDAO.checkStock(foundProduct.id, cantidad, client);
            if (!hasStock) {
                throw new Error(`Stock insuficiente para "${producto}". Stock actual: ${foundProduct.stock}, solicitado: ${cantidad}`);
            }
            console.log(`[OK] Stock suficiente para ${cantidad} unidades`);
            
            // Simulate error for testing ROLLBACK (if requested)
            if (simulateError) {
                console.log('[WARNING] Simulando error para prueba de ROLLBACK...');
                forceError('Error simulado: Problema en el sistema de pagos');
            }
            
            // Step 4: Create order
            console.log('4. Creando pedido...');
            const orderInfo = {
                cliente_id: createdClient.id,
                producto_id: foundProduct.id,
                cantidad: cantidad,
                precio_unitario: foundProduct.precio
            };
            createdOrder = await pedidoDAO.createOrder(orderInfo, client);
            console.log(`[OK] Pedido creado: ID ${createdOrder.id}, Total: $${createdOrder.total}`);
            
            // Step 5: Update inventory
            console.log('5. Actualizando inventario...');
            updatedProduct = await inventarioDAO.updateStock(foundProduct.id, cantidad, client);
            console.log(`[OK] Inventario actualizado: ${updatedProduct.producto} (Nuevo stock: ${updatedProduct.stock})`);
            
            // Return complete transaction result
            return {
                cliente: createdClient,
                producto: updatedProduct,
                pedido: createdOrder,
                resumen: {
                    cliente_nombre: createdClient.nombre,
                    producto_nombre: foundProduct.producto,
                    cantidad_pedida: cantidad,
                    precio_unitario: foundProduct.precio,
                    total_pedido: createdOrder.total,
                    stock_anterior: foundProduct.stock,
                    stock_nuevo: updatedProduct.stock
                }
            };
            
        } catch (error) {
            console.error(`[ERROR] Error en el paso de procesamiento: ${error.message}`);
            throw error; // This will trigger ROLLBACK
        }
        
    }, orderData);
};

/**
 * Process order with existing client
 * @param {Object} orderData - Order data with existing client ID
 * @returns {Promise<Object>} Order result
 */
export const processOrderWithExistingClient = async (orderData) => {
    const { cliente_id, producto, cantidad, simulateError = false } = orderData;
    
    return TransactionManager.executeOrderTransaction(async (client) => {
        // Verify client exists
        const existingClient = await clienteDAO.getClientById(cliente_id, client);
        if (!existingClient) {
            throw new Error(`Cliente con ID ${cliente_id} no encontrado`);
        }
        
        // Find product
        const foundProduct = await inventarioDAO.getProductByName(producto, client);
        if (!foundProduct) {
            throw new Error(`Producto "${producto}" no encontrado`);
        }
        
        // Check stock
        const hasStock = await inventarioDAO.checkStock(foundProduct.id, cantidad, client);
        if (!hasStock) {
            throw new Error(`Stock insuficiente para "${producto}"`);
        }
        
        // Simulate error if requested
        if (simulateError) {
            simulateRandomError(1.0, 'Error simulado en procesamiento de pedido');
        }
        
        // Create order
        const orderInfo = {
            cliente_id: existingClient.id,
            producto_id: foundProduct.id,
            cantidad: cantidad,
            precio_unitario: foundProduct.precio
        };
        const createdOrder = await pedidoDAO.createOrder(orderInfo, client);
        
        // Update inventory
        const updatedProduct = await inventarioDAO.updateStock(foundProduct.id, cantidad, client);
        
        return {
            cliente: existingClient,
            producto: updatedProduct,
            pedido: createdOrder
        };
        
    }, orderData);
};

/**
 * Cancel order and restore inventory
 * @param {number} orderId - Order ID to cancel
 * @returns {Promise<Object>} Cancellation result
 */
export const cancelOrderAndRestoreInventory = async (orderId) => {
    return TransactionManager.executeOrderTransaction(async (client) => {
        // Get order details
        const order = await pedidoDAO.getOrderById(orderId, client);
        if (!order) {
            throw new Error(`Pedido con ID ${orderId} no encontrado`);
        }
        
        if (order.estado === 'cancelado') {
            throw new Error('El pedido ya está cancelado');
        }
        
        // Cancel order
        const cancelResult = await pedidoDAO.cancelOrder(orderId, client);
        
        // Restore inventory
        const restoredProduct = await inventarioDAO.restoreStock(
            order.producto_id, 
            order.cantidad, 
            client
        );
        
        return {
            order: cancelResult.order,
            producto: restoredProduct,
            mensaje: `Pedido ${orderId} cancelado y stock restaurado`
        };
        
    }, { orderId });
};

/**
 * Batch process multiple orders
 * @param {Array} ordersData - Array of order data
 * @param {boolean} stopOnError - Whether to stop processing on first error
 * @returns {Promise<Object>} Batch processing result
 */
export const batchProcessOrders = async (ordersData, stopOnError = true) => {
    const results = [];
    const errors = [];
    
    console.log(`[PROCESSING] Procesando lote de ${ordersData.length} pedidos...`);
    
    for (let i = 0; i < ordersData.length; i++) {
        try {
            console.log(`\n[ORDER] Procesando pedido ${i + 1}/${ordersData.length}...`);
            const result = await processCompleteOrder(ordersData[i]);
            results.push({ index: i, success: true, data: result });
            console.log(`[OK] Pedido ${i + 1} procesado exitosamente`);
        } catch (error) {
            const errorInfo = { index: i, success: false, error: error.message };
            errors.push(errorInfo);
            console.error(`[ERROR] Error en pedido ${i + 1}: ${error.message}`);
            
            if (stopOnError) {
                console.log('🛑 Deteniendo procesamiento por error...');
                break;
            }
        }
    }
    
    return {
        total: ordersData.length,
        processed: results.length,
        successful: results.length,
        failed: errors.length,
        results,
        errors
    };
};

/**
 * Get order summary with statistics
 * @returns {Promise<Object>} Order summary
 */
export const getOrderSummary = async () => {
    return TransactionManager.executeOrderTransaction(async (client) => {
        const statistics = await pedidoDAO.getOrderStatistics(client);
        const recentOrders = await pedidoDAO.getAllOrders(client);
        const lowStockProducts = await inventarioDAO.getLowStockProducts(client);
        
        return {
            estadisticas: statistics,
            pedidos_recientes: recentOrders.slice(0, 10), // Last 10 orders
            productos_stock_bajo: lowStockProducts
        };
    }, {});
};