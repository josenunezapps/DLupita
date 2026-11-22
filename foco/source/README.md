# FOCO — versión GitHub Pages

Aplicación de análisis para YouTube, TikTok e Instagram. Carpeta independiente: no modifica la portada ni otros proyectos del repositorio.

La web publicada está en `foco/index.html`. El código editable está en `foco/source/`.

## Compilar

Dentro de `source`: `npm install` y `npm run build`. Copiar el contenido de `dist/` al directorio `foco/`.

## Conexiones

- YouTube: API key propia de YouTube Data API v3. Búsqueda por nombre (elección de canal), @handle o enlace de perfil. Muestra combinada de hasta 50 videos populares y 50 recientes.
- TikTok e Instagram: token personal Apify para los actores clockworks/tiktok-scraper y apify/instagram-scraper. Hasta 50 publicaciones recientes. Cada consulta puede generar cargos.
- Diagnóstico: clave propia OpenAI API con saldo. gpt-4.1-mini recibe metadatos, hasta seis imágenes y transcripciones agregadas manualmente.

GitHub Pages no ejecuta el servidor original. Esta edición realiza las solicitudes directamente desde el navegador a los proveedores. Las claves sólo permanecen en memoria durante la sesión: no se incluyen en el repositorio, localStorage ni informes. Los informes se guardan en localStorage; no contienen claves.

La disponibilidad depende de las credenciales, cuotas, políticas CORS y permisos de cada proveedor. No se utiliza ningún proxy externo ni se eluden restricciones. Si un proveedor rechaza llamadas de navegador, requiere un backend propio para esa integración.

La demostración contiene datos ficticios explícitamente identificados. No se deducen CTR, retención ni ingresos privados. La app no reproduce automáticamente videos: el estudio de contenido interno requiere transcripción. Ranking limitado a la muestra recuperada.

## Validación

Compilación Vite verificada. Consultas reales pendientes de credenciales del usuario.
