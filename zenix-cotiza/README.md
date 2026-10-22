# Zenix Cotiza

Presupuestos profesionales para agencias, oficios y comercios. Se arman en minutos, se envían por WhatsApp con un link y el cliente los acepta desde el celular. No necesita servidor ni cuentas.

**Demo:** https://josenunezapps.github.io/DLupita/zenix-cotiza/

## Qué hace

- **Editor con vista previa A4 en vivo**: ítems con cantidad, unidad, bonificación e IVA por línea; autocompletado desde el catálogo; descuento general; guardado automático.
- **IVA argentino**: Responsable Inscripto discrimina IVA por alícuota (21 %, 10,5 %, 27 %); Monotributista y Exento muestran precios finales. Total en letras ("Son pesos…").
- **PDF**: impresión a A4 exacto, lista para enviar o firmar.
- **Link para el cliente**: el presupuesto completo viaja comprimido dentro del link. El cliente lo ve en el celular, lo descarga y lo **acepta con un toque por WhatsApp**. Si venció, el botón pide una actualización.
- **Seguimiento**: estados (borrador, enviado, aceptado, rechazado, vencido automático), historial, duplicar.
- **Tablero**: presupuestado y ganado del mes, tasa de cierre, monto en juego, por vencer, últimos 6 meses, mejores clientes.
- **Clientes y catálogo**, exportación CSV, respaldo JSON, logo y color de marca propios, modo oscuro, instalable y sin conexión.

## Técnica

HTML, CSS y JavaScript con módulos ES. Sin frameworks, dependencias ni compilación. Datos en `localStorage`; los links usan `CompressionStream` (deflate) + base64url.

```
js/app.js     shell, rutas y vistas
js/store.js   estado, cálculo de IVA/totales, estados y vencimientos
js/doc.js     documento A4 (editor, link público e impresión)
js/util.js    formato es-AR, número a letras, links compartibles
js/charts.js  gráfico de barras agrupadas en SVG
js/seed.js    demo: Zenix AR cotizando a comercios ficticios de Ushuaia
```

Hecho por Zenix AR — Soluciones Digitales.
