# Corrección fina de render — Zenix AR (base: commit 31a55cb de zenix-inmersion-cinematica)

Solo cambios técnicos de renderizado; diseño, textos, escenas, cámara y animaciones sin tocar.

1. Antialiasing: el nivel "medium" (la mayoría de PC y celulares) renderizaba con bloom y SIN MSAA (canvas antialias:false + samples:0) → bordes dentados y líneas que vibran. Ahora el render target del EffectComposer usa MSAA x4 (js/main.js).
2. Caras "huecas": las estructuras usaban metal casi puro (metalness .9) con albedo muy oscuro que solo reflejaba el fondo negro del entorno. Nuevo material `M.struct` (js/materials.js) aplicado solo a anillos del portal, vigas, torres, losas, plataformas, pilares y racks (s1, s2, s4, s5). Más un velo violeta tenue detrás de la cámara en el mapa de entorno (js/env.js). Sin cambios de exposición ni de intensidad de luces.
3. Z-fighting: las franjas de neón de los anillos compartían caras coplanares con el cuerpo (s1, s3, s4, s5, s6); ahora se solapan dentro del cuerpo. Cámara near 0.1 → 0.3 para ganar precisión de profundidad.
4. Rejilla del suelo: las líneas finas se desvanecen cuando la celda mide <2 px (evita moiré/centelleo a distancia).
