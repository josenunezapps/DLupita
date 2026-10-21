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

## Para otra barbería

Copiar la carpeta, cambiar `config.js` (y el nombre en los títulos) y crear un proyecto de Supabase nuevo para ese cliente.
