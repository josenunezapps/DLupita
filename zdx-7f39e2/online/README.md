# Zenix Web + Core v0.3 — versión conectada (preparada, NO activada)

La aplicación se desarrolló sin modificar la web principal de Doña Lupita ni los proyectos Supabase existentes. Los datos de ejemplo locales de la versión 0.2 siguen en su ruta original, aislados de esta versión.

## Rutas

- `/zdx-7f39e2/online/` — **web pública del comercio** (depende de su base central)
- `/zdx-7f39e2/online/admin.html` — panel privado para el propietario
- `?comercio=slug-del-negocio` permite abrir otra web usando el mismo software; cada negocio tiene su catálogo y propietario.

## Activación (cuando haya un proyecto Supabase dedicado)

1. Crear proyecto **nuevo dedicado a Zenix Delivery** en Supabase. No reutilizar otros proyectos sin autorización.
2. Ejecutar `schema.sql` en su SQL Editor y revisar los asesores de seguridad.
3. Crear un usuario administrador en Authentication > Users. **No habilitar registro abierto de propietarios.**
4. Insertar un comercio con el UUID real del usuario desde SQL Editor. Por defecto `active=false` y `published=false` hasta que Zenix AR lo valide.
5. Copiar exclusivamente `Project URL` y `publishable key` (empieza con `sb_publishable_`) al archivo `config.js`. No publicar claves `service_role` ni `secret`.
6. Abrir `admin.html`, iniciar sesión, editar catálogo y publicar la página. Verificar en otro dispositivo que una modificación aparezca sin usar datos locales.
7. Antes de abrir al público: configurar URLs permitidas de Auth, control de tráfico, recuperación y política de privacidad.

## Qué funciona una vez conectado

- Login con contraseña y sesión de Supabase Auth.
- Consultas públicas únicamente a catálogos y tiendas activas/publicadas.
- Edición del sitio y de productos con autorización en PostgreSQL RLS.
- Misma base para el dueño y los compradores, con refresco automático cada 15 segundos cuando la página está visible.
- Tiendas múltiples seleccionadas por slug, bajo infraestructura compartida.

## Qué NO está desarrollado todavía

- Checkout online real, cobros, cálculo de envíos, clientes registrados, GPS de repartidores, puntos ni suscripciones. El carrito muestra una selección pero **no envía pedidos**. Se contempló un esquema de órdenes cerrado, a la espera de un endpoint seguro.
- El modelo de edición actual cubre un propietario por comercio. Otros empleados/repartidores serán perfiles separados en siguientes etapas.
- No se implementó despliegue Supabase ni pruebas RLS con dos usuarios reales, porque no hay una base dedicada configurada.

### Seguridad

Una URL poco conocida no es control de acceso. La seguridad reside en Supabase Auth y las políticas RLS, no en esconder `admin.html`. Nunca escribir secrets en el frontend ni almacenar credenciales del comercio en GitHub.
