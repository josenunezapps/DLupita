# Zenix Caja

Punto de venta para comercios (almacenes, kioscos, despensas). Funciona en el navegador del celular o la PC, se instala como app y sigue andando sin internet.

**Demo:** https://josenunezapps.github.io/DLupita/zenix-caja/

## Qué hace

- **Vender**: búsqueda instantánea, categorías, lector de código de barras USB (tipo teclado) y cámara del celular, descuentos en % o $, control de stock en el momento.
- **Cobrar**: efectivo con cálculo de vuelto y billetes rápidos, débito, crédito, transferencia y QR. Ticket imprimible en ticketera de 58/80 mm.
- **Caja**: apertura, ingresos y retiros, cierre con arqueo (total o contando billetes) y reporte de cierre.
- **Productos**: alta y edición con cálculo de margen, alertas de stock bajo, importación y exportación CSV (compatible con Excel).
- **Ventas**: historial con filtros, reimpresión, anulación con devolución automática de stock, exportación CSV.
- **Tablero**: ventas del día contra ayer, últimos 14 días, ventas por hora, medios de pago, más vendidos y productos a reponer.
- Tema claro y oscuro, atajos de teclado (F2 buscar, F9 cobrar, 1–5 medio de pago, Enter confirmar, Esc cerrar), respaldo y restauración en JSON.

## Técnica

HTML, CSS y JavaScript con módulos ES, sin frameworks ni dependencias ni paso de compilación. Gráficos SVG propios. Datos en `localStorage`; service worker para uso sin conexión.

```
index.html          punto de entrada
css/app.css         sistema visual (claro/oscuro, responsive, impresión)
js/app.js           shell, rutas y vistas
js/store.js         estado y reglas de negocio (venta, stock, caja, anulación)
js/seed.js          almacén de demostración con dos semanas de ventas
js/charts.js        barras, anillo y mini tendencia en SVG
js/util.js          formato es-AR, CSV, utilidades
sw.js               caché offline
```

Hecho por Zenix AR — Soluciones Digitales.
