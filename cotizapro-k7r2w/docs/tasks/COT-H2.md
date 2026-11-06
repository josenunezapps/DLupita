# COT-H2 — Presupuestos y PDF

**Estado:** para revisión (Jarvis) y aprobación (Russo)
**Rama:** `feat/COT-001-nucleo` en `josenunezapps/DLupita` (publicado también en `main`, ruta oculta)
**Fecha:** 06/11/2026

## Objetivo

Que un profesional arme un presupuesto con su catálogo, vea el total al instante, lo emita con número correlativo, lo descargue en PDF, lo mande por WhatsApp y siga su estado.

## Decisiones tomadas (valores por defecto del plan, a confirmar por Russo)

| ID | Decisión | Qué se implementó |
| --- | --- | --- |
| D6 | Reglas de cálculo | Importe de línea redondeado a centavo (mitad hacia arriba) → descuento de línea → subtotal = suma de netos → descuento general (% o monto, nunca mayor al subtotal) → impuesto solo si está activado, redondeado una vez → total. Todo en enteros. |
| D7 | Estados | «Enviado» lo marca el usuario a mano. «Vencido» no se guarda: se deriva de la fecha de validez. Aceptado, rechazado y cancelado cierran el presupuesto. |
| D8 | PDF | Impresión del navegador («Guardar como PDF») con el mismo dibujo que la pantalla. Sin librerías ni servicios: fidelidad exacta y cero costo. |

## Alcance entregado (COT-008 a COT-013)

| ID | Qué | Estado |
| --- | --- | --- |
| COT-008 | Lista con filtros por estado y búsqueda; presupuestos en el inicio | Hecho |
| COT-009 | Editor: cliente, título, validez, líneas desde catálogo o libres, cantidades decimales, descuento por línea y general, notas, total en vivo, reordenar y quitar líneas, aviso de cambios sin guardar | Hecho |
| COT-010 | Cálculo idéntico en navegador (`app/lib/calc.js`) y base (`calc_quote`) | Hecho, con prueba de paridad |
| COT-011 | Emisión: validaciones, número correlativo por negocio, snapshot inmutable, historial | Hecho |
| COT-012 | Documento A4, vista previa con marca BORRADOR, descarga en PDF | Hecho |
| COT-013 | Estados, duplicar, borrar borradores, WhatsApp (texto + número del cliente) | Hecho |

**Fuera de alcance (no tocado):** órdenes de trabajo, anticipos, IA, firma del cliente, envío automático, facturación.

## Archivos

Nuevos:

- `app/lib/calc.js`, `app/lib/quotes.js`
- `app/views/quotes.js`, `app/views/quote-doc.js`
- `supabase/migrations/0003_presupuestos.sql` (aplicada)
- `supabase/tests/0002_presupuestos.sql` (generado por `tests/build-sql-test.mjs`)
- `tests/calc-cases.json`, `tests/calc.test.mjs`, `tests/build-sql-test.mjs`
- `docs/tasks/COT-H2.md`

Modificados:

- `index.html` (precarga de módulos nuevos, versión de caché)
- `app/main.js` (ruta `presupuestos`, aviso de cambios sin guardar)
- `app/lib/api.js` (`db.remove`, mensajes de error de las funciones de la base)
- `app/views/shell.js` (pestaña Presupuestos), `app/views/home.js` (resumen y últimos presupuestos)
- `app/styles.css` (editor, documento, impresión)
- `tests/e2e.mjs` (flujo completo de presupuestos)

## Pruebas

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| Base real: cálculo, emisión, numeración, inmutabilidad, estados, duplicar, aislamiento | **OK 46/46** | `supabase/tests/0002_presupuestos.sql` vía execute_sql, 06/11/2026. Mensaje `FALLAS: 0`; todo revertido |
| Paridad de cálculo navegador ↔ base | **OK 9/9** | Mismos casos de `calc-cases.json` en `calc.test.mjs` y en la base. Valores esperados verificados aparte con Python |
| Unitarias (cálculo, importes, validaciones) | **OK 24/24** | `node --test cotizapro-k7r2w/tests/calc.test.mjs cotizapro-k7r2w/tests/logic.test.mjs` |
| E2E móvil y escritorio (backend simulado) | **OK 108/108** | `node cotizapro-k7r2w/tests/e2e.mjs`, 5 corridas seguidas sin fallas tras corregir una carrera del propio test |
| PDF real generado por Chrome | **OK** | 1 página A4; contiene número, cliente, líneas, IVA y total; sin menús de la app (`pdfinfo`, `pdftotext`) |
| Linter de seguridad de Supabase | **OK** con avisos aceptados | Funciones SECURITY DEFINER intencionales; `org_counters` sin políticas a propósito (solo la usa `issue_quote`) |
| Frontend contra la base real | **NO EJECUTADO** | El entorno de desarrollo no llega a supabase.co. Lo cubre la checklist |
| «Guardar como PDF» en el celular de Russo | **NO EJECUTADO** | Depende del navegador del teléfono. Lo cubre la checklist |

## Pendientes y riesgos

1. **WhatsApp no adjunta el PDF solo:** se abre el chat con el texto y el PDF se adjunta a mano. Adjuntarlo automático requiere WhatsApp Business API (fuera de V1).
2. **El nombre del PDF** sale del título de la página en Chrome; otros navegadores pueden proponer otro nombre.
3. **Logo dentro de cada snapshot:** cada presupuesto emitido guarda una copia del logo (máx. ~300 KB). Con cientos de presupuestos conviene pasar a Storage.
4. **Caché:** después de publicar, algunos navegadores pueden tardar hasta 10 minutos en tomar todos los archivos nuevos.
5. **Protección de contraseñas filtradas** de Supabase está apagada: se activa en el panel (Authentication → Policies) si el plan lo permite.
6. En el editor, el campo de fecha muestra el formato del navegador del usuario.

## Checklist de demo (Russo)

- [ ] Presupuestos → Nuevo: elegir cliente, poner título, agregar 2 conceptos del catálogo y una línea libre.
- [ ] Cambiar cantidades (probar `2,5`) y un descuento: el total se actualiza al instante.
- [ ] Vista previa: aparece BORRADOR con tus datos y logo.
- [ ] Guardar borrador, salir y volver: sigue igual.
- [ ] Emitir: recibe N.º 0001. Intentar editarlo: no se puede.
- [ ] Descargar PDF desde el celular y abrirlo: una página, sin cortes.
- [ ] Enviar por WhatsApp: abre el chat del cliente con el texto armado.
- [ ] Marcar enviado → aceptado. Duplicar: sale un borrador nuevo sin número.
- [ ] Cambiar un precio del catálogo: el presupuesto emitido no cambia.
