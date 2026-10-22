// Resaltados, fragmentos y notas: creación, edición y diálogos compartidos.
import { db } from './db.js';
import { uid, esc, modal, MARK_COLORS, confirmDialog, toast } from './util.js';

export const KIND = {
  highlight: { label: 'Resaltado', icon: 'highlight' },
  fragment: { label: 'Fragmento', icon: 'quote' },
  note: { label: 'Nota', icon: 'note' },
};

export async function createMark(data) {
  const now = Date.now();
  const mark = {
    id: uid(), bookId: data.bookId || null, type: data.type, text: data.text || '', note: data.note || '',
    color: data.color || (data.type === 'highlight' ? '#F5D76E' : data.type === 'note' ? '#7A2E56' : '#C9A45C'),
    position: data.position || null, page: data.page ?? null, chapter: data.chapter || '',
    rects: data.rects || null, createdAt: now, updatedAt: now,
  };
  await db.put('marks', mark);
  window.dispatchEvent(new CustomEvent('marks-changed', { detail: { bookId: mark.bookId } }));
  return mark;
}
export async function updateMark(id, changes) {
  const m = await db.patch('marks', id, { ...changes, updatedAt: Date.now() });
  window.dispatchEvent(new CustomEvent('marks-changed', { detail: { bookId: m?.bookId } }));
  return m;
}
export async function deleteMark(id) {
  const m = await db.get('marks', id);
  await db.del('marks', id);
  window.dispatchEvent(new CustomEvent('marks-changed', { detail: { bookId: m?.bookId } }));
  return m;
}

export function locationLabel(m) {
  const parts = [];
  if (m.page) parts.push(`pág. ${m.page}`);
  if (m.chapter) parts.push(m.chapter);
  return parts.join(' · ');
}

/** Diálogo para crear o editar una nota (con o sin texto seleccionado). */
export async function noteDialog({ text = '', note = '', title = 'Nueva nota', books = null, bookId = null } = {}) {
  const booksSelect = books ? `<div class="field"><label>Libro (opcional)</label><select class="input" name="book"><option value="">Nota libre, sin libro</option>${books.map(b => `<option value="${b.id}" ${b.id === bookId ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></div>` : '';
  return modal({
    title,
    body: `${text ? `<div class="quote">${esc(text)}</div>` : ''}${booksSelect}
      <div class="field"><label>Tu nota</label><textarea class="input" name="note" placeholder="Escribí lo que pensás de este pasaje…">${esc(note)}</textarea></div>`,
    actions: [
      { label: 'Cancelar', cls: 'btn-ghost', value: null },
      {
        label: 'Guardar nota', cls: 'btn-primary', primary: true,
        validate: box => { const ok = box.querySelector('[name=note]').value.trim().length > 0; if (!ok) box.querySelector('[name=note]').focus(); return ok; },
        collect: box => ({ note: box.querySelector('[name=note]').value.trim(), bookId: box.querySelector('[name=book]')?.value || bookId }),
      },
    ],
  });
}

/** Diálogo de edición genérico para cualquier marca. */
export async function editMarkDialog(mark) {
  const colorPicker = mark.type === 'highlight' ? `<div class="field"><label>Color</label><div style="display:flex;gap:10px">${MARK_COLORS.map(c => `<label style="cursor:pointer"><input type="radio" name="color" value="${c.c}" ${c.c === mark.color ? 'checked' : ''} style="position:absolute;opacity:0"><span title="${c.n}" style="display:block;width:34px;height:34px;border-radius:50%;background:${c.c};border:3px solid ${c.c === mark.color ? 'var(--plum)' : 'transparent'}"></span></label>`).join('')}</div></div>` : '';
  const textField = mark.type === 'fragment'
    ? `<div class="field"><label>Texto del fragmento</label><textarea class="input" name="text">${esc(mark.text)}</textarea></div>`
    : (mark.text ? `<div class="quote">${esc(mark.text)}</div>` : '');
  const noteField = `<div class="field"><label>${mark.type === 'note' ? 'Nota' : 'Comentario (opcional)'}</label><textarea class="input" name="note" style="min-height:90px">${esc(mark.note)}</textarea></div>`;
  const res = await modal({
    title: `Editar ${KIND[mark.type].label.toLowerCase()}`,
    body: textField + colorPicker + noteField,
    onOpen: box => {
      box.querySelectorAll('[name=color]').forEach(r => r.addEventListener('change', () => {
        box.querySelectorAll('[name=color]').forEach(x => x.nextElementSibling.style.borderColor = x.checked ? 'var(--plum)' : 'transparent');
      }));
    },
    actions: [
      { label: 'Eliminar', cls: 'btn-ghost btn-danger', value: 'delete' },
      { label: 'Cancelar', cls: 'btn-ghost', value: null },
      {
        label: 'Guardar', cls: 'btn-primary', primary: true, collect: box => ({
          text: box.querySelector('[name=text]')?.value.trim() ?? mark.text,
          note: box.querySelector('[name=note]').value.trim(),
          color: box.querySelector('[name=color]:checked')?.value || mark.color,
        }),
      },
    ],
  });
  if (res === 'delete') {
    if (await confirmDialog('¿Eliminar?', 'Esta acción no se puede deshacer.', 'Eliminar', true)) {
      await deleteMark(mark.id); toast('Eliminado.'); return 'deleted';
    }
    return null;
  }
  if (res) { await updateMark(mark.id, res); return 'updated'; }
  return null;
}
