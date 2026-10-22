# Zenix Escáner

Escáner de documentos que corre entero en el navegador. Apuntás la cámara a una hoja y la detecta en vivo; si te quedás quieto, dispara solo. Endereza la perspectiva con la proporción real de la hoja, saca las sombras y deja el fondo blanco. Arma un PDF de varias páginas. Las fotos no salen del dispositivo.

**Demo:** https://josenunezapps.github.io/DLupita/zenix-escaner/ (en PC, probá "Probar con una foto de ejemplo")

## Cómo funciona (todo escrito a mano, sin librerías)

- **Detección de la hoja** (`js/vision.js`): tres métodos en paralelo sobre una imagen de 256 px (umbral de Otsu por brillo, regiones separadas por bordes de Sobel, y relleno del fondo desde el marco de la foto); cada candidato pasa por casco convexo → cuadrilátero de área máxima y se puntúa.
- **Refinamiento subpíxel**: para cada lado busca el escalón de brillo más externo a lo largo de la normal, ajusta una recta robusta y recalcula las esquinas como intersecciones. Error medido: 1–2 px sobre fotos de 1600 px.
- **Proporción real**: recupera la distancia focal desde los puntos de fuga (método de Zhang y He) para que una A4 salga A4 (0,709 medido vs 0,707 real).
- **Enderezado**: homografía por eliminación gaussiana + muestreo bilineal.
- **Limpieza**: estima la iluminación del papel (máximo local + suavizado) y divide por ella; filtros Mejorado, Grises y Blanco y negro.
- **PDF** (`js/pdf.js`): generador PDF 1.4 propio, una imagen JPEG por página, A4 cuando la proporción coincide.

## La app

Cámara con contorno en vivo, disparo automático y linterna; importar desde la galería; editor de esquinas con lupa (también con teclado); filtros con vista previa; girar, reordenar y borrar páginas; documentos guardados en IndexedDB; compartir el PDF (WhatsApp, mail) o descargarlo; instalable y sin conexión.
