# Barbería Filo: turnos online

- **Página de turnos:** `index.html` (la que ve el cliente)
- **Panel del barbero:** `panel/` (turnos del día, confirmar, cancelar, bloquear horarios)
- **Datos del negocio:** `config.js` (nombre, WhatsApp, servicios, precios, horarios)

Sin configurar nada funciona en **modo demo**: los turnos se guardan solo en ese navegador. Sirve para mostrarla.

## Pasar a modo real (gratis, unos 10 minutos)

1. Crear una cuenta en https://supabase.com y un proyecto nuevo (plan Free).
2. En el proyecto: **SQL Editor → New query**, pegar todo `supabase.sql` y tocar **Run**.
3. **Authentication → Users → Add user**: crear el email y la contraseña del barbero. Ese es el login del panel.
4. **Project Settings → API**: copiar la **Project URL** y la **anon public key**.
5. Pegarlas en `config.js` en `supabaseUrl` y `supabaseKey`, poner el WhatsApp real y subir los cambios.

La anon key es pública por diseño: la seguridad la dan las reglas de `supabase.sql`. El público solo puede crear turnos y ver qué horarios están ocupados; nombres y teléfonos solo los ve el barbero logueado.

## Recordatorios para el cliente

Después de reservar, el cliente ve dos opciones:

- **Calendario** (Google o el del celular): guarda el turno con aviso 2 horas antes. Funciona siempre, sin configurar nada.
- **Aviso en el dispositivo** (notificación push): en modo demo muestra una notificación de ejemplo. Para que llegue de verdad 2 horas antes, seguí estos pasos.

### Activar los avisos push (gratis, después de conectar Supabase)

1. Generar las claves de aviso en tu compu: `npx web-push generate-vapid-keys`. Te da una clave **pública** y una **privada**.
2. Pegar la clave pública en `config.js`, en `vapidPublic`.
3. Desde esta carpeta, entrar y conectar el proyecto con la herramienta de Supabase: `npx supabase login` y `npx supabase link --project-ref TU-PROYECTO`.
4. Guardar los secretos (la privada nunca va en el repo):
   `npx supabase secrets set VAPID_PUBLIC=... VAPID_PRIVATE=... VAPID_SUBJECT=mailto:tu@email.com NEGOCIO="Barbería Filo" DIRECCION="Av. Corrientes 3150"`
5. Subir la función: `npx supabase functions deploy recordatorios`
6. En `push.sql`, reemplazar `TU-PROYECTO` y `TU_ANON_KEY`, y correrlo en el SQL Editor.

Desde ahí, cada 15 minutos Supabase busca los turnos que empiezan en 2 horas y les manda el aviso a quienes lo activaron.

En **iPhone** los avisos solo funcionan si el cliente agregó la página a la pantalla de inicio (iOS 16.4 o más nuevo). En Android y en la compu funcionan directo.

## Instalar el panel como app (celular del barbero)

El panel se instala como una app, gratis y sin Play Store:

- **Android (Chrome):** abrir el link del panel y tocar **Instalar app** arriba (o menú ⋮ → **Instalar aplicación**).
- **iPhone (Safari):** abrir el link del panel, tocar **Compartir** y después **Agregar a inicio**.

Queda con ícono dorado propio, se abre a pantalla completa y sigue abriendo aunque se corte la conexión un momento. Los turnos siempre se traen en vivo cuando hay internet.

La página de turnos también se puede instalar (ícono oscuro). En iPhone es necesario para que el cliente reciba los avisos push.

## Para otra barbería

Copiar la carpeta, cambiar `config.js` (y el nombre en los títulos y en los dos `manifest.webmanifest`) y crear un proyecto de Supabase nuevo para ese cliente.
