const WHATSAPP_NUMBER = "5492901559998";
const CART_KEY = "dlupita-cart-v2";

const menuData = {
  empanadas: [
    { name: "Carne cortada a cuchillo", desc: "Una de las variedades más mencionadas por clientes y por la historia de NASA." },
    { name: "Matambre", desc: "Otro clásico identificado públicamente con la casa." },
    { name: "Pollo", desc: "Una de las variedades que NASA registró entre sus pedidos." },
    { name: "Roquefort", desc: "Sabor intenso, también documentado entre las opciones del local." },
    { name: "Cordero", desc: "Opción fueguina mencionada en reseñas recientes." },
    { name: "Otros sabores", desc: "Consultá por las variedades disponibles del día." }
  ],
  pizzas: [
    { name: "Muzzarella", desc: "La clásica para compartir." },
    { name: "Jamón y huevo", desc: "Variedad mencionada entre las recomendaciones de clientes." },
    { name: "Cuatro quesos", desc: "Una de las pizzas recomendadas en reseñas recientes." },
    { name: "Pizza de la casa", desc: "Consultá las especialidades y variedades disponibles." }
  ],
  cocina: [
    { name: "Milanesas", desc: "Platos abundantes, uno de los clásicos asociados al local." },
    { name: "Pastas", desc: "Cocina casera para almuerzo o cena." },
    { name: "Sándwiches y lomitos", desc: "Opciones contundentes para comer en el local o llevar." },
    { name: "Hamburguesas", desc: "Consultá disponibilidad y variedades." }
  ],
  paraCompartir: [
    { name: "Docena de empanadas", desc: "Elegí sabores y confirmalos por WhatsApp." },
    { name: "Media docena de empanadas", desc: "Para probar varias opciones." },
    { name: "Pizza + empanadas", desc: "Armá una combinación y consultá disponibilidad." },
    { name: "Pedido para grupo", desc: "Consultá opciones para reuniones o pedidos grandes." }
  ]
};

const categoryNames = {
  empanadas: "Empanadas",
  pizzas: "Pizzas",
  cocina: "Cocina",
  paraCompartir: "Para compartir"
};

const menuList = document.getElementById("menuList");
const tabs = [...document.querySelectorAll(".menu-tab")];
const cartList = document.getElementById("cartList");
const cartCount = document.getElementById("cartCount");
const navCartCount = document.getElementById("navCartCount");
const mobileCart = document.getElementById("mobileCart");
const mobileCartCount = document.getElementById("mobileCartCount");
const clearCartButton = document.getElementById("clearCart");
const sendOrderButton = document.getElementById("sendOrder");
const customerName = document.getElementById("customerName");
const orderMode = document.getElementById("orderMode");
const orderNotes = document.getElementById("orderNotes");
const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.getElementById("mainNav");

let activeCategory = "empanadas";
let cart = loadCart();

function itemKey(category, index) {
  return `${category}:${index}`;
}

function getItem(category, index) {
  return menuData[category]?.[Number(index)] || null;
}

function loadCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(entry => {
        const [category, index] = String(entry.key || "").split(":");
        return getItem(category, index) && Number(entry.qty) > 0;
      })
      .map(entry => ({ key: entry.key, qty: Math.min(99, Math.max(1, Number(entry.qty) || 1)) }));
  } catch {
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {}
}

function totalQuantity() {
  return cart.reduce((sum, entry) => sum + entry.qty, 0);
}

function renderMenu() {
  if (!menuList) return;
  const items = menuData[activeCategory];
  menuList.innerHTML = items.map((item, index) => `
    <article class="menu-item">
      <div>
        <h3>${item.name}</h3>
        <p>${item.desc}</p>
      </div>
      <button class="add-item" type="button" data-add data-category="${activeCategory}" data-index="${index}">Agregar +</button>
    </article>
  `).join("");
}

function cartEntryData(entry) {
  const [category, index] = entry.key.split(":");
  const item = getItem(category, index);
  return item ? { category, index: Number(index), item, qty: entry.qty } : null;
}

function renderCart() {
  const total = totalQuantity();

  if (cartCount) cartCount.textContent = total;
  if (navCartCount) navCartCount.textContent = total;
  if (mobileCartCount) mobileCartCount.textContent = total;
  if (clearCartButton) clearCartButton.disabled = total === 0;
  if (sendOrderButton) sendOrderButton.disabled = total === 0;
  if (mobileCart) mobileCart.hidden = total === 0;

  if (!cartList) return;

  if (!cart.length) {
    cartList.innerHTML = '<div class="cart-empty">Todavía no agregaste productos.</div>';
    return;
  }

  cartList.innerHTML = cart.map(entry => {
    const data = cartEntryData(entry);
    if (!data) return "";
    return `
      <div class="cart-line" data-key="${entry.key}">
        <div>
          <div class="cart-line-title">${data.item.name}</div>
          <div class="cart-line-category">${categoryNames[data.category]}</div>
        </div>
        <div class="cart-controls">
          <button type="button" data-change="-1" aria-label="Quitar uno">−</button>
          <strong>${entry.qty}</strong>
          <button type="button" data-change="1" aria-label="Agregar uno">+</button>
        </div>
      </div>
    `;
  }).join("");
}

function addItem(category, index) {
  if (!getItem(category, index)) return;
  const key = itemKey(category, index);
  const existing = cart.find(entry => entry.key === key);
  if (existing) existing.qty = Math.min(99, existing.qty + 1);
  else cart.push({ key, qty: 1 });
  saveCart();
  renderCart();
}

function changeQuantity(key, delta) {
  const entry = cart.find(item => item.key === key);
  if (!entry) return;
  entry.qty += delta;
  if (entry.qty <= 0) cart = cart.filter(item => item.key !== key);
  else entry.qty = Math.min(99, entry.qty);
  saveCart();
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

function buildOrderMessage() {
  const lines = cart.map(entry => {
    const data = cartEntryData(entry);
    return data ? `• ${entry.qty} × ${data.item.name}` : null;
  }).filter(Boolean);

  const name = customerName?.value.trim();
  const mode = orderMode?.value || "Retiro en el local";
  const notes = orderNotes?.value.trim();

  return [
    "Hola Doña Lupita, quiero consultar por este pedido:",
    "",
    ...lines,
    "",
    name ? `Nombre: ${name}` : null,
    `Modalidad: ${mode}`,
    notes ? `Aclaraciones: ${notes}` : null,
    "",
    "¿Me confirman disponibilidad y precio final? Gracias."
  ].filter(line => line !== null).join("\n");
}

menuList?.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  addItem(button.dataset.category, Number(button.dataset.index));
  const original = button.textContent;
  button.textContent = "Agregado ✓";
  setTimeout(() => { button.textContent = original; }, 800);
});

tabs.forEach(tab => {
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", tab.classList.contains("active") ? "true" : "false");
  tab.addEventListener("click", () => {
    activeCategory = tab.dataset.category;
    tabs.forEach(button => {
      const active = button === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderMenu();
  });
});

cartList?.addEventListener("click", event => {
  const button = event.target.closest("[data-change]");
  const line = event.target.closest("[data-key]");
  if (!button || !line) return;
  changeQuantity(line.dataset.key, Number(button.dataset.change));
});

clearCartButton?.addEventListener("click", clearCart);

sendOrderButton?.addEventListener("click", () => {
  if (!cart.length) return;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildOrderMessage())}`;
  window.open(url, "_blank", "noopener");
});

navToggle?.addEventListener("click", () => {
  const open = mainNav?.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(Boolean(open)));
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

document.addEventListener("click", event => {
  if (!mainNav?.classList.contains("open")) return;
  if (mainNav.contains(event.target) || navToggle?.contains(event.target)) return;
  mainNav.classList.remove("open");
  navToggle?.setAttribute("aria-expanded", "false");
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !mainNav?.classList.contains("open")) return;
  mainNav.classList.remove("open");
  navToggle?.setAttribute("aria-expanded", "false");
  navToggle?.focus();
});

renderMenu();
renderCart();

/* Estado abierto/cerrado según el horario publicado de Doña Lupita.
   Zona horaria fija de Ushuaia para que no dependa del reloj local del visitante. */
const BUSINESS_TIME_ZONE = "America/Argentina/Ushuaia";

function getUshuaiaTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const getPart = type => parts.find(part => part.type === type)?.value;
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    day: days[getPart("weekday")],
    minutes: Number(getPart("hour")) * 60 + Number(getPart("minute"))
  };
}

function getBusinessStatus(date = new Date()) {
  const { day, minutes } = getUshuaiaTime(date);

  if (day === 0) {
    return {
      open: false,
      short: "Cerrado ahora",
      detail: "Abre el lunes a las 12:00"
    };
  }

  if (minutes < 12 * 60) {
    return {
      open: false,
      short: "Cerrado ahora",
      detail: "Abre hoy a las 12:00"
    };
  }

  if (minutes < 15 * 60) {
    return {
      open: true,
      short: "Abierto ahora",
      detail: "Hasta las 15:00"
    };
  }

  if (minutes < 20 * 60) {
    return {
      open: false,
      short: "Cerrado ahora",
      detail: "Abre hoy a las 20:00"
    };
  }

  return {
    open: true,
    short: "Abierto ahora",
    detail: "Hasta las 00:00"
  };
}

function installBusinessStatusUI() {
  if (document.getElementById("business-status-style")) return;

  const style = document.createElement("style");
  style.id = "business-status-style";
  style.textContent = `
    .business-status{
      display:inline-flex;
      align-items:center;
      gap:8px;
      font-weight:800;
      line-height:1.2;
    }
    .business-status::before{
      content:"";
      width:9px;
      height:9px;
      border-radius:50%;
      flex:0 0 9px;
      background:#8b1e2d;
      box-shadow:0 0 0 4px rgba(139,30,45,.12);
    }
    .business-status.is-open::before{
      background:#28b36a;
      box-shadow:0 0 0 4px rgba(40,179,106,.15),0 0 16px rgba(40,179,106,.42);
    }
    .business-status.is-closed::before{
      background:#d34d55;
      box-shadow:0 0 0 4px rgba(211,77,85,.14);
    }
    .business-status-nav{
      font-size:.78rem;
      color:#625b54;
      white-space:nowrap;
    }
    .business-status-nav.is-open{color:#147848}
    .business-status-nav.is-closed{color:#a33740}
    .business-status-hero{
      color:rgba(255,255,255,.9);
    }
    .business-status-visit{
      margin-top:5px;
      color:#fff;
    }
    .business-status-detail{
      display:block;
      margin-top:5px;
      font-size:.72rem;
      font-weight:600;
      opacity:.72;
    }
    @media (max-width:1040px){
      .business-status-nav{display:none}
    }
    @media (max-width:820px){
      .business-status-nav{
        display:flex;
        margin:7px 14px 5px;
        padding:10px 12px;
        border-radius:12px;
        background:rgba(29,27,24,.05);
      }
    }
  `;
  document.head.appendChild(style);

  const navOrder = mainNav?.querySelector(".nav-order");
  if (navOrder && !document.getElementById("businessStatusNav")) {
    navOrder.insertAdjacentHTML(
      "beforebegin",
      '<span class="business-status business-status-nav" id="businessStatusNav" aria-live="polite">Consultando horario…</span>'
    );
  }

  const heroMeta = document.querySelector(".hero-meta");
  if (heroMeta && !document.getElementById("businessStatusHero")) {
    heroMeta.insertAdjacentHTML(
      "afterbegin",
      '<span class="business-status business-status-hero" id="businessStatusHero" aria-live="polite">Consultando horario…</span>'
    );
  }

  const visitDetails = document.querySelector(".visit-details");
  if (visitDetails && !document.getElementById("businessStatusVisit")) {
    visitDetails.insertAdjacentHTML(
      "afterbegin",
      '<div><small>ESTADO SEGÚN HORARIO PUBLICADO</small><strong class="business-status business-status-visit" id="businessStatusVisit" aria-live="polite">Consultando horario…</strong><span id="businessStatusDetail">Horario habitual: Lun–Sáb · 12:00–15:00 · 20:00–00:00</span></div>'
    );
  }
}

function paintBusinessStatus() {
  const status = getBusinessStatus();
  const targets = [
    document.getElementById("businessStatusNav"),
    document.getElementById("businessStatusHero"),
    document.getElementById("businessStatusVisit")
  ].filter(Boolean);

  targets.forEach(element => {
    element.classList.toggle("is-open", status.open);
    element.classList.toggle("is-closed", !status.open);
    element.textContent = status.short;
  });

  const detail = document.getElementById("businessStatusDetail");
  if (detail) {
    detail.textContent = `${status.detail} · según horario habitual publicado`;
  }
}

installBusinessStatusUI();
paintBusinessStatus();
setInterval(paintBusinessStatus, 60 * 1000);
