# Remarca

Carteles de oferta, etiquetas de góndola y remarcado de precios para comercios chicos
(almacenes, kioscos, dietéticas, ferreterías). Se cargan los productos una vez y de ahí sale todo.
Corre entero en el navegador: sin servidor, sin cuentas, sin librerías externas y sin compilación.

**Abrir:** https://josenunezapps.github.io/DLupita/remarca-4t7m/

## Qué resuelve

- **Remarcar en bloque.** Sube o baja un porcentaje a todos los productos, a una categoría o a los
  elegidos, con redondeo (a $ 10, $ 50, $ 100, terminados en 90 o 99) y vista previa del antes y el
  después. Guarda el precio anterior y se deshace con un toque.
- **Imprimir sólo lo que cambió.** Cada cambio de precio deja la etiqueta «sin imprimir». Las hojas
  A4 salen en milímetros reales (24, 10 o 6 por hoja) con código de barras EAN-13 vectorial.
- **Carteles para WhatsApp e Instagram.** Cuatro estilos, tres formatos (historia 1080×1920,
  publicación 1080×1080, hoja A4), con la letra ajustada sola al espacio. Se descargan como PNG, se
  comparten con el menú del teléfono, o se bajan todas las ofertas juntas en un .zip.
- **Importar la lista del proveedor.** Se pega desde Excel o se elige un CSV; los productos que ya
  estaban actualizan su precio y sólo esos quedan pendientes de imprimir.
- **Identidad del negocio.** Nombre, colores y logo aplicados a todo.
- Búsqueda (`oferta`, `pendiente`, `>3000`), filtros, orden, selección múltiple, paleta de comandos
  (Ctrl K), atajos, deshacer y rehacer, tema claro y oscuro, celular y escritorio.

## Código

```
index.html, css/app.css
js/core/        lógica pura, sin DOM (se prueba con Node)
  money.js      lectura y formato de pesos, reglas de redondeo
  products.js   productos, validación, remarcado, búsqueda, fusión de listas
  csv.js        lectura tolerante de CSV y exportación
  ean.js        EAN-13: dígito verificador y barras
  zip.js        empaquetador ZIP con CRC-32
  fit.js        ajuste de texto a una caja
  persist.js    guardado local y copias de seguridad
  store.js      estado e historial
  demo.js       almacén de ejemplo
js/ui/          vistas, motor de carteles (canvas), diálogos, paleta
js/main.js      acciones, atajos y sincronización
tests/          pruebas
```

## Pruebas

```
npm test            # 16 pruebas del núcleo (Node 20+, sin dependencias)
npm run test:e2e    # 18 pruebas en Chrome real con Playwright, escritorio y celular
```

Las de navegador verifican, entre otras cosas, que los PNG tengan el tamaño declarado, que el .zip
abra con otro programa y que la impresión genere un PDF A4 con una página por hoja.

## Límites

- **Guardado:** `localStorage` del navegador. No se sincroniza entre dispositivos y se pierde si se
  borran los datos del sitio. «Guardar una copia» exporta todo a un archivo.
- **Un solo negocio por navegador,** hasta 3.000 productos.
- **Tipografías:** usa las del dispositivo (no descarga fuentes), así que la letra de los carteles
  cambia un poco entre teléfonos y computadoras.
- **Impresión:** depende del cuadro de impresión del navegador; hay que elegir A4, escala 100 % y sin
  márgenes. No se probó contra planchas autoadhesivas troqueladas de una marca en particular.
- **Datos de ejemplo:** el almacén inicial es inventado y está rotulado como ejemplo.
- La ruta no está enlazada pero es pública.
