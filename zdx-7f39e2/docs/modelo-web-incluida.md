# Zenix Web + Core: producto integrado

## Oferta

El abono mensual incluye una página web adaptable a la identidad de cada comercio, alojamiento administrado, un panel para editar contenidos y productos y los módulos del plan. Los límites y precios todavía son propuestas que deben validarse por rubro y por consumo de mapas, imágenes y soporte.

- **Zenix Web Comercio**: web personalizada de plantilla, dominio o subdominio configurable, productos, pedidos, promociones, puntos, soporte.
- **Zenix Web Delivery**: todo lo anterior, repartidores, asignaciones, rutas y seguimiento GPS autorizado.
- **Zenix Web Business**: varias sucursales, roles, reportes, automatizaciones y funciones avanzadas.

El dominio personalizado se sujeta a titularidad, disponibilidad y renovación; no está incluido de forma indefinida por defecto. Cambios de diseño fuera de la plantilla, migraciones complicadas e integraciones con servicios externos se cotizan por separado.

## Modelo de datos conceptual

`tenants` -> `site_settings` -> `site_pages` / `site_sections` / `media_assets`
`tenants` -> `products` -> `orders` -> `order_items` -> `deliveries` -> `driver_locations`
`tenants` -> `customers` -> `loyalty_ledger`
`tenants` -> `memberships` / `subscription`

Todas las tablas de comercio incluyen `tenant_id` y referencias verificadas del mismo comercio. Ninguna función del navegador debe guardar credenciales de administración ni secretos de backend.

## Cómo se refleja un cambio

1. El dueño inicia sesión en Zenix Core, con permisos `owner` o `manager`.
2. Edita información de la web, productos y precios.
3. El backend valida la edición y la guarda en la base central bajo su `tenant_id`.
4. La web pública del comercio obtiene la información publicada del mismo `tenant_id`.
5. Los pedidos se crean con precios verificados por el servidor; una transacción guarda ítems y total.
6. Los repartidores y los clientes acceden solo a sus entregas y pedidos autorizados.

## Dominios

Los clientes nunca tienen que ver `zenix.com.ar` salvo que se use explícitamente un subdominio. Puede haber dominios personalizados (`mipizzeria.com.ar`) que apunten al mismo frontend multiempresa. El backend determina el tenant por dominio o identificador validado, nunca por un valor arbitrario entregado por el navegador.

## Integración de una web existente

Se mantiene como ruta secundaria: una API autenticada, componente embebido o conector de plataforma puede integrar un sitio externo, pero la oferta principal será **web incluida**, para garantizar consistencia de diseño, datos y mantenimiento.

## Decisiones de seguridad

- Rutas de administración privadas con autenticación real. La URL oculta nunca sustituye contraseñas.
- Cuatro tipos de cuenta: clientes, empleados/dueños, repartidores y operación Zenix AR.
- RLS por tenant y permisos en backend; publicación de contenido público en endpoints de lectura limitados.
- Auditoría de ajustes de precios y movimientos de puntos; confirmación dual de entregas.
- GPS solo durante actividad autorizada, informar precisión y último reporte, revocación y retención limitada.
- Monitorear consumos de mapas y operaciones de backend; establecer alertas presupuestarias.

## Próximo bloque de implementación

Reemplazar `localStorage` por API y base reales para el primer comercio, con autenticación de dueño y permisos. Migrar editor, productos, media y pedidos, probar dos navegadores y bloquear las rutas de gestión para visitantes. Recién entonces iniciar pruebas de usuarios reales.
