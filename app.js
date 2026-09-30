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
