// Foto de ejemplo generada en el momento: una factura sobre una mesa de madera, en perspectiva y con sombra.
// Sirve para probar el escáner sin cámara.
import { homography } from './vision.js';

export async function samplePhoto() {
  const W = 1600, H = 1200;
  const dw = 1000, dh = 1414;
  const d = document.createElement('canvas'); d.width = dw; d.height = dh;
  const x = d.getContext('2d');
  x.fillStyle = '#f8f7f2'; x.fillRect(0, 0, dw, dh);
  x.fillStyle = '#6d3df5'; x.fillRect(0, 0, dw, 18);
  x.fillStyle = '#1a1a1a'; x.font = 'bold 46px Georgia, serif'; x.fillText('Almacén Los Lupinos', 70, 120);
  x.font = '24px Arial, sans-serif'; x.fillStyle = '#555'; x.fillText('Av. San Martín 1234 · Ushuaia · CUIT 20-30123456-7', 70, 162);
  x.fillStyle = '#1a1a1a'; x.font = 'bold 30px Arial'; x.fillText('FACTURA C  N° 0003-00004517', 70, 240);
  x.font = '24px Arial'; x.fillStyle = '#333'; x.fillText('Fecha: 22/10/2026     Cliente: Consumidor final', 70, 284);
  x.fillStyle = '#222'; x.fillRect(70, 320, dw - 140, 3);
  const rows = [['Yerba mate 1 kg', '2', '11.200'], ['Leche entera 1 L', '6', '9.300'], ['Pan francés x kg', '1', '2.400'], ['Coca-Cola 1,5 L', '3', '9.600'], ['Galletitas de agua', '4', '7.160'], ['Queso cremoso 250 g', '2', '7.800'], ['Detergente 750 ml', '1', '2.350'], ['Alfajor de chocolate', '6', '6.600']];
  x.font = '26px Arial';
  rows.forEach((r, i) => {
    const y = 380 + i * 62;
    x.fillStyle = '#222'; x.fillText(r[0], 80, y); x.fillText(r[1], 640, y);
    x.textAlign = 'right'; x.fillText('$ ' + r[2], dw - 80, y); x.textAlign = 'left';
    x.fillStyle = '#ddd'; x.fillRect(70, y + 22, dw - 140, 1);
  });
  x.fillStyle = '#222'; x.fillRect(70, 900, dw - 140, 3);
  x.font = 'bold 40px Arial'; x.fillText('TOTAL', 80, 970); x.textAlign = 'right'; x.fillText('$ 56.410', dw - 80, 970); x.textAlign = 'left';
  x.font = 'italic 24px Georgia'; x.fillStyle = '#666'; x.fillText('¡Gracias por tu compra!', 70, 1060);
  for (let i = 0; i < 46; i++) { x.fillStyle = i % 3 ? '#111' : '#fff'; x.fillRect(70 + i * 9, 1140, i % 4 ? 5 : 3, 110); }
  x.save(); x.translate(760, 1200); x.rotate(-0.25); x.strokeStyle = 'rgba(200,40,40,.75)'; x.lineWidth = 6; x.strokeRect(-110, -45, 220, 90);
  x.fillStyle = 'rgba(200,40,40,.75)'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('PAGADO', 0, 14); x.restore();

  const dd = x.getImageData(0, 0, dw, dh).data;
  // proyección de cámara real (hoja A4 inclinada, celular a ~50 cm)
  const quad = project(210, 297, { f: 1450, rx: -34, ry: 9, rz: 7, tz: 470, W, H, ox: 12, oy: -6 });
  const M = homography(quad, [[0, 0], [dw, 0], [dw, dh], [0, dh]]);
  const out = new ImageData(W, H), o = out.data;
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) {
    const p = (y * W + X) * 4, den = M[6] * X + M[7] * y + 1, u = (M[0] * X + M[1] * y + M[2]) / den, v = (M[3] * X + M[4] * y + M[5]) / den;
    let R, G, B;
    if (u >= 0 && v >= 0 && u < dw - 1 && v < dh - 1) { const q = ((v | 0) * dw + (u | 0)) * 4; R = dd[q]; G = dd[q + 1]; B = dd[q + 2]; }
    else { const n = Math.sin(y * 0.045 + Math.sin(X * 0.004) * 6) * 12 + rnd() * 14; R = 112 + n; G = 74 + n * 0.7; B = 46 + n * 0.5; }
    const s = 0.5 + 0.5 * Math.min(1, Math.max(0, (X / W) * 1.15 + (y / H) * 0.25)); // sombra de la mano/ventana
    o[p] = R * s; o[p + 1] = G * s; o[p + 2] = B * s; o[p + 3] = 255;
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(out, 0, 0);
  return new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
}

function project(docW, docH, { f, rx, ry, rz, tz, W, H, ox = 0, oy = 0 }) {
  const r = d => d * Math.PI / 180, [a, b, c] = [r(rx), r(ry), r(rz)];
  const Rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]];
  const Ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
  const Rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]];
  const mul = (A, B) => A.map(row => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
  const R = mul(Rz, mul(Ry, Rx));
  return [[-docW / 2, -docH / 2], [docW / 2, -docH / 2], [docW / 2, docH / 2], [-docW / 2, docH / 2]].map(([x, y]) => {
    const X = R[0][0] * x + R[0][1] * y + ox, Y = R[1][0] * x + R[1][1] * y + oy, Z = R[2][0] * x + R[2][1] * y + tz;
    return [W / 2 + f * X / Z, H / 2 + f * Y / Z];
  });
}
