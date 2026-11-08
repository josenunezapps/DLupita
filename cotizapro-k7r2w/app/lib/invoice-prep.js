// Preparación comercial para facturación. NO constituye comprobante fiscal ni solicita CAE.
// Los datos fiscales y el tipo de comprobante deben ser verificados por el emisor.
export function invoiceChecklist(model) {
  const errors = [];
  const issuer = model?.issuer || {};
  const customer = model?.customer || {};
  const total = Number(model?.totals?.total_minor);
  const cuit = String(issuer.tax_id || '').replace(/\D/g, '');
  if (cuit.length !== 11) errors.push('Cargá el CUIT de 11 dígitos del negocio.');
  if (!String(issuer.name || '').trim()) errors.push('Completá el nombre del negocio.');
  if (!String(customer.name || '').trim()) errors.push('Completá el nombre del cliente.');
  if (!Number.isSafeInteger(total) || total <= 0) errors.push('El importe debe ser mayor que cero.');
  if (model?.currency !== 'ARS') errors.push('Esta preparación inicial está limitada a presupuestos en ARS.');
  return errors;
}
export function invoiceSummary(model) {
  const customer = model.customer || {};
  const issuer = model.issuer || {};
  return [
    'DATOS PARA PREPARAR FACTURA (NO ES UNA FACTURA)',
    'Presupuesto: ' + (model.number || 'sin número'),
    'Emisor: ' + (issuer.name || 'Sin nombre'),
    'CUIT emisor: ' + (issuer.tax_id || 'Sin CUIT'),
    'Cliente: ' + (customer.name || 'Sin nombre'),
    'CUIT/DNI cliente: ' + (customer.tax_id || 'No informado'),
    'Concepto: ' + (model.title || ''),
    ...((model.items || []).map(x => '- ' + x.description)),
    'Total presupuesto ARS: ' + (Number(model.totals?.total_minor || 0) / 100).toFixed(2),
    'IMPORTANTE: verificar condición fiscal, tipo de comprobante, punto de venta, IVA, percepción, fechas y total antes de emitir en ARCA.',
    'No se solicitó CAE ni se emitió comprobante fiscal.',
  ].join('\n');
}
