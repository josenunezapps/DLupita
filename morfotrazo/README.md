# MORFOTRAZO — Arte que se transforma

Sitio de fondos de pantalla adaptable a escritorio y celular, ubicado **solo** en `/morfotrazo/` de este repositorio. No altera la raíz ni los otros proyectos de DLupita.

## Sitio público
https://josenunezapps.github.io/DLupita/morfotrazo/

## Diseño
- Icono principal: «M» original naranja y turquesa proporcionada por el creador.
- Portada: arte MORFOTRAZO original (mujer / ave / logo), usado en el hero.
- Colores: azul noche / negro, naranja intenso y cian.
- Diseño responsive, galería de dos columnas en móvil y seis en escritorio grande.

## Funcionalidades
- Catálogo público `data.json`, dividido en destacados y recientes.
- Búsqueda instantánea y filtros por celular, computadora y temática.
- Vista ampliada, favoritos locales y descarga del archivo de imagen.
- Publicación de JPG, PNG y WebP desde el botón **Subir imagen** (hasta 15 MB).

## Cómo publicar un fondo
Este sitio funciona sobre **GitHub Pages**, que no tiene backend. Por eso, las publicaciones están protegidas por GitHub:
1. Desde tu cuenta de GitHub, creá un **fine-grained personal access token** limitado exclusivamente al repositorio **josenunezapps/DLupita**. Permisos del repositorio: **Contents — Read and write**. No habilites más permisos de los necesarios.
2. Abrí la página y tocá **Subir imagen**.
3. Elegí el archivo, título, categoría, dispositivo y pegá tu token privado.
4. Tocá **Publicar fondo**. La web guardará el archivo dentro de `morfotrazo/imagenes/<carpeta>/` y añadirá su entrada a `morfotrazo/data.json`, además de actualizar el catálogo de la carpeta.
5. GitHub Pages publicará los cambios cuando finalice su despliegue. El token no se escribe en `localStorage`, cookies ni en el repositorio.

**Importante:** no compartas tu token en capturas ni con visitantes. Las personas que descargan **no necesitan cuenta**. Para recibir publicaciones de terceros sin darles acceso al repositorio, hace falta agregar más adelante un backend con moderación.

## Contenido de demostración
El catálogo inicial incluye imágenes de muestra de Unsplash. Reemplazalas con tu arte MORFOTRAZO; los rótulos de resolución de los ejemplos son orientativos y no representan mediciones automáticas. Los nuevos fondos cargados desde el panel se guardan con el archivo original.

## Recursos
- `index.html`: estructura y modales.
- `styles.css`: estética y responsive.
- `app.js`: búsqueda, filtros, favoritos, descargas y publicación vía GitHub.
- `data.json`: catálogo de fondos.
- `colecciones/<carpeta>/catalogo.json`: índices separados por temática con los títulos y enlaces de las obras.
- `imagenes/<carpeta>/`: lugar para los archivos que se suban desde el panel (se crea al publicar el primer archivo de esa temática).

## Carpetas / colecciones
Los fondos se organizan por: **Fantasía, Arte, Espacio, Naturaleza, Abstracto, Ciudades, Minimalista y Ciencia ficción**. También hay índices preparados para Anime y Oscuro.

Cada fondo figura en `data.json` con `category` y `folder` y tiene su referencia en `colecciones/<carpeta>/catalogo.json`.
Las colecciones se muestran como carpetas con portada y contador en la web y se pueden filtrar desde el celular o PC.

**Archivos históricos:** las 41 imágenes publicadas hasta el 22/11/2026, incluyendo las obras originales y las imágenes de muestra, siguen alojadas fuera del repositorio y se referencian desde su carpeta. No se copiaron binarios antiguos a GitHub. Las imágenes nuevas subidas desde el panel sí se guardan físicamente en `imagenes/<carpeta>/`.

## Descargas adaptadas a cada dispositivo (noviembre de 2026)
- El catálogo incluye **68 fondos**, de ellos **20 nuevas obras de vidrio/cristal** en distintas categorías.
- Cada obra permite elegir **Celular** o **Computadora** desde la vista previa.
- Resoluciones para celular: **720 × 1280, 1080 × 1920, 1440 × 2560 y 2160 × 3840**.
- Resoluciones para PC: **1366 × 768, 1920 × 1080, 2560 × 1440 y 3840 × 2160**.
- Modo **imagen completa**: compone el fondo sin estirar ni recortar la obra, con extensión desenfocada del fondo cuando cambia la proporción.
- Modo **pantalla completa**: llena el lienzo sin deformar, recortando los bordes si la proporción original difiere.
- Siempre se ofrece **archivo original** para evitar pérdida de calidad.
- El navegador crea las variantes JPG bajo demanda mediante canvas; si un alojamiento externo bloquea CORS, se intenta un servicio alternativo de transformación de imágenes.
- **Importante:** ampliar a 4K no incrementa el detalle nativo. Las nuevas ilustraciones tienen tamaño original **941 × 1672** o **1672 × 941**, según la orientación, aunque las versiones de descarga pueden tener dimensiones mayores. Las resoluciones de 4K son reescaladas.
- La creación de descargas depende de la compatibilidad del navegador y del acceso a los servidores externos. En caso de bloqueo se ofrece el archivo original y un enlace a la variante externa.

## Organización de las nuevas ilustraciones
Las obras están clasificadas en las carpetas temáticas existentes y se añadieron **Fantasía espacial** y **Blanco y negro**. La categoría **Oscuro** también contiene obras nuevas.

## Nota de infraestructura
Los dos recursos gráficos originales están referenciados desde URLs públicas de CloudFront. Para que el sitio no dependa de ese proveedor, conviene guardarlos en `morfotrazo/assets/` en una siguiente mejora. GitHub Pages es un hosting estático, sin base de datos ni almacenamiento de subidas anónimas.
