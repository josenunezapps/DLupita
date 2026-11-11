# Verificación de CAUCE — 11 de noviembre de 2026

## Automática

11 pruebas aprobadas con `node --test tests/*.test.mjs`:

1. Reproducibilidad con semilla idéntica.
2. Cambio de llegadas al cambiar la semilla.
3. Conservación de clientes, orden temporal, ausencia de superposición por puesto y ocupación entre 0–100%.
4. Colas + atendidos = admitidos − salidos en cada instantánea.
5. Tiempos exactos cuando la variabilidad es cero.
6. Optimizador respeta el presupuesto y mejora la espera de entrenamiento.
7. Enumeración completa de 126 distribuciones únicas para 6 estaciones y 4 puestos extra.
8. Rechazo de archivos con rangos, identificadores, versión o estructura inválidos.
9. Estadísticas válidas sin llegadas.
10. Persistencia, deshacer, rehacer e invalidación de la rama futura.
11. Capacidad teórica y curva de estrés finita con 12 niveles.

`npm run build`: módulos JavaScript válidos y recursos del HTML presentes. Sitio sin etapa de transpile y sin dependencias de producción.

## Navegador Chromium

Probado con la ruta anidada `/cauce-lab-a7k9/`:

- Navegación Estudio → Laboratorio → Escenarios → Informe → Guía.
- Optimizador en Worker: 6 distribuciones evaluadas para dos puestos extra, resultado aplicable y dos escenarios guardados.
- Ejemplo cafetería con semilla 4261: 76 llegadas, 61 finalizados; espera inicial 6,4 min. Al aplicar +1 Pedido y pago / +1 Preparación: 68 finalizados y 1,1 min de espera en la misma jornada.
- Validación de esa propuesta: ahorro medio aproximado 8,1 ± 1,8 min en 20 jornadas independientes.
- Prueba de estrés: 12 niveles y capacidad teórica inicial 35,3 clientes/h; resultados visibles en gráfico y controles.
- Persistencia de escenarios tras recarga; nombre de proyecto editado con teclado conservado tras recarga.
- Agregar estación, reordenar con flechas y deshacer.
- Reproducción avanza el reloj; pausa funciona.
- Exportación JSON, reimportación del mismo archivo y confirmación de apertura.
- Descarga de CSV completada por el navegador.
- Diseño de escritorio y móvil en frame de viewport 390 × 844, con mapa vertical y navegación inferior. Sin desbordamiento horizontal en estudio y laboratorio.
- Temas claro y oscuro revisados visualmente.
- Sin errores de la aplicación en el registro de consola observado. El entorno emitió avisos de su propia extensión de navegador, externos al sitio.

## Alcance de las pruebas

No se ejecutaron pruebas en Safari/iOS, Firefox ni en un teléfono físico. El viewport móvil no mide rendimiento de hardware Android. El diálogo de impresión/PDF depende del navegador; no se verificó un PDF impreso. El arrastre HTML tiene alternativa por flechas probada; no se automatizó el gesto drag-and-drop. El soporte de movimiento reducido se implementó en CSS y se respeta al desplazar el inspector, pero no se probó con lector de pantalla.

Las pruebas locales no sustituyen la comprobación pública del despliegue. El commit y la URL verificados se informan en la entrega.
