# Zenix OS (ruta oculta)

Sistema de gestión para comercios de productos: catálogo, stock, clientes y equipo con roles. Ventas y caja llegan en el hito 2. Esta carpeta es una **ruta oculta** del repo DLupita (sin enlaces, con `noindex`).

- URL: `https://josenunezapps.github.io/DLupita/zenix-os-p4w8n/`
- Base de datos: **mismo proyecto Supabase que CotizaPro** (`cotizapro`, sa-east-1). Todo lo de Zenix OS lleva el prefijo `zos_` (tablas y funciones). Los usuarios son compartidos: la misma cuenta sirve en los dos productos, con datos separados.
- Estado: **ZOS-H1** entregado (núcleo, equipo, productos, stock, clientes).

## Estructura

```text
zenix-os-p4w8n/
  index.html
  app/
    config.js           # URL y clave PUBLICABLE (compartidas con CotizaPro)
    main.js             # router, sesión, negocio y rol
    styles.css          # base de CotizaPro con identidad Zenix (violeta, barra lateral oscura)
    lib/api.js          # cliente Supabase propio; agrega el prefijo zos_ solo
    lib/roles.js        # permisos para mostrar, cantidades en milésimas, estado de stock
    lib/dom.js, money.js, validate.js   # compartidos con CotizaPro (copia)
    views/              # auth, start, home, products, stock, customers, team, business, shell
  supabase/migrations/  # 0001 núcleo, 0002 corrección de auditoría, 0003 mensaje de stock
  supabase/tests/       # 0001_nucleo.sql (roles, stock, aislamiento)
  tests/e2e.mjs         # Playwright con backend simulado
  docs/tasks/           # entregas
```

## Decisiones

- **Rubro piloto:** comercio de productos (Russo, 06/11/2026).
- **Stock por movimientos:** el stock es la suma de movimientos inmutables (inicial, entrada, salida, ajuste; venta y anulación en H2). Nada se pisa ni se borra.
- **Sin stock negativo por defecto** (Russo, 06/11/2026). El dueño puede habilitarlo en Negocio.
- **Ajuste por conteo:** se carga la cantidad contada y el sistema registra la diferencia.
- **Invitaciones por código** (8 caracteres, 7 días, un uso): no requieren enviar emails desde el servidor.
- **Base compartida con CotizaPro** con prefijo `zos_`, por el límite de proyectos gratuitos de Supabase (Russo, 06/11/2026).

## Roles

| Acción | Dueño | Supervisor | Vendedor |
| --- | --- | --- | --- |
| Ver catálogo y stock | Sí | Sí | Sí |
| Cargar y editar clientes | Sí | Sí | Sí |
| Crear y editar productos y categorías | Sí | Sí | No |
| Mover stock | Sí | Sí | No |
| Invitar, cambiar roles, desactivar | Sí | No | No |
| Configurar el negocio | Sí | No | No |

Todo se valida en la base (RLS y funciones), no solo en pantalla.

## Pruebas

```bash
node zenix-os-p4w8n/tests/e2e.mjs        # móvil y escritorio, backend simulado
```

`supabase/tests/0001_nucleo.sql` se pega en el editor SQL de Supabase: corre en una transacción, lo revierte todo y debe responder `FALLAS: 0`.

## Configuración pendiente en Supabase

Authentication → URL Configuration → **Redirect URLs**: agregar `https://josenunezapps.github.io/DLupita/zenix-os-p4w8n/` (sin esto, los emails de confirmación de Zenix OS llevan a CotizaPro).
