/* Doña Lupita - redacta el pedido y abre WhatsApp para que el cliente lo envíe. */
(function(){
  'use strict';
  /* Celular para pedidos publicado por Doña Lupita: 2901 559998.
     Pendiente de confirmar que este número tenga WhatsApp activo. */
  var WHATSAPP_NUMBER='5492901559998';

  function selectedItems(){
    var cart;
    try { cart=JSON.parse(localStorage.getItem('lupita-cart')||'{}'); } catch(err){ cart={}; }
    if(!cart||typeof cart!=='object'||Array.isArray(cart))return [];
    return Object.entries(cart).map(function(entry){
      var id=entry[0],qty=Number(entry[1]);
      if(!Number.isFinite(qty)||qty<=0)return null;
      var product=(typeof VARIETIES!=='undefined'&&Array.isArray(VARIETIES))?VARIETIES.find(function(p){return p.id===id}):null;
      var cat=product&&(typeof CATEGORIES!=='undefined'&&Array.isArray(CATEGORIES))?CATEGORIES.find(function(c){return c.id===product.category}):null;
      return {id:id,quantity:Math.floor(qty),name:product?product.name:id,category:cat?cat.name:''};
    }).filter(Boolean);
  }

  function showFormError(message){
    var el=document.getElementById('order-feedback');
    if(el){el.textContent=message;el.hidden=false;}
  }
  function clearFormError(){
    var el=document.getElementById('order-feedback');
    if(el){el.textContent='';el.hidden=true;}
  }

  function init(){
    var form=document.getElementById('whatsapp-order-form');
    if(!form)return;
    var delivery=form.querySelector('[name="order-mode"]');
    var addressWrap=document.getElementById('delivery-address-wrap');
    var address=form.querySelector('[name="order-address"]');
    var submit=form.querySelector('[type="submit"]');
    function toggleDelivery(){
      var isDelivery=delivery&&delivery.value==='delivery';
      if(addressWrap)addressWrap.hidden=!isDelivery;
      if(address){address.required=isDelivery;if(!isDelivery)address.value='';}
    }
    if(delivery)delivery.addEventListener('change',toggleDelivery);
    toggleDelivery();

    function updateButton(){
      if(!submit)return;
      var hasItems=selectedItems().length>0;
      submit.disabled=!hasItems;
      submit.title=hasItems?'Abrir el pedido en WhatsApp':'Primero agregá productos al carrito';
      if(!hasItems)showFormError('Agregá productos al carrito para preparar tu pedido.');
      else clearFormError();
    }
    form.addEventListener('submit',function(event){
      event.preventDefault();
      clearFormError();
      var items=selectedItems();
      if(!items.length){showFormError('El carrito está vacío. Elegí productos antes de continuar.');updateButton();return;}
      var mode=delivery&&delivery.value==='delivery'?'Envío a domicilio':'Retiro en el local';
      var customer=(form.querySelector('[name="order-name"]')?.value||'').trim();
      var deliveryAddress=(address?.value||'').trim();
      var note=(form.querySelector('[name="order-note"]')?.value||'').trim();
      if(mode==='Envío a domicilio'&&!deliveryAddress){
        showFormError('Ingresá la dirección para el envío a domicilio.');
        address?.focus();
        return;
      }
      var quantity=items.reduce(function(n,p){return n+p.quantity;},0);
      var lines=[
        'Hola Doña Lupita, quiero hacer este pedido desde su página web:',
        '',
        '*MI PEDIDO*'
      ];
      items.forEach(function(p){
        lines.push('• '+p.quantity+' × '+p.name+(p.category?' ('+p.category+')':''));
      });
      lines.push('','*Total de unidades:* '+quantity,'*Modalidad:* '+mode);
      if(customer)lines.push('*Nombre:* '+customer);
      if(mode==='Envío a domicilio')lines.push('*Dirección:* '+deliveryAddress);
      if(note)lines.push('*Observaciones:* '+note);
      lines.push('','¿Me confirman disponibilidad, importe total y tiempo estimado?','¡Gracias!');
      var link='https://wa.me/'+WHATSAPP_NUMBER+'?text='+encodeURIComponent(lines.join('\n'));
      /* Solo abre WhatsApp; enviar requiere confirmación manual del cliente. */
      var opened=window.open(link,'_blank');
      if(opened){try{opened.opener=null;}catch(err){}}
      else{window.location.assign(link);}
    });
    window.addEventListener('storage',updateButton);
    form.addEventListener('change',clearFormError);
    /* Cantidades se actualizan por la app de carrito; revisar después de cambios. */
    document.getElementById('cartitems')?.addEventListener('click',function(){
      queueMicrotask(updateButton);
    });
    updateButton();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();