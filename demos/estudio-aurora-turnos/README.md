# Estudio Aurora — app de turnos (demo genérica)

Clon de la app de Sebastián González con datos ficticios (Estudio Aurora, Valentina Ríos, Palermo), usado para el reel promocional de Zenix AR.

- La app usa Cloudflare Pages Functions + D1 (`functions/api/[[path]].js`). En GitHub Pages solo se ve la parte estática; para que funcione completa hay que desplegarla en Cloudflare Pages con un binding D1 `SG_DB` y el secreto `RESEND_API_KEY`.
- `_media/`: reel (`reel-app-turnos-zenix.mp4`) y portada (`portada-reel-turnos.jpg`).
- `_media/video-fuente/`: scripts para regenerar el video (PIL + ffmpeg) y la voz en off.
