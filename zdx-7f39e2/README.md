# Zenix Delivery — Prototipo funcional (v0.1)

Plataforma de demostración para comercios, compradores, repartidores y administración Zenix AR.

## Ejecutar

No requiere instalar dependencias ni configurar claves.

```bash
cd zenix-delivery
python -m http.server 8080
```

Abrir `http://localhost:8080` desde el navegador. También se puede abrir `index.html` directamente (algunas capacidades del navegador requieren servidor local).

## Qué funciona en esta demo

- Navegación entre los cuatro paneles.
- Catálogo con categorías, búsqueda, visibilidad y modificación de precios.
- Carrito y creación de pedidos con dirección escrita.
- Captura opcional de coordenadas GPS del **cliente**, sujeta al permiso del navegador.
- Gestión de estados de pedidos desde el comercio.
- Asignación o toma de pedidos por repartidores; solo un pedido activo por conductor en el prototipo.
- Apertura de la ruta al destino en Google Maps.
- Confirmación de entrega por conductor o cliente y acreditación de puntos al finalizar.
- Información de actividad y resumen SaaS de ejemplo.
- Persistencia en localStorage del navegador.

## Limitaciones deliberadas

**NO ES UN SISTEMA DE PRODUCCIÓN.** No hay autenticación real ni autorización por roles; el selector de roles es solo para demostración. No existe comunicación entre dispositivos, seguimiento GPS de repartidores en vivo, pasarela de pagos, planes cobrables, ni datos seguros de clientes. Las operaciones de asignación no son transaccionales entre dispositivos. No usar con datos personales reales ni aceptar pedidos públicos.

El archivo `db/schema-inicial.sql` es un borrador de base de datos **no ejecutado y pendiente de validación**. La implementación de negocio definitiva necesita servidor, roles seguros, consultas con RLS, tests de integridad y protección de datos.

## Estructura

- `index.html`: punto de entrada.
- `app/main.js`: flujos del prototipo.
- `app/styles.css`: interfaz responsive.
- `manifest.webmanifest`: metadatos de instalación PWA (sin service worker/offline).
- `db/schema-inicial.sql`: diseño preliminar SQL.
- `docs/arquitectura.md`: fases hacia producción.

## Próximos hitos

1. Dividir el prototipo en módulos con frontend React + TypeScript y suite de pruebas.
2. Crear backend seguro (Supabase/PostgreSQL y/o API Workers) y autenticación real.
3. Implementar multiempresa, roles, migraciones, políticas RLS y estados transaccionales.
4. Integrar delivery con actualizaciones entre dispositivos y estados auditables.
5. Integrar GPS en tiempo real con consentimiento y controles de retención.
6. Conectar puntos transaccionales, cobros, planes, monitoreo y backups.
7. Realizar pruebas en dispositivos y piloto controlado.
