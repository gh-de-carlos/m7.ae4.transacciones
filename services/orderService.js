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
 * Creates client, registers order(s), and updates inventory in a single transaction
 * @param {Object} orderData - Complete order information
 * @param {Object} orderData.cliente - Client data
 * @param {string|Array} orderData.producto - Single product name or array of products
 * @param {number|Array} orderData.cantidad - Single quantity or array of quantities
 * @param {Array} orderData.productos - Alternative: array of {producto, cantidad} objects
 * @param {boolean} orderData.simulateError - Whether to simulate an error for testing
 * @returns {Promise<Object>} Complete order result
 */
export const processCompleteOrder = async (orderData) => {
    const { cliente, producto, cantidad, productos, simulateError = false } = orderData;
    
    // Normalize input to always work with array of products
    let productItems = [];
    
    if (productos && Array.isArray(productos)) {
        // Multiple products format: {productos: [{producto: "name", cantidad: 2}, ...]}
        productItems = productos;
    } else if (producto && cantidad) {
        // Single product format: {producto: "name", cantidad: 2}
        productItems = [{ producto, cantidad }];
    } else {
        throw new Error('Se requiere especificar "producto" y "cantidad", o un array "productos"');
    }
    
    return TransactionManager.executeOrderTransaction(async (client) => {
        let createdClient;
        let processedProducts = [];
        let createdOrders = [];
        let totalOrderValue = 0;
        
        try {
            // Step 1: Create or verify client
            console.log('1. Verificando/creando cliente...');
            createdClient = await clienteDAO.createClient(cliente, client);
            console.log(`[OK] Cliente procesado: ${createdClient.nombre} (ID: ${createdClient.id})`);
            
            // Step 2: Process each product
            console.log(`2. Procesando ${productItems.length} producto(s)...`);
            
            for (let i = 0; i < productItems.length; i++) {
                const { producto: productName, cantidad: qty } = productItems[i];
                console.log(`   2.${i+1}. Verificando producto: ${productName}`);
                
                // Find product
                const foundProduct = await inventarioDAO.getProductByName(productName, client);
                if (!foundProduct) {
                    throw new Error(`Producto "${productName}" no encontrado en inventario`);
                }
                
                // Check stock
                const hasStock = await inventarioDAO.checkStock(foundProduct.id, qty, client);
                if (!hasStock) {
                    throw new Error(`Stock insuficiente para "${productName}". Stock actual: ${foundProduct.stock}, solicitado: ${qty}`);
                }
                
                console.log(`   [OK] ${productName}: Stock ${foundProduct.stock} >= ${qty} solicitado`);
                processedProducts.push({ ...foundProduct, cantidadPedida: qty });
            }
            
            // Simulate error for testing ROLLBACK (if requested)
            if (simulateError) {
                console.log('[WARNING] Simulando error para prueba de ROLLBACK...');
                forceError('Error simulado: Problema en el sistema de pagos');
            }
            
            // Step 3: Create orders and update inventory
            console.log('3. Creando pedidos y actualizando inventario...');
            
            for (let i = 0; i < processedProducts.length; i++) {
                const product = processedProducts[i];
                
                // Create order
                const orderInfo = {
                    cliente_id: createdClient.id,
                    producto_id: product.id,
                    cantidad: product.cantidadPedida,
                    precio_unitario: product.precio
                };
                
                const createdOrder = await pedidoDAO.createOrder(orderInfo, client);
                console.log(`   [OK] Pedido ${i+1}: ${product.producto} x${product.cantidadPedida} = $${createdOrder.total}`);
                
                // Update inventory
                const updatedProduct = await inventarioDAO.updateStock(product.id, product.cantidadPedida, client);
                console.log(`   [OK] Stock actualizado: ${updatedProduct.producto} (${product.stock} -> ${updatedProduct.stock})`);
                
                createdOrders.push(createdOrder);
                totalOrderValue += parseFloat(createdOrder.total);
                
                // Update processed product with new stock
                processedProducts[i] = { ...product, nuevoStock: updatedProduct.stock };
            }
            
            // Return complete transaction result
            return {
                cliente: createdClient,
                productos: processedProducts,
                pedidos: createdOrders,
                resumen: {
                    cliente_nombre: createdClient.nombre,
                    total_productos: processedProducts.length,
                    total_pedidos: createdOrders.length,
                    valor_total: totalOrderValue.toFixed(2),
                    productos_detalle: processedProducts.map(p => ({
                        producto: p.producto,
                        cantidad: p.cantidadPedida,
                        precio_unitario: p.precio,
                        subtotal: (p.precio * p.cantidadPedida).toFixed(2),
                        stock_anterior: p.stock,
                        stock_nuevo: p.nuevoStock
                    }))
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