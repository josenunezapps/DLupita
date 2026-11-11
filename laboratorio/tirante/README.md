# Tirante, laboratorio de estructuras

Dibujás un puente, una ménsula o cualquier estructura de barras y ves en vivo qué barras se
estiran, cuáles se aplastan, si resiste y con cuánta carga se cae. Todo corre en el navegador:
sin servidor, sin cuentas, sin librerías externas y sin paso de compilación.

**Abrir:** https://josenunezapps.github.io/DLupita/laboratorio/tirante/

## Qué hace

- **Cálculo real en vivo.** Reticulados planos por el método de rigidez directa (Cholesky denso).
  Se rehace en cada cuadro mientras arrastrás un nudo. Verifica tracción por fluencia y compresión
  por fluencia o pandeo de Euler, con coeficiente de seguridad.
- **Mecanismos a la vista.** Si la estructura es inestable, calcula por dónde se mueve
  (iteración inversa sobre la matriz de rigidez) y la muestra oscilando.
- **Vehículo y líneas de influencia.** Envolvente exacta de la carga móvil; al elegir una barra se
  dibuja su línea de influencia.
- **Aligerar.** Dimensionado automático con tubos de catálogo hasta que nada cambia.
- **Ensayo destructivo.** Multiplica la carga, quita las barras que ceden, redistribuye y, al
  colapsar, simula la caída (Verlet). Los números salen del análisis; la caída es ilustrativa.
- **Edición.** Nudos, barras, apoyos y cargas con mouse, dedo o teclado; partir barras, fundir
  nudos, deshacer y rehacer, grilla, selección múltiple.
- **Tabla de barras** con búsqueda (`uso>80`, `n<-100`, `l>4`, `pandeo`), filtros y orden.
- **Proyectos** guardados solos en el navegador, con búsqueda, orden, duplicado y borrado reversible.
- **Importar y exportar:** proyecto `.tirante.json`, plano SVG con cajetín y tabla CSV.
- **Paleta de comandos** (Ctrl K), atajos, vista 3D, plano azul y papel, celular y escritorio.

## Estructura del código

```
index.html            estructura de la página
css/app.css           identidad visual y adaptación a pantallas
js/core/              lógica pura, sin DOM (se prueba con Node)
  catalog.js          materiales y tubos (área e inercia calculadas)
  linalg.js           Cholesky y modo de menor rigidez
  model.js            modelo de datos y operaciones de edición
  analysis.js         rigidez directa, reacciones, influencia, aprovechamiento
  optimize.js         dimensionado automático
  failure.js          ensayo destructivo (secuencia de fallas)
  physics.js          simulación del derrumbe
  io.js               validación, JSON, CSV, SVG
  store.js            estado e historial
  persist.js          guardado local
  examples.js         estructuras de ejemplo
js/ui/                hoja (canvas), vista 3D, paneles, paleta, ensayo
js/main.js            conexión de todo, acciones y atajos
tests/                pruebas
```

## Pruebas

```
npm test            # 23 pruebas del núcleo contra soluciones analíticas (Node 20+, sin dependencias)
npm run test:e2e    # 17 pruebas en Chrome real con Playwright, escritorio y celular
```

## Límites, dichos claramente

- **Guardado:** `localStorage` del navegador. No se sincroniza entre dispositivos, comparte el
  cupo (unos 5 MB) con el resto del dominio y se pierde si se borran los datos del sitio. Para
  conservar o pasar un proyecto, exportalo.
- **Ingeniería:** modelo lineal de barras articuladas en el plano. Sirve para aprender y
  predimensionar; no reemplaza un cálculo profesional según reglamento.
- **Datos de ejemplo:** las geometrías, cargas y el precio por kilo de los ejemplos son inventados
  y están rotulados como ejemplo. Los resultados se calculan de verdad con esos datos.
- **Tipografía:** usa la familia DIN del sistema (Bahnschrift, DIN Alternate, Roboto Condensed);
  no descarga fuentes.
- La ruta no está enlazada pero es pública: no contiene información sensible.
