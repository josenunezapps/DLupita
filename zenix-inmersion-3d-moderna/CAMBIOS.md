# Zenix AR — Rediseño 3D cinematográfico y ultramoderno

Evolución de `zenix-inmersion-cinematica-correccion-fina` (esa versión no se modificó). Se mantienen: nombre e identidad Zenix AR,
logo hexagonal violeta original, recorrido 3D por scroll en seis capítulos, botón «Hablemos por WhatsApp» (https://wa.me/5492901471353),
compatibilidad móvil y alternativa sin WebGL.

## Qué cambió

**Dirección de arte.** Se eliminó el lenguaje retro (hexágonos gigantes repetidos, neón, rejillas luminosas, paneles flotantes, el mismo túnel
en cada escena). Paleta: negro profundo, grafito, blanco para jerarquía y violeta solo como acento/identidad; cian casi sin uso.

**Seis espacios distintos** (cada uno con su arquitectura, luz y materiales):
1. *Entrada* — monolito arquitectónico nocturno; la luz interior se filtra por la rendija de la puerta y se abre con el scroll.
2. *Estación de desarrollo* — estudio realista con monitores físicos, código, terminal, vista previa del sitio y actividad del repositorio.
3. *Procesamiento* — nave industrial con cinta, compilador, brazos robóticos (cinemática inversa) y una app ensamblada.
4. *Análisis* — sala circular con óculo; gráficos como esculturas físicas (columnas de vidrio, cinta de aluminio, anillo seccionado, KPIs con conteo). **Datos rotulados como demostración.**
5. *Sistemas conectados* — sala de servidores: racks con puertas perforadas, bandejas de cables, compuerta de API, tubos neumáticos de cristal con peticiones, bloque de bases de datos en recintos de vidrio y cámara acorazada de autenticación que se abre hacia el final.
6. *Final* — gran vestíbulo de piedra pulida, columnas monolíticas, óculo y el logo hexagonal violeta que se revela progresivamente. Textos: «ZENIX AR — SOLUCIONES DIGITALES», «Hagamos realidad tu proyecto», botón de WhatsApp.

**Materiales y luz.** PBR con mapas de normales/rugosidad procedurales, entornos de reflejo propios por espacio, tone mapping neutro (Khronos PBR Neutral),
luces físicas, grano y viñeta sutiles. La calidad sale del modelado, los materiales y la composición, no del bloom.

**Interfaz.** Tipografía editorial (pesos ligeros, jerarquía por escala), sin paneles/cajas, navegación lateral discreta, barra de progreso fina; en móvil el texto va abajo con degradado y no tapa el 3D principal.

## Rendimiento (3 niveles con la misma dirección de arte)
- **Baja** (móviles modestos): sin postproceso; antialias nativo; ≤ ~150 draw calls y ≤ ~72 k triángulos por fotograma medidos.
- **Media**: composer con bloom leve, MSAA 4, DPR ≤ 1.5.
- **Alta**: sombras, suelos con reflejo planar, DPR ≤ 2.
Degradación adaptativa automática si los FPS caen. Geometría repetida con `InstancedMesh`; pantallas en canvas que solo se redibujan al cambiar.

## Publicar
Subir la carpeta completa a `…/DLupita/zenix-inmersion-3d-moderna/` (GitHub Pages sirve estático, sin build).
Parámetros útiles: `?q=low|medium|high` fuerza la calidad; `?noadapt` desactiva la degradación adaptativa.

## Segunda pasada (ajustes tras la primera revisión)
- **Composición:** en horizontal el sujeto se desplaza a la derecha y arriba para que el texto no lo tape; en la sala de análisis la cámara ahora recorre el centro y las piezas miran hacia ella (ya no se tapan entre sí).
- **Color:** menos tinte azul/violeta (entornos, luces y materiales neutros); ligero gradado final en media/alta. El violeta queda para el logo y los acentos.
- **Luz:** exposición equilibrada entre escenas, brazos robóticos más oscuros, entrada a la sala final visible y sin la mancha especular en el suelo.
