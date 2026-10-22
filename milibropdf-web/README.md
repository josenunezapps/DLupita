# MiLibroPDF Web

Tu biblioteca personal para leer, escuchar y estudiar PDF y EPUB desde cualquier dispositivo.

**Abrir la app:** https://josenunezapps.github.io/DLupita/milibropdf-web/

## Qué incluye esta versión

- **Biblioteca**: importación por selector o arrastrar y soltar, con título, autor y portada automáticos (editables). Búsqueda, filtros (Leyendo, Sin empezar, Terminados, Favoritos, PDF, EPUB, Archivados), orden y vista en cuadrícula o lista.
- **Inicio**: Continuar leyendo, actividad (hoy, semana, terminados, racha) y estante de libros.
- **Detalle de libro**: leer, escuchar, favorito, marcar como terminado, editar datos, archivar, eliminar, notas y estadísticas del libro.
- **Lector PDF** (PDF.js): desplazamiento continuo, zoom, ajuste al ancho, rotación, pantalla completa, índice, búsqueda, selección de texto y memoria de página. Los PDF escaneados se abren en modo compatibilidad (se leen, pero sin texto para seleccionar ni escuchar).
- **Lector EPUB** (epub.js): páginas o desplazamiento, índice de capítulos, búsqueda, tamaño de letra, interlineado, márgenes y tipografía.
- **Estudio**: al seleccionar texto, Copiar, Resaltar (5 colores, amarillo por defecto), Guardar fragmento, Crear nota y Escuchar desde aquí. Pantalla de notas y fragmentos con filtros, edición, borrado e "Ir al punto".
- **Texto a voz** (Web Speech API): reproducir, pausar, frase anterior/siguiente, voz y velocidad (se cambian sin perder el punto), frase actual resaltada y siempre visible, continuidad entre páginas y capítulos, temporizador de sueño (5–60 min) y controles en la pantalla de bloqueo.
- **Pantalla**: mantener encendida (Screen Wake Lock) y apagado inteligente por inactividad.
- **Temas**: claro, sepia y oscuro para leer; tema claro/oscuro/sistema para la app.
- **Estadísticas**: tiempo total, hoy, semana, mes, promedio diario, sesiones, páginas, racha, gráfico de 14 días y detalle por libro.
- **Atajos**: ← → páginas, Espacio voz, F pantalla completa, N nueva nota, Esc cerrar.
- **PWA**: instalable y usable sin conexión; los libros se guardan en IndexedDB.
- **Copia de seguridad**: exporta/importa un .zip con libros, progreso, notas, estadísticas y ajustes (sirve para pasar todo a otro dispositivo).

## Pendiente para la próxima versión

Cuentas de usuario y sincronización automática en la nube (Supabase: auth, PostgreSQL y storage). El modelo de datos local ya sigue las tablas del resumen maestro (books, marks = notes/highlights/fragments, sessions, settings) para facilitar esa migración.

## Estructura

Sin paso de compilación: HTML + CSS + módulos JavaScript, con PDF.js 3.2, epub.js y JSZip incluidos en `vendor/`.

```
index.html, manifest.webmanifest, sw.js
css/app.css
js/app.js          arranque y rutas
js/views.js        Inicio, Biblioteca, Detalle, Notas, Estadísticas, Configuración
js/reader.js       pantalla de lectura, selección, voz, sesiones
js/pdf-engine.js   lector PDF
js/epub-engine.js  lector EPUB
js/tts.js          texto a voz
js/db.js, importer.js, marks.js, stats.js, backup.js, util.js
```

Para probarla en local: `python3 -m http.server` en esta carpeta y abrir `http://localhost:8000`.
