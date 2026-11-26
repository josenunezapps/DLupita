# Flama · Worker de Cloudflare

Tienda (carpeta `flama/`) y API (`/api/*`) en un solo Worker, con la base D1 `flama`.

- Dominio: https://flama.zenix.com.ar
- Panel del dueño: https://flama.zenix.com.ar/#admin (la contraseña se cambia desde Configuración)
- Publicación: automática con GitHub Actions (`.github/workflows/deploy-flama.yml`) en cada cambio de `flama/`. Usa el secreto `CLOUDFLARE_API_TOKEN`.
- Esquema de la base: `schema.sql`.
