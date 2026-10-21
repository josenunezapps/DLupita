// Capa de datos: modo Supabase si está configurado, si no modo demo (guarda en este navegador).
(function () {
  const C = window.FILO;
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const useSB = !!(C.supabaseUrl && C.supabaseKey && window.supabase);
  const sb = useSB ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey) : null;

  // ---------- modo demo ----------
  const K = { t: "filo_turnos_v1", b: "filo_bloqueos_v1", s: "filo_sesion_v1" };
  const mem = { t: null, b: [], s: false };
  const read = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? def; } catch (e) { return def; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const uid = () => Math.random().toString(36).slice(2, 10);

  function seed() {
    const names = ["Martín", "Lucas", "Diego", "Facundo", "Nicolás", "Joaquín", "Tomás", "Agustín", "Bruno", "Ezequiel"];
    const out = [], today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      if (C.diasCerrados.includes(d.getDay())) continue;
      for (let k = 0; k < 3; k++) {
        const h = C.horarios[(i * 5 + k * 6 + 2) % C.horarios.length];
        const s = C.servicios[(i + k) % C.servicios.length];
        out.push({ id: uid(), fecha: iso(d), hora: h, servicio: s[0], precio: s[2],
          nombre: names[(i * 3 + k) % names.length] + " (ejemplo)", telefono: "11" + (40000000 + i * 1234 + k * 77),
          estado: k === 0 ? "confirmado" : "pendiente" });
      }
    }
    return out;
  }
  function dT() { let t = read(K.t, null); if (!t) { t = mem.t || seed(); write(K.t, t); } mem.t = t; return t; }
  function dB() { const b = read(K.b, mem.b); mem.b = b; return b; }
  const sT = t => { mem.t = t; write(K.t, t); };
  const sB = b => { mem.b = b; write(K.b, b); };
  const activo = t => t.estado !== "cancelado";

  const demo = {
    async ocupados(f) { return new Set([...dT().filter(t => t.fecha === f && activo(t)).map(t => t.hora), ...dB().filter(b => b.fecha === f).map(b => b.hora)]); },
    async crearTurno(t) {
      const occ = await demo.ocupados(t.fecha);
      if (occ.has(t.hora)) return { ok: false, error: "ocupado" };
      sT([...dT(), { ...t, id: uid(), estado: "pendiente" }]); return { ok: true };
    },
    async turnos(f) { return dT().filter(t => t.fecha === f).sort((a, b) => a.hora.localeCompare(b.hora)); },
    async setEstado(id, e) { sT(dT().map(t => t.id === id ? { ...t, estado: e } : t)); return { ok: true }; },
    async recordado(id) { sT(dT().map(t => t.id === id ? { ...t, recordado: true } : t)); return { ok: true }; },
    async bloqueos(f) { return dB().filter(b => b.fecha === f).map(b => b.hora); },
    async bloquear(f, h, on) {
      const b = dB().filter(x => !(x.fecha === f && x.hora === h));
      if (on) b.push({ fecha: f, hora: h }); sB(b); return { ok: true };
    },
    async sesion() { return read(K.s, mem.s); },
    async login() { mem.s = true; write(K.s, true); return { ok: true }; },
    async logout() { mem.s = false; write(K.s, false); }
  };

  // ---------- modo Supabase ----------
  const real = {
    async ocupados(f) {
      const { data, error } = await sb.from("ocupados").select("hora").eq("fecha", f);
      if (error) throw error; return new Set(data.map(r => r.hora));
    },
    async crearTurno(t) {
      const { error } = await sb.from("turnos").insert({ ...t, estado: "pendiente" });
      if (!error) return { ok: true };
      if (error.code === "23505" || /bloqueado|ocupado/i.test(error.message)) return { ok: false, error: "ocupado" };
      return { ok: false, error: error.message };
    },
    async turnos(f) {
      const { data, error } = await sb.from("turnos").select("*").eq("fecha", f).order("hora");
      if (error) throw error; return data;
    },
    async setEstado(id, e) { const { error } = await sb.from("turnos").update({ estado: e }).eq("id", id); return { ok: !error, error: error?.message }; },
    async recordado(id) { const { error } = await sb.from("turnos").update({ recordado: true }).eq("id", id); return { ok: !error, error: error?.message }; },
    async bloqueos(f) {
      const { data, error } = await sb.from("bloqueos").select("hora").eq("fecha", f);
      if (error) throw error; return data.map(r => r.hora);
    },
    async bloquear(f, h, on) {
      const q = on ? sb.from("bloqueos").insert({ fecha: f, hora: h }) : sb.from("bloqueos").delete().eq("fecha", f).eq("hora", h);
      const { error } = await q; return { ok: !error, error: error?.message };
    },
    async sesion() { const { data } = await sb.auth.getSession(); return !!data.session; },
    async login(email, pass) {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      return error ? { ok: false, error: "Email o contraseña incorrectos." } : { ok: true };
    },
    async logout() { await sb.auth.signOut(); }
  };

  window.Store = { modo: useSB ? "supabase" : "demo", iso, ...(useSB ? real : demo) };
})();
