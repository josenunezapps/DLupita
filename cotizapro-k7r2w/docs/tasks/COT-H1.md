# COT-H1 — Núcleo de CotizaPro

**Estado:** para revisión (Jarvis) y aprobación (Russo)
**Rama:** `feat/COT-001-nucleo` en `josenunezapps/DLupita`
**Fecha:** 06/11/2026

## Objetivo

Que un profesional pueda crear su cuenta y su negocio, configurar sus datos y cargar clientes y conceptos, desde el teléfono o la PC, sin poder ver datos de otro negocio.

## Alcance entregado (COT-001 a COT-007)

| ID | Qué | Estado |
| --- | --- | --- |
| COT-001 | Ruta oculta, estructura, config, cliente HTTP | Hecho |
| COT-002 | Migración del núcleo con RLS en Supabase | Hecho y aplicado |
| COT-003 | Registro, login, salir, recuperar y cambiar contraseña | Hecho (ver pendientes) |
| COT-004 | Alta del negocio (RPC transaccional, uno por cuenta) | Hecho |
| COT-005 | Configuración: datos, logo, color, moneda, validez, condiciones, impuesto opcional | Hecho |
| COT-006 | Clientes: lista, búsqueda, alta, edición, archivo | Hecho |
| COT-007 | Conceptos: lista, búsqueda, filtro por tipo, alta, edición, archivo, recargo y margen | Hecho |

**Fuera de alcance (no tocado):** presupuestos, cálculo de totales, emisión, PDF, Zenix OS, TRÍADA, cualquier otra carpeta del repo.

## Archivos

Todos nuevos, dentro de `cotizapro-k7r2w/`:

- `index.html`, `README.md`
- `app/config.js`, `app/main.js`, `app/styles.css`
- `app/lib/api.js`, `app/lib/dom.js`, `app/lib/money.js`, `app/lib/validate.js`
- `app/views/auth.js`, `app/views/catalog.js`, `app/views/customers.js`, `app/views/home.js`, `app/views/onboarding.js`, `app/views/settings.js`, `app/views/shell.js`
- `supabase/migrations/0001_nucleo.sql`, `supabase/migrations/0002_color_por_defecto.sql`
- `supabase/tests/0001_aislamiento.sql`
- `tests/logic.test.mjs`, `tests/e2e.mjs`
- `docs/tasks/COT-H1.md`

## Infraestructura creada (autorizada por Russo el 06/11/2026)

- Proyecto Supabase `cotizapro` (ref `wqnlbyrpoygqruskfagr`), org Zenix AR, región sa-east-1, plan gratuito. Costo informado por Supabase: sin cargo.
- Migraciones `0001_nucleo` y `0002_color_por_defecto` aplicadas.

## Pruebas

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| Aislamiento entre organizaciones (SQL, base real) | **OK 22/22** | `supabase/tests/0001_aislamiento.sql`, ejecutado 06/11/2026 vía execute_sql. Mensaje: `FALLAS: 0`. Se verificó después que no quedaron datos (0 usuarios, 0 negocios) |
| Linter de seguridad de Supabase | **OK** con 1 aviso aceptado | 2 funciones SECURITY DEFINER intencionales (ver README) |
| Lógica de importes y validaciones | **OK 8/8** | `node --test cotizapro-k7r2w/tests/logic.test.mjs` |
| Recorrido completo móvil 390×844 y escritorio 1280×800 | **OK 64/64** | `node cotizapro-k7r2w/tests/e2e.mjs`, Chrome headless con backend **simulado** |
| Frontend contra la base real (registro, emails, RLS desde el navegador) | **NO EJECUTADO** | El entorno de desarrollo no tiene salida a supabase.co. Lo cubre la checklist de demo |
| Email de confirmación y de recuperación | **NO EJECUTADO** | Requiere configurar Site URL (pendiente 1) y un email real |

## Pendientes y riesgos

1. **Configurar Site URL y Redirect URLs** en Supabase (ver README). Sin esto los enlaces de los emails apuntan a `localhost`. No hay herramienta para hacerlo desde acá: lo hace Russo en el panel.
2. **Envío de emails de Supabase limitado** en el plan gratuito (pocos por hora). Para el piloto conviene configurar un SMTP propio.
3. **La base es la de producción del producto.** No hay entorno de pruebas separado todavía; las pruebas SQL corren dentro de transacciones que se revierten.
4. **Ruta oculta, no privada:** el código es público en GitHub (como todo el repo). No contiene secretos; la clave publicable es pública por diseño.
5. La búsqueda de clientes usa un filtro `or=(… ilike …)` de PostgREST que solo se probó contra el backend simulado.

## Checklist de demo (Russo, 5 minutos)

- [ ] Abrir la URL en el teléfono: aparece el login; sin sesión no se ve ningún dato.
- [ ] Registrarse, confirmar el email, crear un negocio y cargar nombre, logo, color y validez por defecto.
- [ ] Crear dos clientes y encontrarlos con la búsqueda.
- [ ] Crear un concepto con unidad y precio; probar un precio negativo y ver el error.
- [ ] Recargar la página y cerrar/abrir sesión: los datos siguen ahí.
- [ ] Registrar una segunda cuenta con otro negocio: no ve ni un cliente ni un concepto del primero.
- [ ] Revisar en este archivo las pruebas OK/NG/NO EJECUTADO.
