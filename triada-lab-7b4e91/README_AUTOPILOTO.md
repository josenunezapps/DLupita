# TRÍADA · Autopiloto controlado v0.2

**Estado:** código instalado, no activado ni validado contra las APIs reales. La aplicación original de Doña Lupita permanece independiente.

## Qué hace realmente

El flujo **TRÍADA · Claude + auditoría OpenAI** se ejecuta en GitHub Actions (no en el navegador), exclusivamente mediante una orden manual del propietario `josenunezapps`.

1. Valida una tarea de 1–1800 caracteres y hasta tres rutas autorizadas dentro de `triada-lab-7b4e91/`.
2. En modalidad **dry run** (predeterminada) solo comprueba archivos y rutas. No consume ninguna API ni abre PR.
3. Con autorización explícita y claves en Secrets, hace **una** llamada a Claude mediante la API de Anthropic para obtener reemplazos exactos de texto.
4. Comprueba que las modificaciones afectan únicamente a los archivos indicados. Aplica como máximo seis cambios de texto; revisa que cada fragmento exista exactamente una vez, y chequea sintaxis JavaScript y formato del diff.
5. Hace **una** llamada a la API Responses de OpenAI para auditar el diff.
6. Solo cuando el dictamen del auditor es `OK`, crea rama y Pull Request para **revisión humana**. Nunca ejecuta merge, despliegue ni cambios sobre archivos de Doña Lupita.

Una suscripción a ChatGPT o Claude **no equivale a disponer de créditos API**. El sistema necesita cuentas API con acceso y facturación habilitada por los respectivos proveedores.

## Rutas en GitHub

- Interfaz: `triada-lab-7b4e91/index.html`, `styles.css`, `app.js`
- Coordinador (backend temporal ejecutado por Actions): `triada-lab-7b4e91/agent/runner.cjs`
- Orquestación: `.github/workflows/triada-autopilot.yml`
- URL de la demo: https://josenunezapps.github.io/DLupita/triada-lab-7b4e91/
- URL para ejecutar/ver runs: https://github.com/josenunezapps/DLupita/actions/workflows/triada-autopilot.yml

## Cómo probar sin gastar

Abrir GitHub > repositorio `DLupita` > Actions > `TRÍADA · Claude + auditoría OpenAI` > Run workflow.

Ingresar:
- **task:** `Verificar la preparación del prototipo TRÍADA`
- **files:** `triada-lab-7b4e91/app.js`
- **dry_run:** activado (valor predeterminado)
- **authorize_paid_api_calls:** desactivado

Al ejecutar, el registro esperado es **DRY RUN: OK**; ninguna API ni PR deben ser llamados. Esto aún requiere ejecución/verificación manual desde GitHub.

## Cómo activar llamadas reales (con costo)

1. En **Settings > Secrets and variables > Actions > New repository secret**, guardar por separado `ANTHROPIC_API_KEY` y `OPENAI_API_KEY`. **No pegar claves en la web TRÍADA, los prompts, issues ni el código fuente.**
2. En Settings > Actions > General > Workflow permissions, comprobar que el repositorio permite crear Pull Requests mediante GitHub Actions. Este permiso puede estar deshabilitado; no activarlo sin considerar el nivel de confianza del repositorio.
3. En Actions > TRÍADA, crear una ejecución con tarea y archivo(s) **explícitos y acotados**.
4. Desactivar **dry_run** y activar **authorize_paid_api_calls**, entendiendo que se invocarán las dos APIs de pago (una vez cada una, sin reintentos automáticos).
5. Inspeccionar el reporte descargable `triada-informe-<run>.md`, las alertas y, si se creó, el Pull Request. Revisar y probar **antes de aprobar**.

### Variables opcionales

- `TRIADA_CLAUDE_MODEL`: por defecto `claude-sonnet-4-6`
- `TRIADA_OPENAI_MODEL`: por defecto `gpt-6.1-terra`

Los modelos, disponibilidad, tarifas y límites deben confirmarse con el proveedor antes del uso. Los topes de tokens por llamada reducen gastos, **pero no establecen un límite monetario global**. Configurar límites de gasto en ambas cuentas API.

## Restricciones y evidencias

- Nunca se ejecutan comandos entregados por un modelo; solo comprobación sintáctica de JS.
- Máximo 3 archivos, 34 KB cada uno, 50.000 caracteres de entrada, 6 reemplazos, 20.000 caracteres de diff.
- Se ignoran instrucciones dentro de los archivos a revisar: son datos no confiables.
- Las pruebas funcionales y E2E no están implementadas en este workflow; su resultado es `NO EJECUTADO`.
- El auditor por API **no es literalmente este chat** de ChatGPT ni tiene acceso a nuestras conversaciones. Lo mismo aplica a Claude.
- La app web original sigue usando almacenamiento local; no existe autenticación ni base de datos compartida.
- **OK verificado:** existencia de los archivos en GitHub y validación sintáctica local del código JavaScript, realizada por el asistente.
- **NO EJECUTADO:** dry run en GitHub, conexión a Anthropic, conexión a OpenAI, creación automática de PR, pruebas en navegador o móvil.
- **BLOQUEADO hasta configuración voluntaria:** claves API/consentimiento del gasto y permisos GitHub.

## Evolución futura

Para que las tareas se disparen *desde la propia interfaz* sin pasar por la pestaña Actions: conectar una identidad autenticada, backend persistente y un endpoint seguro de ejecución que autorice a Russo. No se permite enviar el `GITHUB_TOKEN` o un PAT al cliente web ni usar `localStorage` para guardar claves.

La app de la pizzería no debe modificarse ni incorporarse como dependencia de TRÍADA.