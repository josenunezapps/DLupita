import { validate, presets } from "./engine.js";
export const KEY = "cauce.a7k9.v1";
export class Store {
  constructor() {
    this.history = [];
    this.future = [];
    this.scenarios = [];
    this.theme = "light";
    this.model = structuredClone(presets.cafe);
    this.warning = "";
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.model = validate(data.model);
        this.scenarios = (data.scenarios || []).slice(0, 8).map(validate);
        this.theme = data.theme === "dark" ? "dark" : "light";
      }
    } catch {
      this.warning =
        "No se pudo recuperar el guardado. Se abrió un ejemplo; importá tu copia de seguridad.";
    }
  }
  save() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          model: this.model,
          scenarios: this.scenarios,
          theme: this.theme,
        }),
      );
      return true;
    } catch {
      this.warning =
        "El navegador no permite guardar. Exportá tu proyecto para conservarlo.";
      return false;
    }
  }
  set(next) {
    const safe = validate(next);
    this.history.push(structuredClone(this.model));
    if (this.history.length > 60) this.history.shift();
    this.future = [];
    this.model = safe;
    this.save();
  }
  undo() {
    if (!this.history.length) return;
    this.future.push(this.model);
    this.model = this.history.pop();
    this.save();
  }
  redo() {
    if (!this.future.length) return;
    this.history.push(this.model);
    this.model = this.future.pop();
    this.save();
  }
}
