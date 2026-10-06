const WHATSAPP_NUMBER = "5492901535229";
const CART_KEY = "dlupita-cart-sale-v2";
const BUSINESS_TIME_ZONE = "America/Argentina/Ushuaia";

const menuData = {
  empanadas: [
    { name: "Carne cortada a cuchillo", desc: "Una de las variedades más nombradas por clientes y en la historia publicada por NASA.", tag: "Clásico" },
    { name: "Matambre", desc: "Un sabor muy asociado a la casa y uno de los favoritos mencionados en reseñas.", tag: "Muy pedida" },
    { name: "Cordero", desc: "Una opción bien fueguina para quienes quieren probar algo distinto.", tag: "Fueguina" },
    { name: "Pollo", desc: "Una variedad tradicional para sumar al pedido.", tag: "Clásico" },
    { name: "Roquefort", desc: "Sabor intenso para quienes prefieren quesos con personalidad.", tag: "Intensa" },
    { name: "Otros sabores", desc: "Consultá por las variedades disponibles del día.", tag: "Consultar" }
  ],
  pizzas: [
    { name: "Muzzarella", desc: "La clásica para compartir.", tag: "Clásica" },
    { name: "Jamón y huevo", desc: "Una combinación mencionada entre las recomendaciones de clientes.", tag: "Popular" },
    { name: "Cuatro quesos", desc: "Una de las pizzas destacadas en reseñas públicas.", tag: "Quesos" },
    { name: "Pizza de la casa", desc: "Consultá por las especialidades y variedades disponibles.", tag: "Consultar" }
  ],
  cocina: [
    { name: "Milanesas", desc: "Platos abundantes, uno de los clásicos asociados al local.", tag: "Abundante" },
    { name: "Pastas", desc: "Cocina casera para almuerzo o cena.", tag: "Casero" },
    { name: "Sándwiches y lomitos", desc: "Opciones contundentes para comer en el local o llevar.", tag: "Para llevar" },
    { name: "Hamburguesas", desc: "Consultá disponibilidad y variedades del día.", tag: "Consultar" }
  ],
  paraCompartir: [
    { name: "Docena de empanadas", desc: "Elegí sabores y confirmalos por WhatsApp.", tag: "Grupo" },
    { name: "Media docena de empanadas", desc: "Una buena opción para probar varias variedades.", tag: "Variado" },
    { name: "Pizza + empanadas", desc: "Armá una combinación y consultá disponibilidad.", tag: "Combo" },
    { name: "Pedido para grupo", desc: "Consultá opciones para reuniones o pedidos grandes.", tag: "Consultar" }
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
const siteHeader = document.querySelector(".site-header");
const toast = document.getElementById("toast");

let activeCategory = "empanadas";
let cart = loadCart();
let toastTimer = null;

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
      .map(entry => ({
        key: entry.key,
        qty: Math.min(99, Math.max(1, Number(entry.qty) || 1))
      }));
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

function quantityFor(category, index) {
  return cart.find(entry => entry.key === itemKey(category, index))?.qty || 0;
}

function showToast(message) {
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

function renderMenu() {
  if (!menuList) return;

  const items = menuData[activeCategory] || [];

  menuList.innerHTML = items.map((item, index) => {
    const qty = quantityFor(activeCategory, index);
    const hasPhoto = activeCategory === "empanadas" || activeCategory === "pizzas";
    const photoLabel = activeCategory === "empanadas"
      ? (item.name === "Otros sabores" ? "Empanadas surtidas" : `Empanada de ${item.name}`)
      : activeCategory === "pizzas"
        ? (/^pizza/i.test(item.name) ? item.name : `Pizza ${item.name}`)
        : item.name;

    return `
      <article class="menu-item${hasPhoto ? " menu-item-with-photo" : ""}">
        ${hasPhoto ? `
          <div
            class="menu-item-photo menu-photo-${activeCategory}-${index}"
            role="img"
            aria-label="${photoLabel}">
            <span>Imagen ilustrativa</span>
          </div>
        ` : ""}
        <div class="menu-item-copy">
          <span class="menu-item-kicker">${item.tag}</span>
          <h3>${item.name}</h3>
          <p>${item.desc}</p>
        </div>
        <button
          class="add-item${qty ? " is-added" : ""}"
          type="button"
          data-add
          data-category="${activeCategory}"
          data-index="${index}"
          aria-label="Agregar ${item.name} al pedido">
          ${qty ? `Sumar otro · ${qty}` : "Agregar al pedido +"}
        </button>
      </article>
    `;
  }).join("");
}

function updateQuickAddButtons() {
  document.querySelectorAll("[data-quick-category][data-quick-index]").forEach(button => {
    const category = button.dataset.quickCategory;
    const index = Number(button.dataset.quickIndex);
    const qty = quantityFor(category, index);

    button.classList.toggle("is-added", qty > 0);
    button.textContent = qty > 0 ? `Sumar otro · ${qty}` : "Sumar al pedido +";
  });
}

function cartEntryData(entry) {
  const [category, index] = entry.key.split(":");
  const item = getItem(category, index);

  return item
    ? { category, index: Number(index), item, qty: entry.qty }
    : null;
}

function formatOrderItem(data) {
  if (!data) return "";

  if (data.category === "empanadas") {
    if (data.item.name === "Otros sabores") return "Empanadas · otros sabores";
    return `Empanada de ${data.item.name}`;
  }

  if (data.category === "pizzas") {
    return /^pizza/i.test(data.item.name)
      ? data.item.name
      : `Pizza ${data.item.name}`;
  }

  return data.item.name;
}

function renderCart() {
  const total = totalQuantity();

  if (cartCount) cartCount.textContent = total;
  if (navCartCount) navCartCount.textContent = total;
  if (mobileCartCount) mobileCartCount.textContent = total;
  if (clearCartButton) clearCartButton.disabled = total === 0;
  if (sendOrderButton) sendOrderButton.disabled = total === 0;
  if (mobileCart) mobileCart.hidden = total === 0;

  if (cartList) {
    if (!cart.length) {
      cartList.innerHTML = '<div class="cart-empty">Todavía no agregaste nada.<br>Elegí productos de la carta para armar tu consulta.</div>';
    } else {
      cartList.innerHTML = cart.map(entry => {
        const data = cartEntryData(entry);
        if (!data) return "";

        return `
          <div class="cart-line" data-key="${entry.key}">
            <div>
              <div class="cart-line-title">${formatOrderItem(data)}</div>
              <div class="cart-line-category">${categoryNames[data.category]}</div>
            </div>
            <div class="cart-controls">
              <button type="button" data-change="-1" aria-label="Quitar uno de ${data.item.name}">−</button>
              <strong>${entry.qty}</strong>
              <button type="button" data-change="1" aria-label="Agregar uno de ${data.item.name}">+</button>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  renderMenu();
  updateQuickAddButtons();
}

function addItem(category, index, announce = true) {
  const item = getItem(category, index);
  if (!item) return;

  const key = itemKey(category, index);
  const existing = cart.find(entry => entry.key === key);

  if (existing) {
    existing.qty = Math.min(99, existing.qty + 1);
  } else {
    cart.push({ key, qty: 1 });
  }

  saveCart();
  renderCart();

  if (announce) {
    showToast(`${formatOrderItem({ category, item })} agregado al pedido`);
  }
}

function changeQuantity(key, delta) {
  const entry = cart.find(item => item.key === key);
  if (!entry) return;

  entry.qty += delta;

  if (entry.qty <= 0) {
    cart = cart.filter(item => item.key !== key);
  } else {
    entry.qty = Math.min(99, entry.qty);
  }

  saveCart();
  renderCart();
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
  showToast("Pedido vaciado");
}

function buildOrderMessage() {
  const lines = cart.map(entry => {
    const data = cartEntryData(entry);
    return data ? `• ${entry.qty} × ${formatOrderItem(data)}` : null;
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
});

document.addEventListener("click", event => {
  const quickButton = event.target.closest("[data-quick-category][data-quick-index]");
  if (!quickButton) return;

  const category = quickButton.dataset.quickCategory;
  const index = Number(quickButton.dataset.quickIndex);

  addItem(category, index);
});

tabs.forEach((tab, index) => {
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-selected", tab.classList.contains("active") ? "true" : "false");
  tab.setAttribute("tabindex", tab.classList.contains("active") ? "0" : "-1");

  tab.addEventListener("click", () => activateTab(tab));

  tab.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;

    event.preventDefault();

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + direction + tabs.length) % tabs.length];

    next.focus();
    activateTab(next);
  });
});

function activateTab(tab) {
  activeCategory = tab.dataset.category;

  tabs.forEach(button => {
    const active = button === tab;

    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.setAttribute("tabindex", active ? "0" : "-1");
  });

  renderMenu();
}

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
  window.open(url, "_blank", "noopener,noreferrer");
});

function closeNavigation() {
  if (!mainNav || !navToggle) return;

  mainNav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
}

navToggle?.addEventListener("click", () => {
  if (!mainNav) return;

  const open = mainNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", closeNavigation);
});

document.addEventListener("click", event => {
  if (!mainNav?.classList.contains("open")) return;
  if (mainNav.contains(event.target) || navToggle?.contains(event.target)) return;

  closeNavigation();
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !mainNav?.classList.contains("open")) return;

  closeNavigation();
  navToggle?.focus();
});

function getUshuaiaTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const getValue = type => parts.find(part => part.type === type)?.value;
  const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    day: days[getValue("weekday")],
    minutes: Number(getValue("hour")) * 60 + Number(getValue("minute"))
  };
}

function getBusinessStatus(date = new Date()) {
  const { day, minutes } = getUshuaiaTime(date);

  if (day === 0) {
    return { open: false, short: "Cerrado ahora", detail: "Abre el lunes a las 12:00" };
  }

  if (minutes < 12 * 60) {
    return { open: false, short: "Cerrado ahora", detail: "Abre hoy a las 12:00" };
  }

  if (minutes < 15 * 60) {
    return { open: true, short: "Abierto ahora", detail: "Hasta las 15:00" };
  }

  if (minutes < 20 * 60) {
    return { open: false, short: "Cerrado ahora", detail: "Abre hoy a las 20:00" };
  }

  return { open: true, short: "Abierto ahora", detail: "Hasta las 00:00" };
}

function paintBusinessStatus() {
  let status;

  try {
    status = getBusinessStatus();
  } catch {
    status = {
      open: false,
      short: "Consultar horario",
      detail: "Lun–Sáb · 12:00–15:00 · 20:00–00:00"
    };
  }

  const targets = [
    document.getElementById("businessStatusNav"),
    document.getElementById("businessStatusHero"),
    document.getElementById("businessStatusVisit")
  ].filter(Boolean);

  targets.forEach(element => {
    element.classList.toggle("is-open", status.open);
    element.classList.toggle("is-closed", !status.open);
    element.textContent = status.short;
    element.title = status.detail;
  });

  const heroDetail = document.getElementById("businessStatusHeroDetail");
  if (heroDetail) heroDetail.textContent = status.detail;

  const detail = document.getElementById("businessStatusDetail");
  if (detail) detail.textContent = `${status.detail} · según horario habitual publicado`;
}

function setupRevealAnimations() {
  const elements = [...document.querySelectorAll(".reveal")];

  if (
    !("IntersectionObserver" in window) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    elements.forEach(element => element.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.1,
    rootMargin: "0px 0px -28px 0px"
  });

  elements.forEach(element => observer.observe(element));
}

function updateHeaderState() {
  siteHeader?.classList.toggle("is-scrolled", window.scrollY > 18);
}

window.addEventListener("scroll", updateHeaderState, { passive: true });

window.addEventListener("resize", () => {
  if (window.innerWidth > 860) closeNavigation();
});

renderCart();
paintBusinessStatus();
setupRevealAnimations();
updateHeaderState();

setInterval(paintBusinessStatus, 60 * 1000);