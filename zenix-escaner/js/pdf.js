// Generador de PDF mínimo y válido (PDF 1.4) con una imagen JPEG por página. Sin librerías.

const A4 = [595.28, 841.89];
const enc = new TextEncoder();

/**
 * pages: [{ jpeg: Uint8Array, width, height }]  (px de la imagen)
 * Devuelve un Blob application/pdf.
 * Si la proporción se parece a A4, usa A4 exacto; si no, una página con la proporción de la imagen y ancho A4.
 */
export function buildPDF(pages, { title = 'Documento escaneado', author = 'Zenix Escáner' } = {}) {
  const chunks = []; let offset = 0; const xref = [];
  const push = data => { const b = typeof data === 'string' ? enc.encode(data) : data; chunks.push(b); offset += b.length; };
  const obj = (n, body) => { xref[n] = offset; push(`${n} 0 obj\n`); if (Array.isArray(body)) body.forEach(push); else push(body); push('\nendobj\n'); };
  const esc = s => s.replace(/[\\()]/g, m => '\\' + m).replace(/[^\x20-\x7e]/g, c => {
    // texto no ASCII → aproximación sin tildes (el Info del PDF es metadato, no contenido visible)
    return c.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');
  });

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length;
  // objetos: 1 catálogo, 2 páginas, 3 info; por página: page, contenido, imagen
  const pageIds = pages.map((_, i) => 4 + i * 3);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] >>`);
  const d = new Date(), pad = v => String(v).padStart(2, '0');
  const date = `D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  obj(3, `<< /Title (${esc(title)}) /Author (${esc(author)}) /Producer (Zenix Escaner) /CreationDate (${date}) >>`);

  pages.forEach((p, i) => {
    const id = pageIds[i], cid = id + 1, iid = id + 2;
    const ar = p.height / p.width;
    let W, H;
    const a4 = ar >= 1 ? A4[1] / A4[0] : A4[0] / A4[1];
    if (Math.abs(ar - a4) / a4 < 0.12) { [W, H] = ar >= 1 ? A4 : [A4[1], A4[0]]; }
    else { W = A4[0]; H = W * ar; }
    const content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
    obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    obj(iid, [`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream']);
  });

  const total = 4 + n * 3;
  const xrefStart = offset;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(xref[i]).padStart(10, '0') + ' 00000 n \n';
  push(x);
  push(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return new Blob(chunks, { type: 'application/pdf' });
}
