/**
 * Pedido Data Access Object
 * Handles all database operations related to orders
 */

/**
 * Create a new order
 * @param {Object} order - Order data
 * @param {number} order.cliente_id - Client ID
 * @param {number} order.producto_id - Product ID
 * @param {number} order.cantidad - Quantity ordered
 * @param {number} order.precio_unitario - Unit price
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Created order data
 */
export const createOrder = async (order, dbClient) => {
    const { cliente_id, producto_id, cantidad, precio_unitario } = order;
    const total = cantidad * precio_unitario;
    
    const query = `
        INSERT INTO pedidos (cliente_id, producto_id, cantidad, precio_unitario, total)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const values = [cliente_id, producto_id, cantidad, precio_unitario, total];
    
    try {
        const result = await dbClient.query(query, values);
        return result.rows[0];
    } catch (error) {
        if (error.code === '23503') { // Foreign key violation
            if (error.detail.includes('clientes')) {
                throw new Error(`Cliente con ID ${cliente_id} no encontrado`);
            }
            if (error.detail.includes('inventario')) {
                throw new Error(`Producto con ID ${producto_id} no encontrado`);
            }
        }
        throw new Error(`Error creando pedido: ${error.message}`);
    }
};

/**
 * Get order by ID
 * @param {number} orderId - Order ID
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object|null>} Order data or null if not found
 */
export const getOrderById = async (orderId, dbClient) => {
    const query = `
        SELECT 
            p.*,
            c.nombre as cliente_nombre,
            c.email as cliente_email,
            i.producto as producto_nombre,
            i.descripcion as producto_descripcion
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        JOIN inventario i ON p.producto_id = i.id
        WHERE p.id = $1
    `;
    
    try {
        const result = await dbClient.query(query, [orderId]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error(`Error obteniendo pedido: ${error.message}`);
    }
};

/**
 * Get orders by client ID
 * @param {number} clientId - Client ID
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Array>} Array of orders
 */
export const getOrdersByClientId = async (clientId, dbClient) => {
    const query = `
        SELECT 
            p.*,
            i.producto as producto_nombre,
            i.descripcion as producto_descripcion
        FROM pedidos p
        JOIN inventario i ON p.producto_id = i.id
        WHERE p.cliente_id = $1
        ORDER BY p.fecha_pedido DESC
    `;
    
    try {
        const result = await dbClient.query(query, [clientId]);
        return result.rows;
    } catch (error) {
        throw new Error(`Error obteniendo pedidos del cliente: ${error.message}`);
    }
};

/**
 * Get all orders with client and product details
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Array>} Array of orders with details
 */
export const getAllOrders = async (dbClient) => {
    const query = `
        SELECT 
            p.*,
            c.nombre as cliente_nombre,
            c.email as cliente_email,
            i.producto as producto_nombre,
            i.descripcion as producto_descripcion
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        JOIN inventario i ON p.producto_id = i.id
        ORDER BY p.fecha_pedido DESC
    `;
    
    try {
        const result = await dbClient.query(query);
        return result.rows;
    } catch (error) {
        throw new Error(`Error obteniendo pedidos: ${error.message}`);
    }
};

/**
 * Update order status
 * @param {number} orderId - Order ID
 * @param {string} status - New status
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Updated order data
 */
export const updateOrderStatus = async (orderId, status, dbClient) => {
    const query = `
        UPDATE pedidos 
        SET estado = $1
        WHERE id = $2
        RETURNING *
    `;
    
    try {
        const result = await dbClient.query(query, [status, orderId]);
        if (result.rows.length === 0) {
            throw new Error(`Pedido con ID ${orderId} no encontrado`);
        }
        return result.rows[0];
    } catch (error) {
        throw new Error(`Error actualizando estado del pedido: ${error.message}`);
    }
};

/**
 * Cancel order (delete)
 * @param {number} orderId - Order ID
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<boolean>} True if deleted successfully
 */
export const cancelOrder = async (orderId, dbClient) => {
    // First get order details to restore stock if needed
    const getOrderQuery = 'SELECT * FROM pedidos WHERE id = $1';
    
    try {
        const orderResult = await dbClient.query(getOrderQuery, [orderId]);
        if (orderResult.rows.length === 0) {
            throw new Error(`Pedido con ID ${orderId} no encontrado`);
        }
        
        // Delete the order
        const deleteQuery = 'DELETE FROM pedidos WHERE id = $1';
        const deleteResult = await dbClient.query(deleteQuery, [orderId]);
        
        return {
            success: deleteResult.rowCount > 0,
            order: orderResult.rows[0]
        };
    } catch (error) {
        throw new Error(`Error cancelando pedido: ${error.message}`);
    }
};

/**
 * Get orders by date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Array>} Array of orders in date range
 */
export const getOrdersByDateRange = async (startDate, endDate, dbClient) => {
    const query = `
        SELECT 
            p.*,
            c.nombre as cliente_nombre,
            c.email as cliente_email,
            i.producto as producto_nombre,
            i.descripcion as producto_descripcion
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        JOIN inventario i ON p.producto_id = i.id
        WHERE p.fecha_pedido BETWEEN $1 AND $2
        ORDER BY p.fecha_pedido DESC
    `;
    
    try {
        const result = await dbClient.query(query, [startDate, endDate]);
        return result.rows;
    } catch (error) {
        throw new Error(`Error obteniendo pedidos por rango de fecha: ${error.message}`);
    }
};

/**
 * Get order statistics
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Order statistics
 */
export const getOrderStatistics = async (dbClient) => {
    const query = `
        SELECT 
            COUNT(*) as total_pedidos,
            SUM(total) as ingresos_totales,
            AVG(total) as promedio_pedido,
            COUNT(DISTINCT cliente_id) as clientes_unicos
        FROM pedidos
    `;
    
    try {
        const result = await dbClient.query(query);
        return result.rows[0];
    } catch (error) {
        throw new Error(`Error obteniendo estadísticas de pedidos: ${error.message}`);
    }
};