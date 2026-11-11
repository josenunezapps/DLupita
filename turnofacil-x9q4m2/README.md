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

## Cambio del 11/11/2026: imágenes de muestra y avisos por correo

- La demo "La Esquina Barbería" usa las imágenes de `img/` (logo, portada, galería, fotos de profesionales y de servicios) mediante rutas relativas `./img/...`; el validador de imágenes las acepta además de `data:` y `https:`.
- El negocio admite dos campos opcionales nuevos, `cover` y `gallery`, que la página pública muestra como portada y galería deslizable. Todavía no se editan desde Configuración.
- Avisos por correo, además de WhatsApp: botón "Avisar por correo" en la confirmación del cliente y sección "Correo electrónico" en el detalle del turno del panel (recordatorio, cambio, cancelación y mensaje libre). Ambos abren la aplicación de correo con el texto escrito (`mailto:`); **no hay envío automático**, que requiere backend y proveedor de correo.
- La clave de `localStorage` pasó a `turnofacil-lab-v2` para que se carguen los datos nuevos.
- Correcciones: enlace del pie a zenix.com.ar, título de la pestaña y formato de teléfonos con característica de 4 dígitos (2901).
- Estos cambios se aplicaron sobre el `index.html` compilado; falta llevarlos a las fuentes (`shared/validate.ts`, `shared/demo-seed.ts`, `shared/messages.ts`, `shared/core.ts` y las páginas de reservas y agenda).

## Cambio del 11/11/2026 (2): inicio directo en la barbería e ingreso en /admin

- La raíz muestra directamente la página de reservas de La Esquina Barbería; se quitó la pantalla de presentación de TurnoFácil.
- El panel ya no se abre libremente: `admin/` (o `#/admin`) pide usuario y contraseña, y las rutas `#/app/...` redirigen ahí si no se ingresó.
- **Limitación:** la comprobación se hace en el navegador contra un hash SHA-256 incluido en el `index.html` y la sesión vive en `sessionStorage`. Es una barrera de presentación para la demo, no seguridad real; la autenticación verdadera llega con el backend.
