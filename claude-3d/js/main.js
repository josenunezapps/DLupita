// Punto de entrada liviano: si no hay WebGL (clase "nogl" puesta por el HTML) no se descarga nada de 3D.
const html = document.documentElement;
if (!html.classList.contains('nogl')) {
  import('./app.js').catch((err) => {
    console.warn('[zenix-3d] no se pudo iniciar la experiencia 3D → versión alternativa', err);
    html.classList.add('nogl');
  });
  // red de seguridad: si en 40 s no arrancó (dispositivo muy lento o algo se colgó), se muestra la versión simple
  setTimeout(() => {
    if (!html.classList.contains('ready')) {
      console.warn('[zenix-3d] la carga tardó demasiado → versión alternativa');
      window.__zAbort = true;
      html.classList.add('nogl');
    }
  }, 40000);
}
