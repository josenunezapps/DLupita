# Doña Lupita · Ushuaia

Web pública: https://josenunezapps.github.io/DLupita/dona-lupita/

Administración (sin enlace desde la web): https://josenunezapps.github.io/DLupita/dona-lupita/admin/

## Estado

- Web demostrativa no oficial; conservar este aviso hasta obtener aprobación del negocio.
- Carrito de selección para consultas; no toma pedidos, no cobra online ni confirma stock.
- Catálogo y panel responsive. Productos, descripciones, precios opcionales, visibilidad, datos de contacto y horario habitual son editables.
- Backend de catálogo en proyecto Supabase **Zenix Sites**, aislado en tablas `public.dona_lupita_catalog` y `public.dona_lupita_admins`.
- Acceso mediante **correo electrónico + contraseña** con Supabase Auth; edición protegida por RLS. La ruta oculta NO es la medida de seguridad.
- No hay contraseñas, tokens privados ni llaves de servicio en este repositorio. La clave `sb_publishable_...` del frontend es pública y solo da acceso a operaciones permitidas por RLS.
- El catálogo de la base de datos tiene prioridad; `catalog.json` es el respaldo cuando no hay conexión.

## Habilitar la cuenta administradora (acción pendiente)

1. Abrir `/admin/`, ingresar un correo propio y crear una contraseña de al menos ocho caracteres con **Crear cuenta de administración**.
2. Confirmar la dirección de correo cuando Supabase envíe el mensaje.
3. El propietario del proyecto debe autorizar la cuenta desde su Supabase SQL Editor ejecutando esta instrucción, **sustituyendo el correo por el propio**:

```sql
insert into public.dona_lupita_admins (user_id)
select id from auth.users where email = 'CORREO_DEL_ADMINISTRADOR'
on conflict (user_id) do nothing;
```

4. Entrar con ese correo y contraseña. Si no hay una fila para ese usuario en `dona_lupita_admins`, el inicio de sesión no habilita la edición.

**Nunca compartir contraseñas por chat ni almacenarlas en GitHub.** Los cambios se guardan en Supabase (no crean nuevos commits). El panel exige confirmar la verificación del número antes de habilitar WhatsApp.

## Datos públicos investigados

- Dirección: Don Bosco 314, esquina Gobernador Paz, Ushuaia.
- Fijo: 02901 43-7675.
- Celular publicado por el propio comercio en marzo de 2026: 02901 55-9998 (para llamadas, no confirmado como WhatsApp).
- Instagram: @lupitaushuaia.
- Horario de referencia: lunes a sábado, 12:00–15:00 y 20:00–00:00; domingos cerrado, sujeto a cambios.
- NASA publicó en 2017 que el equipo de Operation IceBridge llevó empanadas de Doña Lupita.
- Las **435 reseñas y la puntuación 4,4** son de Tripadvisor al consultar las fuentes, no de Google.

Fuentes consultadas:
- https://www.tripadvisor.com.ar/Restaurant_Review-g312855-d5528786-Reviews-Dona_Lupita-Ushuaia_Province_of_Tierra_del_Fuego_Patagonia.html
- https://www.restaurants10.com/AR/Ushuaia/264319750575756/DO%C3%91A-LUPITA
- https://science.nasa.gov/blogs/notes-from-the-field/2017/11/16/empanadas-in-flight/
- https://findelmundo.tur.ar/es/gastronomia/164

Los precios no se inventaron: se dejan sin definir hasta que la administración confirme una carta vigente. Algunas descripciones son referencias orientativas.

## Estructura

- `index.html`: web pública.
- `app.js`: carrito, horarios y sincronización de catálogo.
- `styles.css`: diseño existente, más estilos de precios.
- `catalog.json`: catálogo inicial de respaldo.
- `admin/index.html` y `admin/admin.js`: panel de administración.
- `supabase/setup.sql`: esquema y políticas RLS instaladas.

## Seguridad

- GitHub Pages aloja archivos estáticos. `/admin/` es una ruta no anunciada y con `noindex`, pero cualquiera puede abrirla; la autorización se ejecuta **en la base de datos**.
- `anon` solo puede leer el catálogo. Las cuentas autenticadas solo pueden editarlo si figuran en `dona_lupita_admins`.
- No hay inscripción automática como administrador.
- El panel mantiene el token de acceso en memoria; al actualizar la pestaña se debe volver a ingresar.
- Es recomendable activar la protección contra contraseñas filtradas en Supabase Auth.
