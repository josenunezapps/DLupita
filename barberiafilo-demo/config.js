// Datos del negocio. Para cada barbería nueva, cambiá solo este archivo.
window.FILO = {
  nombre: "Barbería Filo",
  whatsapp: "5491100000000",          // número de la barbería, con 549 y sin espacios
  direccion: "Av. Corrientes 3150",
  servicios: [
    ["Corte", "30 min", 12000],
    ["Corte + barba", "45 min", 17000],
    ["Barba y perfilado", "20 min", 8000],
    ["Corte infantil", "25 min", 9500]
  ],
  horarios: ["10:00","10:30","11:00","11:30","12:00","12:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"],
  diasCerrados: [0],                  // 0 = domingo, 1 = lunes, ...
  diasAdelante: 14,                   // cuántos días se puede reservar

  // Supabase (gratis). Si queda vacío, la app funciona en modo demo.
  supabaseUrl: "",
  supabaseKey: "",                    // la "anon public key" del proyecto
  vapidPublic: ""                     // clave pública para avisos push (ver LEEME.md)
};
