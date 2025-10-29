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