/**
 * Inventario Data Access Object
 * Handles all database operations related to inventory
 */

/**
 * Get product by ID
 * @param {number} productId - Product ID
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object|null>} Product data or null if not found
 */
export const getProductById = async (productId, dbClient) => {
    const query = 'SELECT * FROM inventario WHERE id = $1';
    
    try {
        const result = await dbClient.query(query, [productId]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error(`Error obteniendo producto: ${error.message}`);
    }
};

/**
 * Get product by name
 * @param {string} productName - Product name
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object|null>} Product data or null if not found
 */
export const getProductByName = async (productName, dbClient) => {
    const query = 'SELECT * FROM inventario WHERE producto = $1';
    
    try {
        const result = await dbClient.query(query, [productName]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error(`Error obteniendo producto por nombre: ${error.message}`);
    }
};

/**
 * Get all products
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Array>} Array of products
 */
export const getAllProducts = async (dbClient) => {
    const query = 'SELECT * FROM inventario ORDER BY producto';
    
    try {
        const result = await dbClient.query(query);
        return result.rows;
    } catch (error) {
        throw new Error(`Error obteniendo productos: ${error.message}`);
    }
};

/**
 * Check if product has sufficient stock
 * @param {number} productId - Product ID
 * @param {number} quantity - Required quantity
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<boolean>} True if stock is sufficient
 */
export const checkStock = async (productId, quantity, dbClient) => {
    const query = 'SELECT stock FROM inventario WHERE id = $1';
    
    try {
        const result = await dbClient.query(query, [productId]);
        if (result.rows.length === 0) {
            throw new Error(`Producto con ID ${productId} no encontrado`);
        }
        
        const currentStock = result.rows[0].stock;
        return currentStock >= quantity;
    } catch (error) {
        throw new Error(`Error verificando stock: ${error.message}`);
    }
};

/**
 * Update product stock
 * @param {number} productId - Product ID
 * @param {number} quantity - Quantity to subtract (positive number)
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Updated product data
 */
export const updateStock = async (productId, quantity, dbClient) => {
    // First check if product exists and has sufficient stock
    const checkQuery = 'SELECT * FROM inventario WHERE id = $1';
    
    try {
        const checkResult = await dbClient.query(checkQuery, [productId]);
        if (checkResult.rows.length === 0) {
            throw new Error(`Producto con ID ${productId} no encontrado`);
        }
        
        const product = checkResult.rows[0];
        const newStock = product.stock - quantity;
        
        if (newStock < 0) {
            throw new Error(`Stock insuficiente. Stock actual: ${product.stock}, cantidad solicitada: ${quantity}`);
        }
        
        // Update stock
        const updateQuery = `
            UPDATE inventario 
            SET stock = $1, fecha_actualizacion = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
        `;
        
        const updateResult = await dbClient.query(updateQuery, [newStock, productId]);
        return updateResult.rows[0];
        
    } catch (error) {
        throw new Error(`Error actualizando stock: ${error.message}`);
    }
};

/**
 * Restore product stock (for rollback purposes)
 * @param {number} productId - Product ID
 * @param {number} quantity - Quantity to add back (positive number)
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Updated product data
 */
export const restoreStock = async (productId, quantity, dbClient) => {
    const query = `
        UPDATE inventario 
        SET stock = stock + $1, fecha_actualizacion = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
    `;
    
    try {
        const result = await dbClient.query(query, [quantity, productId]);
        if (result.rows.length === 0) {
            throw new Error(`Producto con ID ${productId} no encontrado`);
        }
        return result.rows[0];
    } catch (error) {
        throw new Error(`Error restaurando stock: ${error.message}`);
    }
};

/**
 * Get products with low stock
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Array>} Array of products with low stock
 */
export const getLowStockProducts = async (dbClient) => {
    const query = 'SELECT * FROM inventario WHERE stock <= stock_minimo ORDER BY stock ASC';
    
    try {
        const result = await dbClient.query(query);
        return result.rows;
    } catch (error) {
        throw new Error(`Error obteniendo productos con stock bajo: ${error.message}`);
    }
};

/**
 * Create new product
 * @param {Object} product - Product data
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Created product data
 */
export const createProduct = async (product, dbClient) => {
    const { producto, descripcion, precio, stock, stock_minimo } = product;
    
    const query = `
        INSERT INTO inventario (producto, descripcion, precio, stock, stock_minimo)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `;
    
    const values = [producto, descripcion, precio, stock, stock_minimo || 5];
    
    try {
        const result = await dbClient.query(query, values);
        return result.rows[0];
    } catch (error) {
        if (error.code === '23505') { // Unique violation
            throw new Error(`El producto ${producto} ya existe`);
        }
        throw new Error(`Error creando producto: ${error.message}`);
    }
};