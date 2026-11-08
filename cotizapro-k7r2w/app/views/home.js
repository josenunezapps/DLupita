import { h, banner } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { formatMoney } from '../lib/money.js';
import { effectiveStatus, quoteNumber, todayISO } from '../lib/quotes.js';
import { shell } from './shell.js';
import { statusBadge } from './quotes.js';

export async function homeView(ctx) {
  const org = ctx.state.org;
  const stats = h('div', { class: 'stats' }, [1, 2, 3, 4].map(() => h('div', { class: 'skeleton stat' })));
  const chartBox = h('div', { class: 'dash-chart-bars' });
  const chartTotal = h('div', { class: 'dash-chart-total' }, '—');
  const donutBox = h('div', { class: 'dash-donut-wrap' });
  const recent = h('div', { class: 'list' }, [1, 2].map(() => h('div', { class: 'skeleton row' })));
  const checklist = h('ol', { class: 'checklist' });
  const checkCard = h('section', { class: 'card' }, h('h2', {}, 'Para empezar'), checklist);

  shell(ctx, {
    section: 'inicio',
    title: 'Inicio',
    actions: h('a', { class: 'btn btn-primary', href: '#/presupuestos/nuevo' }, '+ Nuevo presupuesto'),
  },
    h('div', { class: 'dashboard-header' }, h('div', {}, h('div', { class: 'dashboard-eyebrow' }, 'PANEL DE CONTROL'), h('p', { class: 'dashboard-intro' }, 'Gestioná presupuestos, clientes y trabajos en un solo lugar.'))),
    stats,
    h('div', { class: 'dash-grid' },
      h('section', { class: 'card dash-panel' }, h('h2', {}, 'Evolución del monto presupuestado'), h('p', { class: 'muted' }, 'Últimos seis meses · presupuestos emitidos'), chartTotal, chartBox),
      h('section', { class: 'card dash-panel' }, h('h2', {}, 'Estado de presupuestos'), h('p', { class: 'muted' }, 'Distribución de presupuestos emitidos'), donutBox)),
    h('section', { class: 'stack-sm' },
      h('div', { class: 'section-head' }, h('h2', {}, 'Últimos presupuestos'), h('a', { href: '#/presupuestos' }, 'Ver todos')),
      recent,
    ),
    checkCard,
  );

  try {
    const [quotes, customers, items] = await Promise.all([
      db.select('quotes', 'select=id,number,title,status,valid_until,currency,quote_total,created_at,customers(name)&order=created_at.desc&limit=200'),
      db.count('customers', 'archived=eq.false'),
      db.count('catalog_items', 'archived=eq.false'),
    ]);
    const today = todayISO();
    const open = quotes.filter((q) => ['emitido', 'enviado'].includes(effectiveStatus(q, today)));
    const accepted = quotes.filter((q) => q.status === 'aceptado');
    const acceptedTotal = accepted.reduce((s, q) => s + (Number(q.quote_total) || 0), 0);

    const issuedRows = quotes.filter(q => q.status !== 'borrador');
    const monthKey = today.slice(0, 7);
    const thisMonth = issuedRows.filter(q => String(q.created_at || '').startsWith(monthKey));
    const monthTotal = thisMonth.reduce((sum,q) => sum + (Number(q.quote_total) || 0), 0);
    stats.replaceChildren(
      statCard('Presupuestos emitidos', String(issuedRows.length), '#/presupuestos'),
      statCard('Aceptados', String(accepted.length), '#/presupuestos', accepted.length ? formatMoney(acceptedTotal, org.currency) : null),
      statCard('Pendientes', String(open.length), '#/presupuestos'),
      statCard('Total del mes', formatMoney(monthTotal, org.currency), '#/presupuestos')
    );
    const n=issuedRows.length, a=accepted.length, p=open.length;
    const others=Math.max(0,n-a-p);
    const pct=v=>n?100*v/n:0;
    const circle=h('div',{class:'dash-donut',style:'background:conic-gradient(#65946c 0% '+pct(a)+'%,#f29138 '+pct(a)+'% '+pct(a+p)+'%,#dbb9a1 '+pct(a+p)+'% 100%)'},
      h('span',{},String(n),h('small',{},'Total')));
    const legend=h('div',{class:'dash-legend'},...[
      ['Aceptados',a,'#65946c'],['Pendientes',p,'#f29138'],['Otros estados',others,'#dbb9a1']
    ].map(([name,count,color])=>h('div',{class:'dash-legend-row'},
      h('span',{class:'dash-dot',style:'background:'+color}),h('span',{},name),
      h('strong',{},String(count)+' ('+Math.round(pct(count))+'%)'))));
    donutBox.replaceChildren(circle,legend);
    const now=new Date(today+'T12:00:00Z');
    const months=[];
    for(let i=5;i>=0;i--){
      const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));
      const key=date.toISOString().slice(0,7);
      const amount=issuedRows.filter(q=>String(q.created_at||'').startsWith(key))
        .reduce((sum,q)=>sum+(Number(q.quote_total)||0),0);
      months.push({label:new Intl.DateTimeFormat('es-AR',{month:'short',timeZone:'UTC'}).format(date),amount});
    }
    const max=Math.max(1,...months.map(m=>m.amount));
    chartTotal.textContent=formatMoney(monthTotal,org.currency);
    chartBox.replaceChildren(...months.map(m=>h('div',{class:'dash-chart-col',title:m.label+': '+formatMoney(m.amount,org.currency)},
      h('div',{class:'dash-chart-bar',style:'height:'+Math.max(3,Math.round(m.amount/max*134))+'px'}),
      h('span',{class:'dash-chart-label'},m.label))));


    if (quotes.length === 0) {
      recent.replaceChildren(h('div', { class: 'empty' },
        h('p', {}, 'Todavía no hiciste presupuestos.'),
        h('a', { class: 'btn btn-secondary btn-sm', href: '#/presupuestos/nuevo' }, 'Hacer el primero'),
      ));
    } else {
      recent.replaceChildren(...quotes.slice(0, 5).map((q) => h('a', { class: 'row-item', href: `#/presupuestos/${q.id}` },
        h('span', { class: 'qnum' }, q.number ? quoteNumber(q.number) : '—'),
        h('span', { class: 'row-main' },
          h('span', { class: 'row-title' }, q.title || 'Sin título'),
          h('span', { class: 'row-sub' }, statusBadge(effectiveStatus(q, today)), ' ', q.customers?.name || 'Sin cliente'),
        ),
        h('span', { class: 'amount' }, formatMoney(q.quote_total ?? 0, q.currency || org.currency)),
      )));
    }

    const configured = Boolean(org.phone || org.email || org.logo_data_url || org.terms);
    const issued = quotes.some((q) => q.status !== 'borrador');
    const steps = [
      ['Completá los datos de tu negocio', configured, '#/configuracion'],
      ['Cargá tu primer cliente', customers > 0, '#/clientes/nuevo'],
      ['Cargá materiales, mano de obra o servicios', items > 0, '#/conceptos/nuevo'],
      ['Emití tu primer presupuesto', issued, '#/presupuestos/nuevo'],
    ];
    if (steps.every(([, done]) => done)) checkCard.remove();
    else checklist.replaceChildren(...steps.map(([text, done, href]) => task(text, done, href)));
  } catch (err) {
    stats.replaceChildren(banner('error', err.message));
    recent.replaceChildren();
  }
}

function statCard(label, n, href, extra = null) {
  return h('a', { class: 'stat', href },
    h('span', { class: 'stat-n' }, n),
    h('span', { class: 'stat-label' }, label),
    extra ? h('span', { class: 'stat-extra' }, extra) : null,
  );
}

function task(text, done, href) {
  return h('li', { class: done ? 'done' : '' },
    h('span', { class: 'check', 'aria-hidden': 'true' }, done ? '✓' : ''),
    done ? h('span', {}, text, h('span', { class: 'sr-only' }, ' (hecho)')) : h('a', { href }, text),
  );
}
