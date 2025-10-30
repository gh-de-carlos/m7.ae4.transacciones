/**
 * Cliente Data Access Object
 * Handles all database operations related to clients
 */

/**
 * Create or validate client with proper email/name logic
 * @param {Object} client - Client data
 * @param {string} client.nombre - Client name
 * @param {string} client.email - Client email
 * @param {string} client.telefono - Client phone
 * @param {string} client.direccion - Client address
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Created or existing client data
 */
export const createClient = async (client, dbClient) => {
    const { nombre, email, telefono, direccion } = client;
    
    // First check if email already exists
    const existingClient = await getClientByEmail(email, dbClient);
    
    if (existingClient) {
        // Email exists - check if name matches
        if (existingClient.nombre !== nombre) {
            throw new Error(`Email ${email} ya existe con diferente nombre: "${existingClient.nombre}". Se esperaba: "${nombre}"`);
        }
        
        // Email and name match - return existing client
        console.log(`[INFO] Cliente existente encontrado: ${existingClient.nombre} (${email})`);
        return existingClient;
    }
    
    // New email and name - create new client
    const query = `
        INSERT INTO clientes (nombre, email, telefono, direccion)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    
    const values = [nombre, email, telefono, direccion];
    
    try {
        const result = await dbClient.query(query, values);
        return result.rows[0];
    } catch (error) {
        throw new Error(`Error creando cliente: ${error.message}`);
    }
};

/**
 * Get client by ID
 * @param {number} clientId - Client ID
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object|null>} Client data or null if not found
 */
export const getClientById = async (clientId, dbClient) => {
    const query = 'SELECT * FROM clientes WHERE id = $1';
    
    try {
        const result = await dbClient.query(query, [clientId]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error(`Error obteniendo cliente: ${error.message}`);
    }
};

/**
 * Get client by email
 * @param {string} email - Client email
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object|null>} Client data or null if not found
 */
export const getClientByEmail = async (email, dbClient) => {
    const query = 'SELECT * FROM clientes WHERE email = $1';
    
    try {
        const result = await dbClient.query(query, [email]);
        return result.rows[0] || null;
    } catch (error) {
        throw new Error(`Error obteniendo cliente por email: ${error.message}`);
    }
};

/**
 * Get all clients
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Array>} Array of clients
 */
export const getAllClients = async (dbClient) => {
    const query = 'SELECT * FROM clientes ORDER BY fecha_creacion DESC';
    
    try {
        const result = await dbClient.query(query);
        return result.rows;
    } catch (error) {
        throw new Error(`Error obteniendo clientes: ${error.message}`);
    }
};

/**
 * Update client
 * @param {number} clientId - Client ID
 * @param {Object} updates - Fields to update
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<Object>} Updated client data
 */
export const updateClient = async (clientId, updates, dbClient) => {
    const fields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`);
    const query = `
        UPDATE clientes 
        SET ${fields.join(', ')}
        WHERE id = $1
        RETURNING *
    `;
    
    const values = [clientId, ...Object.values(updates)];
    
    try {
        const result = await dbClient.query(query, values);
        if (result.rows.length === 0) {
            throw new Error(`Cliente con ID ${clientId} no encontrado`);
        }
        return result.rows[0];
    } catch (error) {
        throw new Error(`Error actualizando cliente: ${error.message}`);
    }
};

/**
 * Delete client
 * @param {number} clientId - Client ID
 * @param {Object} dbClient - Database client for transaction
 * @returns {Promise<boolean>} True if deleted successfully
 */
export const deleteClient = async (clientId, dbClient) => {
    const query = 'DELETE FROM clientes WHERE id = $1';
    
    try {
        const result = await dbClient.query(query, [clientId]);
        return result.rowCount > 0;
    } catch (error) {
        throw new Error(`Error eliminando cliente: ${error.message}`);
    }
};