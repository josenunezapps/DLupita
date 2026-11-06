# CotizaPro (ruta oculta)

App web de presupuestos para oficios y pymes. Esta carpeta es una **ruta oculta** del repo DLupita: no está enlazada desde ninguna página y tiene `noindex`.

- URL (una vez en `main`): `https://josenunezapps.github.io/DLupita/cotizapro-k7r2w/`
- Base de datos: proyecto Supabase `cotizapro` (org Zenix AR, región sa-east-1)
- Estado: **COT-H1 — núcleo** (cuentas, negocio, configuración, clientes, conceptos). Presupuestos y PDF: próximo hito.

## Estructura

```text
cotizapro-k7r2w/
  index.html              # entrada
  app/
    config.js             # URL y clave PUBLICABLE de Supabase (nunca secretos)
    main.js               # router por hash y control de sesión/negocio
    styles.css
    lib/api.js            # cliente Supabase propio (Auth + PostgREST) con fetch
    lib/money.js          # importes en centavos, parseo es-AR, porcentajes en puntos básicos
    lib/validate.js       # validaciones con los mismos límites que la base
    lib/dom.js            # DOM seguro (texto siempre como textContent)
    views/                # auth, onboarding, home, customers, catalog, settings, shell
  supabase/
    migrations/           # SQL versionado y ya aplicado (no editar los aplicados)
    tests/                # test de aislamiento entre organizaciones
  tests/
    logic.test.mjs        # node --test
    e2e.mjs               # Playwright + Chrome con backend simulado
  docs/tasks/             # encargos y entregas
```

## Decisiones (ADR resumidos)

- **ADR-001 · JS sin compilar.** Módulos ES nativos, sin npm ni build: corre directo en GitHub Pages y se prueba sin instalar nada. Aprobado por Russo el 06/11/2026 (en lugar de React + Vite).
- **ADR-002 · Logo como data URL.** El logo se achica a 400 px en el navegador y se guarda en la columna `logo_data_url` (máx. ~300 KB, validado en la base). Evita configurar Storage en V1. Si más adelante pesa, se migra a Storage.
- **ADR-003 · Cliente Supabase propio.** Sin `supabase-js` desde CDN: un cliente de ~200 líneas con `fetch`. Sin dependencias externas en tiempo de ejecución.
- **ADR-004 · Un negocio por cuenta (V1).** Lo impone la función `create_organization`.
- **ADR-005 · Nada se borra.** Clientes y conceptos se archivan; la base no permite DELETE.

## Seguridad

- Toda tabla tiene RLS; el acceso se decide con `is_member(organization_id)` contra la sesión, nunca con lo que mande el navegador.
- Los negocios solo se crean por la función `create_organization` (alta del negocio + dueño en una transacción).
- UPDATE solo sobre columnas editables: nadie puede cambiar `id`, dueño, organización ni fechas.
- Aviso aceptado del linter de Supabase: `create_organization` e `is_member` son SECURITY DEFINER ejecutables por usuarios logueados. Es intencional: la primera valida la sesión y el límite de un negocio; la segunda solo responde si *el propio usuario* pertenece a una organización.

## Pruebas

```bash
node --test cotizapro-k7r2w/tests/logic.test.mjs     # lógica de importes y validaciones
node cotizapro-k7r2w/tests/e2e.mjs                   # recorrido completo en móvil y escritorio (backend simulado)
```

El test de aislamiento (`supabase/tests/0001_aislamiento.sql`) se pega en el editor SQL de Supabase. Corre en una transacción y termina con un error controlado que lo revierte todo; el mensaje debe empezar con `FALLAS: 0`.

## Configuración pendiente en Supabase (hacer una vez)

Authentication → URL Configuration:

- **Site URL:** `https://josenunezapps.github.io/DLupita/cotizapro-k7r2w/`
- **Redirect URLs:** agregar la misma URL.

Sin esto, los enlaces de confirmación y de recuperación de contraseña redirigen a `localhost`.
