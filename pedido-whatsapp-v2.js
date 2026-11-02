/* Doña Lupita · carrito v2: pedido de WhatsApp y sugerencia opcional de bebidas. */
(function () {
  'use strict';

  /* Celular de pedidos publicado por Doña Lupita. Confirmar que tenga WhatsApp. */
  var WHATSAPP_NUMBER = '5492901559998';
  var DRAFT_KEY = 'dlupita-order-draft-v2';
  var DRAFT_VALID_MS = 30 * 60 * 1000;

  function selectedItems() {
    var cart;
    try { cart = JSON.parse(localStorage.getItem('lupita-cart') || '{}'); }
    catch (err) { cart = {}; }
    if (!cart || typeof cart !== 'object' || Array.isArray(cart)) return [];
    var products = typeof VARIETIES !== 'undefined' && Array.isArray(VARIETIES) ? VARIETIES : [];
    var categories = typeof CATEGORIES !== 'undefined' && Array.isArray(CATEGORIES) ? CATEGORIES : [];
    return Object.entries(cart).map(function (entry) {
      var id = entry[0], quantity = Number(entry[1]);
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      quantity = Math.floor(quantity);
      if (quantity < 1) return null;
      var product = products.find(function (item) { return item.id === id; });
      var category = product && categories.find(function (cat) { return cat.id === product.category; });
      return {
        id: id,
        name: product ? product.name : id,
        category: category ? category.name : (product ? product.category : ''),
        quantity: quantity,
        isDrink: id.indexOf('bebida-') === 0 || !!(product && product.category === 'bebidas')
      };
    }).filter(Boolean);
  }

  function main() {
    var form = document.getElementById('whatsapp-order-form');
    var cartEl = document.getElementById('cartitems');
    var modal = document.getElementById('drinks-upsell');
    if (!form || !modal) return;
    var mode = form.elements['order-mode'];
    var name = form.elements['order-name'];
    var address = form.elements['order-address'];
    var note = form.elements['order-note'];
    var addressWrap = document.getElementById('delivery-address-wrap');
    var sendButton = document.getElementById('consultar');
    var feedback = document.getElementById('order-feedback');
    var addDrinkButton = document.getElementById('drinks-add');
    var skipDrinkButton = document.getElementById('drinks-skip');
    var dismissButton = document.getElementById('drinks-dismiss');

    function showError(message) {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.hidden = false;
    }
    function clearError() {
      if (!feedback) return;
      feedback.textContent = '';
      feedback.hidden = true;
    }
    function updateDelivery() {
      var delivery = mode.value === 'delivery';
      addressWrap.hidden = !delivery;
      address.required = delivery;
      /* Keep the address while switching modes; it is omitted for pickup. */
    }
    function updateButton() {
      var hasItems = selectedItems().length > 0;
      sendButton.disabled = !hasItems;
      sendButton.title = hasItems ? 'Continuar con el pedido' : 'Agregá productos al carrito';
      if (!hasItems) showError('Elegí al menos un producto para preparar tu pedido.');
      else clearError();
    }

    function captureDraft() {
      return {
        timestamp: Date.now(),
        name: name.value,
        mode: mode.value,
        address: address.value,
        note: note.value
      };
    }
    function saveDraft() {
      try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(captureDraft())); } catch (err) {}
    }
    function restoreDraft() {
      try {
        var raw = sessionStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        sessionStorage.removeItem(DRAFT_KEY);
        var draft = JSON.parse(raw);
        if (!draft || typeof draft.timestamp !== 'number' ||
            Date.now() - draft.timestamp > DRAFT_VALID_MS) return;
        name.value = typeof draft.name === 'string' ? draft.name : '';
        mode.value = draft.mode === 'delivery' ? 'delivery' : 'pickup';
        address.value = typeof draft.address === 'string' ? draft.address : '';
        note.value = typeof draft.note === 'string' ? draft.note : '';
      } catch (err) {}
    }
    function formIsValid() {
      if (!selectedItems().length) {
        showError('El carrito está vacío. Agregá productos para continuar.');
        return false;
      }
      if (!form.reportValidity()) return false;
      if (mode.value === 'delivery' && !address.value.trim()) {
        showError('Ingresá una dirección para la entrega.');
        address.focus();
        return false;
      }
      return true;
    }
    function openWhatsApp() {
      var items = selectedItems();
      if (!items.length || !formIsValid()) return;
      var isDelivery = mode.value === 'delivery';
      var qty = items.reduce(function (total, item) { return total + item.quantity; }, 0);
      var lines = [
        'Hola Doña Lupita, quiero hacer este pedido desde la página web:',
        '',
        '*MI PEDIDO*'
      ];
      items.forEach(function (item) {
        lines.push('• ' + item.quantity + ' × ' + item.name +
          (item.category ? ' (' + item.category + ')' : ''));
      });
      lines.push(
        '',
        '*Total de unidades:* ' + qty,
        '*Modalidad:* ' + (isDelivery ? 'Envío a domicilio' : 'Retiro en el local')
      );
      if (name.value.trim()) lines.push('*Nombre:* ' + name.value.trim());
      if (isDelivery) lines.push('*Dirección:* ' + address.value.trim());
      if (note.value.trim()) lines.push('*Indicaciones:* ' + note.value.trim());
      lines.push('', '¿Me confirman el importe total y el tiempo estimado?', '¡Gracias!');
      var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' +
        encodeURIComponent(lines.join('\n'));
      try { sessionStorage.removeItem(DRAFT_KEY); } catch (err) {}
      /* Only open prefilled message. Customer has to press Enviar in WhatsApp. */
      var tab = window.open(url, '_blank');
      if (tab) { try { tab.opener = null; } catch (err) {} }
      else window.location.assign(url);
    }

    function closeModal() {
      if (modal.open) modal.close();
    }
    function offerDrinkIfNeeded() {
      var items = selectedItems();
      if (items.some(function (item) { return item.isDrink; })) {
        openWhatsApp();
        return;
      }
      modal.showModal();
      skipDrinkButton.focus();
    }
    mode.addEventListener('change', function () { updateDelivery(); clearError(); });
    form.addEventListener('input', clearError);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      clearError();
      if (!formIsValid()) return;
      offerDrinkIfNeeded();
    });
    skipDrinkButton.addEventListener('click', function () {
      closeModal();
      openWhatsApp();
    });
    addDrinkButton.addEventListener('click', function () {
      saveDraft();
      closeModal();
      window.location.assign('bebidas.html');
    });
    dismissButton.addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });
    window.addEventListener('storage', updateButton);
    if (cartEl) cartEl.addEventListener('click', function () {
      /* Inline quantity handlers run first; update after they finish. */
      queueMicrotask(updateButton);
    });
    window.addEventListener('pageshow', updateButton);

    restoreDraft();
    updateDelivery();
    updateButton();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main);
  else main();
})();