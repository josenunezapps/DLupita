const menuData = {
  empanadas: [
    { name: "Carne cortada a cuchillo", desc: "Uno de los clásicos de la casa.", price: "Consultar" },
    { name: "Matambre", desc: "Una de las variedades que más nos representa.", price: "Consultar" },
    { name: "Cordero", desc: "Una opción con carácter bien fueguino.", price: "Consultar" },
    { name: "Mariscos", desc: "Para quienes quieren algo distinto.", price: "Consultar" },
    { name: "Roquefort", desc: "Intensa, cremosa y con mucha personalidad.", price: "Consultar" },
    { name: "Más sabores", desc: "Consultanos por todas las variedades disponibles.", price: "Ver carta" }
  ],
  pizzas: [
    { name: "Muzzarella", desc: "La clásica de siempre.", price: "Consultar" },
    { name: "La de Messi", desc: "Fina masa, salsa, pesto, queso parmesano, morrones, panceta y olivas negras.", price: "Consultar" },
    { name: "Jamón y huevo", desc: "Simple, abundante y rendidora.", price: "Consultar" },
    { name: "Cuatro quesos", desc: "Para los que no negocian con el queso.", price: "Consultar" },
    { name: "Especialidades", desc: "Consultanos por las variedades del día.", price: "Ver carta" }
  ],
  platos: [
    { name: "Milanesas", desc: "Grandes, abundantes y con acompañamiento.", price: "Consultar" },
    { name: "Sándwiches", desc: "Contundentes para almuerzo o cena.", price: "Consultar" },
    { name: "Pastas", desc: "Cocina casera para sentarse y disfrutar.", price: "Consultar" },
    { name: "Platos del día", desc: "Preguntanos qué tenemos preparado hoy.", price: "Consultar" }
  ],
  combos: [
    { name: "Docena de empanadas", desc: "Ideal para compartir y probar varios sabores.", price: "Consultar" },
    { name: "Media docena", desc: "Seis empanadas a elección.", price: "Consultar" },
    { name: "Pizzas para compartir", desc: "Armá tu pedido con las variedades que más te gusten.", price: "Consultar" },
    { name: "Pedidos grandes", desc: "Para reuniones, grupos o eventos.", price: "Consultar" }
  ]
};

const menuList = document.getElementById('menuList');
const tabs = [...document.querySelectorAll('.menu-tab')];
const whatsappNumber = '5492901559998';

function menuWhatsAppLink(item) {
  const message = item.price === 'Ver carta'
    ? 'Hola Doña Lupita, quiero consultar la carta completa.'
    : `Hola Doña Lupita, quiero consultar por ${item.name}.`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function renderMenu(category){
  menuList.innerHTML = menuData[category].map(item => `
    <article class="menu-item">
      <div><h3>${item.name}</h3><p>${item.desc}</p></div>
      <a class="menu-price menu-action"
         href="${menuWhatsAppLink(item)}"
         target="_blank"
         rel="noopener"
         aria-label="${item.price} ${item.name} por WhatsApp">${item.price} ↗</a>
    </article>`).join('');
}
renderMenu('empanadas');
tabs.forEach(tab=>tab.addEventListener('click',()=>{
  tabs.forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');
  renderMenu(tab.dataset.category);
}));

const toggle=document.querySelector('.nav-toggle');
const nav=document.querySelector('.nav');
toggle.addEventListener('click',()=>{
  const open=nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded',String(open));
});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));

const observer = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{ if(entry.isIntersecting){ entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));

// Estado abierto/cerrado en hora de Ushuaia.
const BUSINESS_TZ = 'America/Argentina/Ushuaia';

function getUshuaiaClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  const value = type => parts.find(part => part.type === type)?.value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: dayMap[value('weekday')],
    hour: Number(value('hour')),
    minute: Number(value('minute'))
  };
}

function getBusinessStatus(date = new Date()) {
  const { day, hour, minute } = getUshuaiaClock(date);
  const now = hour * 60 + minute;

  // Domingo cerrado todo el día.
  if (day === 0) {
    return { open: false, text: 'Cerrado · abre mañana a las 12:00' };
  }

  // Lunes a sábado: 12:00–15:00 y 20:00–00:00.
  if (now < 12 * 60) {
    return { open: false, text: 'Cerrado · abre hoy a las 12:00' };
  }
  if (now < 15 * 60) {
    return { open: true, text: 'Abierto ahora · hasta las 15:00' };
  }
  if (now < 20 * 60) {
    return { open: false, text: 'Cerrado · abre hoy a las 20:00' };
  }
  return { open: true, text: 'Abierto ahora · hasta las 00:00' };
}

function paintBusinessStatus() {
  const navStatus = document.getElementById('navStatus');
  const heroStatus = document.getElementById('heroStatus');
  const visitStatus = document.getElementById('visitStatus');

  try {
    const status = getBusinessStatus();
    const stateClass = status.open ? 'open' : 'closed';

    if (navStatus) {
      navStatus.classList.remove('open', 'closed');
      navStatus.classList.add(stateClass);
      const label = navStatus.querySelector('span');
      if (label) label.textContent = status.text;
    }

    if (heroStatus) {
      heroStatus.classList.remove('open', 'closed');
      heroStatus.classList.add(stateClass);
      const label = heroStatus.querySelector('span');
      if (label) label.textContent = status.text;
    }

    if (visitStatus) {
      visitStatus.classList.remove('open', 'closed');
      visitStatus.classList.add(stateClass);
      visitStatus.textContent = status.text;
    }
  } catch (error) {
    // Evita que quede clavado en “Consultando horario…” si el navegador falla.
    const fallback = 'Lun–sáb · 12:00–15:00 · 20:00–00:00';
    const navLabel = navStatus?.querySelector('span');
    const heroLabel = heroStatus?.querySelector('span');
    if (navLabel) navLabel.textContent = fallback;
    if (heroLabel) heroLabel.textContent = fallback;
    if (visitStatus) visitStatus.textContent = fallback;
  }
}

paintBusinessStatus();
setInterval(paintBusinessStatus, 60 * 1000);

