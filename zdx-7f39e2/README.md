# Zenix Web + Core · MVP de integración · v0.2

## Nuevo modelo comercial

Zenix AR ofrece **un único abono mensual** que incluye: sitio web de marca para cada comercio, catálogo autogestionable, gestión de pedidos, fidelización y, según el plan, el módulo de delivery. No ofrecemos la web como producto independiente para este servicio: la web y su administrador comparten un solo origen de datos.

## Rutas dentro de la carpeta de prueba

- `index.html`: **tienda pública del comercio**, con su propia marca. No hay acceso visible a Zenix ni selector de roles.
- `gestion-demo.html`: **vista previa del administrador**; no se enlaza desde la tienda pública. **No es privada ni tiene autenticación**. No cargar datos sensibles.
- `app/core.js`: estado compartido en `localStorage` (exclusivamente una demo en el mismo navegador).
- `app/storefront.js` y `app/storefront.css`: plantilla pública adaptable a diferentes comercios.
- `app/studio.js` y `app/studio.css`: editor de web, catálogo y pedidos de prueba.
- `docs/modelo-web-incluida.md`: especificación de producto y plan técnico.

## Prueba local

```bash
python3 -m http.server 8080
```

Abrir `http://localhost:8080` y `http://localhost:8080/gestion-demo.html`. Cambiar nombre, portada o producto desde el editor y recargar la tienda. Crear un pedido en la tienda y actualizar su estado desde el editor. Todos los datos son exclusivamente locales.

## Limitaciones conocidas

El administrador demo **no tiene contraseña ni permisos**. `noindex` y una URL poco visible no sirven como seguridad. No se incluyen cobros reales, autenticación, sincronización entre dispositivos, GPS de repartidores en vivo, carga de imágenes a servidores ni suscripciones activas. La captura opcional de ubicación del comprador necesita HTTPS o localhost.

Para producción: backend autenticado, tenant_id por comercio y RLS, validación de precios y pedidos en el servidor, catálogo y CMS almacenados en base de datos, suscripciones y límites, imágenes gestionadas en Storage, interfaz de repartidor con localización autorizada, monitoreo, políticas de privacidad y dominios propios.

Esta demo está aislada de la web original del repositorio Doña Lupita y **no modifica** sus páginas públicas.
