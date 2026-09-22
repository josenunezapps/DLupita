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

const whatsappNumber = "5492901559998";
const menuList = document.getElementById("menuList");
const tabs = [...document.querySelectorAll(".menu-tab")];
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
const siteHeader = document.querySelector(".nav-wrap");

const orderItems = document.getElementById("orderItems");
const orderItemCount = document.getElementById("orderItemCount");
const navOrderCount = document.getElementById("navOrderCount");
const mobileOrderCount = document.getElementById("mobileOrderCount");
const mobileOrderBar = document.getElementById("mobileOrderBar");
const clearOrderButton = document.getElementById("clearOrder");
const sendOrderButton = document.getElementById("sendOrder");
const orderName = document.getElementById("orderName");
const orderTime = document.getElementById("orderTime");
const orderNotes = document.getElementById("orderNotes");

const CART_STORAGE_KEY = "dlupita-order-v1";
const DETAILS_STORAGE_KEY = "dlupita-order-details-v1";

function menuWhatsAppLink(item) {
  const message = item.price === "Ver carta"
    ? "Hola Doña Lupita, quiero consultar la carta completa."
    : `Hola Doña Lupita, quiero consultar por ${item.name}.`;
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

let orderCart = [];

function itemKey(category, index) {
  return `${category}:${index}`;
}

function getMenuItem(category, index) {
  return menuData[category]?.[Number(index)] || null;
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    orderCart = Array.isArray(saved)
      ? saved.filter(entry => {
          const [category, index] = String(entry.key || "").split(":");
          return getMenuItem(category, index) && Number(entry.qty) > 0;
        }).map(entry => ({ key: entry.key, qty: Math.min(99, Math.max(1, Number(entry.qty) || 1)) }))
      : [];
  } catch {
    orderCart = [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(orderCart));
  } catch {}
}

function loadOrderDetails() {
  try {
    const saved = JSON.parse(localStorage.getItem(DETAILS_STORAGE_KEY) || "{}");
    if (orderName && typeof saved.name === "string") orderName.value = saved.name;
    if (orderTime && typeof saved.time === "string") orderTime.value = saved.time;
    if (orderNotes && typeof saved.notes === "string") orderNotes.value = saved.notes;
    if (saved.mode) {
      const radio = document.querySelector(`input[name="orderMode"][value="${CSS.escape(saved.mode)}"]`);
      if (radio) radio.checked = true;
    }
  } catch {}
}

function saveOrderDetails() {
  try {
    const mode = document.querySelector('input[name="orderMode"]:checked')?.value || "Retiro en local";
    localStorage.setItem(DETAILS_STORAGE_KEY, JSON.stringify({
      name: orderName?.value.trim() || "",
      time: orderTime?.value || "",
      notes: orderNotes?.value.trim() || "",
      mode
    }));
  } catch {}
}

function cartTotalQuantity() {
  return orderCart.reduce((total, entry) => total + entry.qty, 0);
}

function cartEntryData(entry) {
  const [category, index] = entry.key.split(":");
  const item = getMenuItem(category, index);
  return item ? { ...entry, item, category, index: Number(index) } : null;
}

function pulseOrderCounters() {
  [navOrderCount, mobileOrderBar].forEach(el => {
    if (!el) return;
    el.classList.remove("pulse");
    void el.offsetWidth;
    el.classList.add("pulse");
  });
}

function renderOrder() {
  const total = cartTotalQuantity();
  if (orderItemCount) orderItemCount.textContent = String(total);
  if (navOrderCount) navOrderCount.textContent = String(total);
  if (mobileOrderCount) mobileOrderCount.textContent = String(total);
  if (clearOrderButton) clearOrderButton.disabled = total === 0;
  if (sendOrderButton) sendOrderButton.disabled = total === 0;
  if (mobileOrderBar) mobileOrderBar.classList.toggle("has-items", total > 0);

  if (!orderItems) return;

  if (!orderCart.length) {
    orderItems.innerHTML = `
      <div class="order-empty">
        <span>+</span>
        <h3>Tu pedido está vacío</h3>
        <p>Agregá productos desde la carta para empezar.</p>
        <a href="#carta">Ir a la carta</a>
      </div>`;
    return;
  }

  orderItems.innerHTML = orderCart.map(entry => {
    const data = cartEntryData(entry);
    if (!data) return "";
    return `
      <article class="order-line" data-order-key="${entry.key}">
        <div class="order-line-copy">
          <small>${data.category === "combos" ? "PARA COMPARTIR" : data.category.toUpperCase()}</small>
          <h3>${data.item.name}</h3>
        </div>
        <div class="order-qty" aria-label="Cantidad de ${data.item.name}">
          <button type="button" data-qty-action="minus" aria-label="Quitar uno">−</button>
          <strong>${entry.qty}</strong>
          <button type="button" data-qty-action="plus" aria-label="Agregar uno">+</button>
        </div>
        <button class="order-remove" type="button" data-remove-order aria-label="Quitar ${data.item.name}">×</button>
      </article>`;
  }).join("");
}

function addToOrder(category, index) {
  const item = getMenuItem(category, index);
  if (!item || item.price === "Ver carta") return;

  const key = itemKey(category, index);
  const existing = orderCart.find(entry => entry.key === key);
  if (existing) existing.qty = Math.min(99, existing.qty + 1);
  else orderCart.push({ key, qty: 1 });

  saveCart();
  renderOrder();
  pulseOrderCounters();
}

function changeQuantity(key, delta) {
  const entry = orderCart.find(item => item.key === key);
  if (!entry) return;

  entry.qty += delta;
  if (entry.qty <= 0) {
    orderCart = orderCart.filter(item => item.key !== key);
  } else {
    entry.qty = Math.min(99, entry.qty);
  }

  saveCart();
  renderOrder();
}

function removeFromOrder(key) {
  orderCart = orderCart.filter(item => item.key !== key);
  saveCart();
  renderOrder();
}

function clearOrder() {
  orderCart = [];
  saveCart();
  renderOrder();
}

function renderMenu(category) {
  if (!menuList) return;

  menuList.innerHTML = menuData[category].map((item, index) => {
    const consultationOnly = item.price === "Ver carta";

    return `
      <article class="menu-item">
        <div class="menu-item-copy">
          <h3>${item.name}</h3>
          <p>${item.desc}</p>
        </div>
        ${consultationOnly
          ? `<a class="menu-price menu-action" href="${menuWhatsAppLink(item)}" target="_blank" rel="noopener">Consultar ↗</a>`
          : `<button class="menu-add" type="button" data-add-order data-category="${category}" data-index="${index}">
               <span>Agregar</span><b>+</b>
             </button>`
        }
      </article>`;
  }).join("");
}

renderMenu("empanadas");

tabs.forEach(tab => {
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", tab.classList.contains("active") ? "true" : "false");
  tab.addEventListener("click", () => {
    tabs.forEach(item => {
      item.classList.remove("active");
      item.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    renderMenu(tab.dataset.category);
  });
});
document.querySelector(".menu-tabs")?.setAttribute("role", "tablist");

menuList?.addEventListener("click", event => {
  const button = event.target.closest("[data-add-order]");
  if (!button) return;

  addToOrder(button.dataset.category, Number(button.dataset.index));
  const label = button.querySelector("span");
  if (label) {
    const original = label.textContent;
    label.textContent = "Agregado";
    button.classList.add("added");
    setTimeout(() => {
      label.textContent = original;
      button.classList.remove("added");
    }, 850);
  }
});

orderItems?.addEventListener("click", event => {
  const line = event.target.closest("[data-order-key]");
  if (!line) return;
  const key = line.dataset.orderKey;

  const qtyButton = event.target.closest("[data-qty-action]");
  if (qtyButton) {
    changeQuantity(key, qtyButton.dataset.qtyAction === "plus" ? 1 : -1);
    return;
  }

  if (event.target.closest("[data-remove-order]")) {
    removeFromOrder(key);
  }
});

clearOrderButton?.addEventListener("click", clearOrder);

function buildOrderMessage() {
  const lines = orderCart.map(entry => {
    const data = cartEntryData(entry);
    return data ? `• ${entry.qty} × ${data.item.name}` : "";
  }).filter(Boolean);

  const mode = document.querySelector('input[name="orderMode"]:checked')?.value || "Retiro en local";
  const name = orderName?.value.trim();
  const time = orderTime?.value;
  const notes = orderNotes?.value.trim();

  return [
    "Hola Doña Lupita, quiero hacer este pedido:",
    "",
    ...lines,
    "",
    name ? `Nombre: ${name}` : null,
    `Modalidad: ${mode}`,
    time ? `Hora preferida: ${time}` : null,
    notes ? `Notas: ${notes}` : null,
    "",
    "¿Me confirman disponibilidad y precio final? Gracias."
  ].filter(line => line !== null).join("\n");
}

sendOrderButton?.addEventListener("click", () => {
  if (!orderCart.length) return;
  saveOrderDetails();
  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildOrderMessage())}`;
  window.open(url, "_blank", "noopener");
});

[orderName, orderTime, orderNotes].forEach(field => {
  field?.addEventListener("input", saveOrderDetails);
});
document.querySelectorAll('input[name="orderMode"]').forEach(radio => {
  radio.addEventListener("change", saveOrderDetails);
});

// Contenido visible inmediatamente: sin animaciones de aparición al hacer scroll.
document.querySelectorAll(".reveal").forEach(el => el.classList.add("visible"));

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  }));
}

// Estado abierto/cerrado en hora de Ushuaia.
const BUSINESS_TZ = "America/Argentina/Ushuaia";

function getUshuaiaClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TZ,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const value = type => parts.find(part => part.type === type)?.value;
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    day: dayMap[value("weekday")],
    hour: Number(value("hour")),
    minute: Number(value("minute"))
  };
}

function getBusinessStatus(date = new Date()) {
  const { day, hour, minute } = getUshuaiaClock(date);
  const now = hour * 60 + minute;

  if (day === 0) {
    return { open: false, text: "Cerrado · abre mañana a las 12:00" };
  }
  if (now < 12 * 60) {
    return { open: false, text: "Cerrado · abre hoy a las 12:00" };
  }
  if (now < 15 * 60) {
    return { open: true, text: "Abierto ahora · hasta las 15:00" };
  }
  if (now < 20 * 60) {
    return { open: false, text: "Cerrado · abre hoy a las 20:00" };
  }
  return { open: true, text: "Abierto ahora · hasta las 00:00" };
}

function paintBusinessStatus() {
  const navStatus = document.getElementById("navStatus");
  const heroStatus = document.getElementById("heroStatus");
  const visitStatus = document.getElementById("visitStatus");

  try {
    const status = getBusinessStatus();
    const stateClass = status.open ? "open" : "closed";

    if (navStatus) {
      navStatus.classList.remove("open", "closed");
      navStatus.classList.add(stateClass);
      const label = navStatus.querySelector("span");
      if (label) label.textContent = status.text;
    }

    if (heroStatus) {
      heroStatus.classList.remove("open", "closed");
      heroStatus.classList.add(stateClass);
      const label = heroStatus.querySelector("span");
      if (label) label.textContent = status.text;
    }

    if (visitStatus) {
      visitStatus.classList.remove("open", "closed");
      visitStatus.classList.add(stateClass);
      visitStatus.textContent = status.text;
    }
  } catch {
    const fallback = "Lun–sáb · 12:00–15:00 · 20:00–00:00";
    const navLabel = navStatus?.querySelector("span");
    const heroLabel = heroStatus?.querySelector("span");
    if (navLabel) navLabel.textContent = fallback;
    if (heroLabel) heroLabel.textContent = fallback;
    if (visitStatus) visitStatus.textContent = fallback;
  }
}

paintBusinessStatus();
setInterval(paintBusinessStatus, 60 * 1000);

function syncPremiumHeader() {
  if (siteHeader) siteHeader.classList.toggle("scrolled", window.scrollY > 28);
}
syncPremiumHeader();
window.addEventListener("scroll", syncPremiumHeader, { passive: true });

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && nav?.classList.contains("open")) {
    nav.classList.remove("open");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.focus();
  }
});

document.addEventListener("click", event => {
  if (!nav?.classList.contains("open")) return;
  const insideNav = nav.contains(event.target);
  const onToggle = toggle?.contains(event.target);
  if (!insideNav && !onToggle) {
    nav.classList.remove("open");
    toggle?.setAttribute("aria-expanded", "false");
  }
});

loadCart();
loadOrderDetails();
renderOrder();
