# Zenix Club

Programa de fidelización para cafés, panaderías, barberías y cualquier comercio de barrio: tarjeta de sellos digital que el cliente recibe por WhatsApp. Sin app para el cliente.

- **Demo (solo en el dispositivo):** https://josenunezapps.github.io/DLupita/zenix-club/?demo
- **Versión con cuenta (nube):** https://club.zenix.com.ar (Worker `zenix-club` + D1 `zenix-club`)

## Qué hace

- **Mostrador**: buscás por teléfono o nombre, tocás "Sumar sello" y listo. Deshacer, +2 sellos, días de sellos dobles. Confeti cuando alguien completa la tarjeta.
- **Alta en 10 segundos** o **sola por QR**: el cliente escanea el cartel del mostrador y se suma desde su celular.
- **Tarjeta en vivo**: link fijo (`club.zenix.com.ar/t/…`) que siempre muestra los sellos al día. No se puede falsificar: los datos salen del servidor.
- **Referidos**: desde su tarjeta el cliente invita amigos; cuando el amigo viene por primera vez, ganan sellos los dos.
- **Reseñas en Google**: desde la visita que elijas aparece el botón para pedirla por WhatsApp.
- **Equipo y control**: dueño con contraseña, empleados con PIN, cada sello queda registrado con quién lo puso. Aviso si se suma otro sello al mismo cliente en pocas horas (se puede forzar y queda marcado en el Tablero).
- **Tablero**, recuperar clientes, cumpleaños, exportar CSV y respaldo.

## Estructura

```
zenix-club/
  index.html, css/, js/      la app (PWA). Modo demo (localStorage) o nube (API)
  js/qr.js                   generador de QR propio (sin dependencias)
  worker/                    Cloudflare Worker: API /api/* + sirve la app + /t/:token y /u/:club
    src/index.js
    schema.sql               esquema de la D1
    wrangler.jsonc           D1 "zenix-club" + dominio club.zenix.com.ar
    scripts/new-club.mjs     alta de un comercio nuevo
    test/api.test.mjs        pruebas de la API (npm test)
```

## Publicar el Worker (una sola vez)

Opción A, desde el panel de Cloudflare: Workers & Pages → Create → Import a repository → `DLupita`, directorio raíz `zenix-club/worker`. Después se publica solo con cada push.

Opción B, desde la compu:

```
cd zenix-club/worker
npx wrangler deploy
```

La base D1 `zenix-club` ya está creada y con el esquema aplicado.

## Alta de un comercio

```
cd zenix-club/worker
node scripts/new-club.mjs cafe-lapataia "Café Lapataia" ☕ "#0f6b4f"
npx wrangler d1 execute zenix-club --remote --command "<SQL que imprime>"
```

Le pasás al dueño el código del club y la contraseña. Él la cambia desde Programa → Cuenta y suma a sus empleados con PIN.

Hecho por Zenix AR — Soluciones Digitales.
