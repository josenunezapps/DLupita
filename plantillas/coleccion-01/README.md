# Colección 01 — 9 plantillas web para negocios

**Catálogo:** https://josenunezapps.github.io/DLupita/plantillas/coleccion-01/

Esta carpeta es independiente de la página principal y de las demás demos del repositorio.

## Cinco páginas web

| Carpeta | Modelo | Funciones |
| --- | --- | --- |
| `marea-restaurante/` | Marea — restaurante | Hero editorial, propuesta gastronómica, menú de experiencias, formulario demostrativo |
| `aura-bienestar/` | Aura — centro de bienestar | Tratamientos, presentación, consulta demostrativa |
| `forma-arquitectura/` | Forma — arquitectura | Portfolio de proyectos, servicios, consulta demostrativa |
| `casa-nomada-hotel/` | Casa Nómada — hotel | Habitaciones, beneficios, consulta de estadía demostrativa |
| `vertice-automotor/` | Vértice — servicios automotores | Servicios, presentación, formulario demostrativo |

Los formularios de estas cinco páginas **no envían ni almacenan solicitudes**. Muestran una confirmación local explicando que son demostraciones.

## Cuatro aplicaciones web

| Carpeta | Modelo | Funciones ya implementadas |
| --- | --- | --- |
| `mercato-catalogo/` | Mercato | Búsqueda, filtros, carrito, cantidades, copiar pedido |
| `flujo-pedidos/` | Flujo | Kanban; crear, avanzar, reabrir y borrar pedidos; indicadores |
| `nexo-inventario/` | Nexo Stock | Crear/eliminar productos, modificar cantidades, detectar bajo stock, exportar CSV |
| `cotiza-presupuestos/` | Cotiza | Ítems, cantidades, precios, descuentos, IVA opcional, guardar/reabrir, copiar e imprimir/PDF |

Los datos de las cuatro apps se guardan **exclusivamente en localStorage** del navegador, bajo claves diferentes, con información ficticia inicial cuando corresponda. Esto permite probarlas sin alojamiento de backend ni claves de API. **No es persistencia multiusuario ni apta para producción.** Para una venta a un cliente se debe implementar autenticación, permisos, base de datos, validación en servidor y demás integraciones necesarias.

## Archivos comunes

- `assets/common.css`: diseño responsive, estilos por marca, componentes de dashboard y catálogo.
- `assets/app.js`: persistencia local, mensajes, formato monetario en ARS, copia de texto, exportación, menús, paneles y modales.
- `index.html`: catálogo con filtros y búsqueda.

Cada demo tiene `index.html` propio. Las imágenes de los sitios de presentación se cargan de Unsplash; las tipografías se cargan de Google Fonts. Si esos servicios externos no responden, se usan fondos y tipografías de respaldo.

## Personalización

1. Abrir la carpeta de la plantilla elegida.
2. Cambiar la marca, textos, imágenes y contenido en su `index.html`.
3. Ajustar la identidad visual cambiando colores y estilos en `assets/common.css` o agregando reglas específicas.
4. En apps, reemplazar el guardado local de prueba por la base de datos y API del negocio.
5. Configurar formularios y envío real, controles de acceso y las integraciones que el negocio necesite.
6. Probar con datos reales, revisar accesibilidad, seguridad, SEO, leyes locales y políticas de privacidad antes de publicar para un cliente.

## Pruebas históricas de la colección original

- Creación de 10 rutas independientes en GitHub Pages y comprobación de respuesta de las 10.
- Comprobación de carga del catálogo y de ambos archivos compartidos.
- Verificación sintáctica de los scripts principales de las 5 apps.
- Chequeo estático de referencias a elementos `id` en las 5 apps.

**Las verificaciones indicadas arriba pertenecen a la colección original de diez plantillas. Después de retirar una plantilla quedan nueve. No se realizaron pruebas nuevas de extremo a extremo de todas las aplicaciones.**

## Licencias y uso comercial

Los nombres de negocio y textos son ficticios. Las fotografías se usan como referencias ilustrativas; revisar licencias y seleccionar imágenes del cliente o propias para uso comercial. No se declaran asociaciones comerciales reales.

