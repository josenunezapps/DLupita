// Estado central con suscripción e historial de deshacer/rehacer sobre el modelo.
import { clone } from './model.js';

export function createStore(initial, { limit = 120 } = {}) {
  let state = initial;
  const subs = new Set();
  const undoStack = [], redoStack = [];
  let pending = null; // instantánea tomada al empezar un gesto continuo (arrastre)

  const emit = (prev, meta) => subs.forEach((fn) => fn(state, prev, meta || {}));
  const pushUndo = (snapshot) => { undoStack.push(snapshot); if (undoStack.length > limit) undoStack.shift(); redoStack.length = 0; };

  return {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

    /** Cambios que no forman parte del historial (herramienta, selección, vista…). */
    set(patch, meta) { const prev = state; state = { ...state, ...patch }; emit(prev, meta); },

    /** Modifica el modelo. `record:false` se usa durante un arrastre, entre begin() y commit(). */
    mutate(fn, { record = true, label = '' } = {}) {
      const prev = state;
      const draft = clone(state.model);
      if (fn(draft) === false) return false;
      draft.updatedAt = Date.now();
      if (record) pushUndo({ model: prev.model, label });
      state = { ...state, model: draft };
      emit(prev, { model: true, label });
      return true;
    },

    begin(label = '') { pending = { model: state.model, label }; },
    commit() { if (pending && pending.model !== state.model) pushUndo(pending); pending = null; },

    /** Reemplaza el modelo entero (abrir otro proyecto): reinicia el historial. */
    load(model, extra = {}) { const prev = state; undoStack.length = redoStack.length = 0; state = { ...state, ...extra, model }; emit(prev, { model: true, loaded: true }); },

    undo() {
      const snap = undoStack.pop();
      if (!snap) return null;
      const prev = state;
      redoStack.push({ model: state.model, label: snap.label });
      state = { ...state, model: snap.model };
      emit(prev, { model: true, history: true });
      return snap.label || 'cambio';
    },
    redo() {
      const snap = redoStack.pop();
      if (!snap) return null;
      const prev = state;
      undoStack.push({ model: state.model, label: snap.label });
      state = { ...state, model: snap.model };
      emit(prev, { model: true, history: true });
      return snap.label || 'cambio';
    },
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}
