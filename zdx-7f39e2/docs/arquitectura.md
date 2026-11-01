# Arquitectura objetivo — Zenix Delivery

## Roles

- **Cliente:** catálogo público, pedidos y datos propios, puntos y confirmación de recepción.
- **Comercio:** catálogo, empleados, pedidos, repartidores y reportes de su propio `business_id`.
- **Repartidor:** pedidos disponibles/asignados y reporte de ubicación durante el reparto autorizado.
- **Zenix AR:** administración de altas comerciales, planes y soporte auditable, sin acceso indiscriminado a ubicaciones personales.

## Regla multiempresa

Todas las entidades comerciales deben portar `business_id`. Ninguna petición puede autorizarse por identificadores recibidos del navegador sin comprobar la membresía y el rol real. Políticas RLS y comprobaciones del backend deben proteger datos y operaciones.

## Reglas de negocio críticas

- Precio, productos, costos y puntos se calculan del lado servidor usando versiones/snapshots de pedido.
- La toma de pedidos requiere transacción atómica, para evitar doble asignación.
- El estado de un pedido se modifica mediante transiciones autorizadas y registradas.
- Acreditar puntos una única vez al completar una venta válida; reversiones en cancelación/reembolso.
- Ubicación del repartidor solo con consentimiento, durante turnos/entregas, y con caducidad de muestras.
- Cliente ve únicamente el recorrido de su entrega activa; no otros repartidores.
- La dirección geocodificada debe confirmarse; coordenadas del cliente no equivalen a domicilio válido.
- Cobros recurrentes necesitan proveedor, conciliación, facturas y manejo de fallas.

## Arquitectura prevista

Frontend responsive (React/TypeScript en la siguiente iteración) → backend API con autenticación → PostgreSQL/Supabase con RLS → canales de eventos autenticados → mapas/ruteo con proveedor comercial compatible → facturación y observabilidad.

**Estado:** solamente prototipo web local, sin backend ni despliegue.
