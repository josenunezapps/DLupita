# CAUCE · Flow Design Studio

Laboratorio local para diseñar recorridos de atención, reproducir jornadas y explorar inversiones en capacidad. Producto independiente, sin servicios externos, cuentas ni dependencias de ejecución.

## Abrir

Ruta en el repositorio: `cauce-lab-a7k9/`. Servir por HTTP(S); los módulos ES y workers no funcionan al abrir `index.html` como `file://`. GitHub Pages sirve directamente esta carpeta. Todos los recursos usan rutas relativas. No requiere cambiar workflows ni archivos globales.

## Tres motores

1. **Simulación de eventos discretos:** llegadas Poisson, tiempos uniformes configurables, colas FCFS, múltiples servidores y recorrido secuencial. Registra cada atención y reproduce ocupación/colas en cualquier instante. Reordena por llegada en cada estación, conservando la disciplina FCFS incluso cuando los clientes se adelantan en estaciones previas.
2. **Optimización combinatoria:** enumera todas las distribuciones de 1–4 puestos adicionales entre hasta 6 estaciones. Compara 5 semillas comunes para reducir ruido; valida la alternativa elegida en 20 semillas nuevas e informa un intervalo t aproximado del 95% de la diferencia pareada.
3. **Curva de estrés:** simula hasta 12 tasas de llegada, 5 jornadas por tasa, alrededor de la capacidad teórica del cuello de botella. Permite abrir una demanda directamente en el estudio.

## Funciones del producto

- Tres plantillas ficticias: cafetería, taller y envíos.
- Editor de estaciones, orden por arrastre o botones accesibles, hasta 10 puestos por estación.
- Reproducción pausada/iniciada por el usuario, selector de tiempo y velocidad.
- Historial de 60 acciones en memoria, deshacer/rehacer, atajos.
- Hasta 8 escenarios persistentes; comparación y restauración.
- Exportación/importación JSON del proyecto activo; CSV de resultados e impresión/PDF mediante el navegador.
- Temas claro/oscuro, navegación móvil, mapa vertical, controles etiquetados, diálogos nativos y movimiento reducido.

## Arquitectura

- `src/engine.js`: funciones puras, RNG reproducible, validación, simulación, snapshots, optimización y estrés.
- `src/store.js`: estado, historial acotado, persistencia versionada y recuperación de errores.
- `src/worker.js`: cálculo de optimización/estrés fuera del hilo de interfaz.
- `src/app.js`: presentación, navegación por fragmentos, interacción y ciclo de reproducción. Trabajos cancelables y resultados invalidados al cambiar el modelo.
- `style.css`: sistema visual propio, estados, temas, layouts y modo impresión.
- `tests/engine.test.mjs`: invariantes de simulación, optimización, importación y almacenamiento.

Se eligieron módulos ES nativos: eliminan descargas de frameworks, compilación de producción y conflictos con otros proyectos. El motor se prueba en Node y se ejecuta sin adaptación dentro del browser/worker.

## Contratos y límites

- Llegadas 1–240/h; jornadas 15–480 minutos; 1–6 estaciones; 1–10 puestos; atención 0,1–30 min; variabilidad 0–100%.
- Se admiten clientes hasta el cierre y se completa su recorrido después. Espera media/P95 incluyen a todos los admitidos. Finalizados y ocupación se miden solamente dentro de la jornada. Cola máxima incluye después del cierre; el gráfico temporal muestrea 41 instantes de la jornada.
- Sin abandonos, rutas alternativas, descansos, desplazamiento físico ni límites de cola. Puestos de igual costo y disponibilidad. No son predicciones garantizadas: calibrar parámetros con mediciones reales.
- Persistencia local, sin sincronización ni cuentas. El historial no se conserva al recargar. Los JSON exportan un proyecto activo, no toda la biblioteca de escenarios. Exportar cada escenario que se quiera respaldar.
- Las simulaciones deben ejecutarse desde un origen HTTP(S) que admita módulos y workers.
- No hay telemetría ni tráfico de negocio a terceros. Todo permanece en el navegador. El hosting recibe únicamente las solicitudes normales de archivos.
- Importación limitada a 100 KB con validación, texto escapado y CSV protegido contra fórmulas comunes. CSP bloquea scripts externos, conexiones y objetos. No hay secretos.

## Verificar

```sh
cd cauce-lab-a7k9
npm test
npm run build
```

`build` verifica sintaxis de módulos y presencia de recursos; no transpila porque la aplicación usa archivos nativos publicados directamente. Node 20+ para las pruebas; navegador moderno con módulos ES, Worker y dialog.

Ver `VERIFICACION.md` para resultados observados y límites de cobertura.
