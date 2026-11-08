# TurnoFácil — Versión única de trabajo (antes de Supabase)

## Alcance del primer cambio

Ruta: `turnofacil-x9q4m2/index.html`

Se consolidó el laboratorio V2 en la ruta original de TurnoFácil; la versión anterior permanece recuperable en el historial de Git.

- Se conserva la interfaz y el flujo funcional original.
- El repositorio de demostración se inicializa desde una copia local válida, si existe.
- Los cambios efectuados mediante la API interna del modo demostración se guardan en `localStorage` al terminar correctamente cada operación.
- El botón **Reiniciar** borra la copia local y repone los datos ficticios.
- Se comprueba la estructura mínima de los datos y se recupera el ejemplo por defecto cuando el JSON está corrupto.
- Se mantienen la comprobación de conflictos por profesional, duración, bloqueos, horarios y reglas originales, **sin alterar su implementación**.

## Limitaciones expresas

Esta versión sigue siendo **solo una demostración**. Los datos son locales al mismo navegador/origen y no se sincronizan entre usuarios, pestañas abiertas simultáneamente ni dispositivos. No tiene autenticación real ni garantías de transacciones concurrentes, y no debe utilizarse para recibir turnos de clientes reales. El almacenamiento local tampoco es adecuado para datos personales de producción.

## Pendientes acordados, en orden

1. Revisar y probar las reglas de disponibilidad, franjas horarias, descansos, bajas y reprogramación con datos de prueba.
2. Auditar y terminar panel administrativo, roles, agenda y flujos de comunicación.
3. Revisar experiencia móvil, accesibilidad y PWA sin alterar partes validadas.
4. **Última etapa:** integrar Supabase con aislamiento entre negocios, RLS, cuentas autorizadas, persistencia y protección transaccional contra dobles reservas. Ejecutar pruebas multi-dispositivo.

## Revisión estática del parche

- Solo se altera la construcción del repositorio demo, la salida correcta de `run` y la rutina de reinicio.
- Errores de lectura y guardado local no bloquean la demostración.
- No se agrega ninguna credencial ni conexión externa.
- No se modificaron las fuentes del proyecto original.

## Pruebas manuales por ejecutar

- Crear turno → recargar → aparece el mismo turno.
- Cancelar o reprogramar → recargar → cambio conservado.
- Editar servicio/profesional → recargar → cambio conservado.
- Bloquear horario → recargar → bloqueo conservado.
- Reiniciar demo → recargar → vuelven datos de ejemplo.
- Dos turnos superpuestos del mismo profesional → el segundo debe ser rechazado.

No se declara ningún caso OK hasta probarlo en navegador.
