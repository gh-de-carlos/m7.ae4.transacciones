# M7 AE4 - Practicando transacciones SQL en Node con `pg`

# Contexto

El propósito de esta actividad es que el alumno aplique el control de transacciones en PostgreSQL desde un programa en Node.js usando el paquete `pg`, entendiendo cómo y cuándo usar `BEGIN`, `COMMIT` y `ROLLBACK`, así como los principios de integridad, atomicidad y manejo de errores.

## Instrucciones

1. Crea un programa en Node.js que realice operaciones transaccionales sobre una base de datos PostgreSQL.
2. Debes implementar un flujo que simule una situación real donde múltiples operaciones se ejecutan como parte de una misma transacción.
3. Controla y captura errores, incluyendo errores intencionales para probar el ROLLBACK.

## Supuesto del ejercicio

Supón que estás trabajando con una base de datos de ~~banco~~ o tienda. Vas a realizar una transacción compuesta que incluya:

- Crear un nuevo cliente.
- Registrar un nuevo pedido para ese cliente.
- Actualizar el inventario restando las unidades pedidas.

## Requisitos

- Conexión mediante `pool.connect()` y uso del `client` para ejecutar transacciones.
- Uso explícito de las instrucciones: `BEGIN`, `COMMIT`, `ROLLBACK`.
- Simular un error intermedio (ej. clave inexistente en inventario) para probar el `ROLLBACK`.
- Mostrar en consola si la transacción se completó o fue revertida.
- Capturar errores y mostrar mensajes específicos.
- Asegurarse de liberar el `client` en todos los casos (`finally`).

## API Endpoints

La aplicación expone los siguientes endpoints REST para interactuar con el sistema de transacciones:

### **Documentación y Estado**
- `GET /` - Documentación de la API y endpoints disponibles
- `GET /health` - Estado del sistema y conectividad de la base de datos

### **Gestión de Pedidos**
- `POST /api/orders` - Crear nuevo pedido con transacción completa
- `GET /api/orders` - Listar todos los pedidos procesados

### **Consultas de Inventario**
- `GET /api/inventory` - Mostrar inventario actual con stock disponible
- `GET /api/customers` - Listar todos los clientes registrados

### **Suite de Pruebas**
- `POST /tests/run` - Ejecutar suite completa de pruebas de transacciones
- `POST /tests/quick` - Ejecutar prueba rápida de transacción individual

### **Ejemplo de Uso**

```bash
# Iniciar servidor
npm start

# Crear un pedido con un solo producto
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": {
      "nombre": "Juan Pérez",
      "email": "juan@email.com"
    },
    "producto": "Laptop Gaming",
    "cantidad": 1
  }'

# Crear un pedido con múltiples productos
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": {
      "nombre": "María González",
      "email": "maria@email.com"
    },
    "productos": [
      {
        "producto": "Mouse Inalámbrico",
        "cantidad": 2
      },
      {
        "producto": "Teclado Mecánico",
        "cantidad": 1
      },
      {
        "producto": "Monitor 4K",
        "cantidad": 1
      }
    ]
  }'

# Verificar inventario
curl http://localhost:3000/api/inventory

# Ejecutar pruebas completas
curl -X POST http://localhost:3000/tests/run
```

**Características principales:**
- Control de transacciones ACID (BEGIN/COMMIT/ROLLBACK)
- Validación de stock y unicidad de emails
- Manejo robusto de errores con rollback automático
- Salida de consola estilo ASCII clásico