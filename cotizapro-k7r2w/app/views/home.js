import { h, banner } from '../lib/dom.js';
import { db } from '../lib/api.js';
import { formatMoney } from '../lib/money.js';
import { effectiveStatus, quoteNumber, todayISO } from '../lib/quotes.js';
import { shell } from './shell.js?v=20261108-fix2';
import { statusBadge } from './quotes.js';

export async function homeView(ctx) {
  const org = ctx.state.org;
  const stats = h('div', { class: 'stats' }, [1, 2, 3, 4].map(() => h('div', { class: 'skeleton stat' })));
  const chartBox = h('div', { class: 'dash-chart-line' });
  const chartTotal = h('div', { class: 'dash-chart-total' }, '—');
  const donutBox = h('div', { class: 'dash-donut-wrap' });
  const recent = h('div', { class: 'list' }, [1, 2].map(() => h('div', { class: 'skeleton row' })));
  const checklist = h('ol', { class: 'checklist' });
  const checkCard = h('section', { class: 'card' }, h('h2', {}, 'Para empezar'), checklist);

  shell(ctx, {
    section: 'inicio',
    title: '¡Bienvenido a CotizaPro!',
    actions: h('a', { class: 'btn btn-primary', href: '#/presupuestos/nuevo' }, '+ Nuevo presupuesto'),
  },
    h('div', { class: 'dashboard-header' }, h('div', {}, h('div', { class: 'dashboard-eyebrow' }, 'PANEL DE CONTROL'), h('p', { class: 'dashboard-intro' }, 'Gestioná tus presupuestos, clientes y facturación desde un solo lugar.'))),
    stats,
    h('div', { class: 'dash-grid' },
      h('section', { class: 'card dash-panel' }, h('h2', {}, 'Evolución del monto presupuestado'), h('p', { class: 'muted' }, 'Últimos seis meses · presupuestos emitidos'), chartTotal, chartBox),
      h('section', { class: 'card dash-panel' }, h('h2', {}, 'Estado de presupuestos'), h('p', { class: 'muted' }, 'Distribución de presupuestos emitidos'), donutBox)),
    h('section', { class: 'stack-sm recent-budget-panel' },
      h('div', { class: 'section-head' }, h('h2', {}, '▤  Últimos presupuestos'), h('a', { href: '#/presupuestos' }, 'Ver todos los presupuestos →')),
      h('div', { class: 'recent-table-head' }, h('span', {}, 'N.º'), h('span', {}, 'Cliente / trabajo'), h('span', {}, 'Fecha'), h('span', {}, 'Monto'), h('span', {}, 'Estado')),
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
      statCard('Presupuestos emitidos', String(issuedRows.length), '#/presupuestos', null, '▤'),
      statCard('Aceptados', String(accepted.length), '#/presupuestos', null, '✓'),
      statCard('Pendientes', String(open.length), '#/presupuestos', null, '◷'),
      statCard('Total del mes', formatMoney(monthTotal, org.currency), '#/presupuestos', null, '▣')
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
    const width=620, height=190, left=40, right=12, top=14, bottom=26;
    const plotW=width-left-right,plotH=height-top-bottom;
    const xy=months.map((m,i)=>[left+i*plotW/(months.length-1),top+plotH-(m.amount/max)*plotH]);
    const coords=xy.map(p=>p.join(',')).join(' ');
    const line='M '+xy.map(p=>p.join(' ')).join(' L ');
    const fill=line+' L '+xy[xy.length-1][0]+' '+(top+plotH)+' L '+left+' '+(top+plotH)+' Z';
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 '+width+' '+height);
    svg.setAttribute('role','img');
    svg.setAttribute('aria-label','Evolución de importes cotizados en los últimos seis meses');
    const el=(tag, attrs, value)=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(value!==undefined)e.textContent=value;return e;};
    const defs=el('defs',{});
    const gradient=el('linearGradient',{id:'cotiAreaGradient',x1:'0',x2:'0',y1:'0',y2:'1'});
    gradient.append(el('stop',{offset:'0%','stop-color':'#eb6c1c','stop-opacity':'.23'}),el('stop',{offset:'100%','stop-color':'#eb6c1c','stop-opacity':'.015'}));
    defs.append(gradient);svg.append(defs);
    for(let i=0;i<=4;i++){
      const y=top+plotH*i/4;
      svg.append(el('line',{x1:left,x2:width-right,y1:y,y2:y,stroke:'#e9ded3','stroke-width':1}));
      svg.append(el('text',{x:left-7,y:y+4,'text-anchor':'end',fill:'#947e70','font-size':11},i===4?'0':String(Math.round(max*(1-i/4)/100)/10)+'k'));
    }
    svg.append(el('path',{d:fill,fill:'url(#cotiAreaGradient)'}));
    svg.append(el('path',{d:line,fill:'none',stroke:'#e85d13','stroke-width':3,'stroke-linecap':'round','stroke-linejoin':'round'}));
    xy.forEach(([x,y],i)=>{
      svg.append(el('circle',{cx:x,cy:y,r:i===xy.length-1?5:3.5,fill:'#fff',stroke:'#e65b12','stroke-width':2.5}));
      svg.append(el('text',{x,y:height-4,'text-anchor':'middle',fill:'#8e7568','font-size':12},months[i].label));
    });
    chartBox.replaceChildren(svg);


    if (quotes.length === 0) {
      recent.replaceChildren(h('div', { class: 'empty' },
        h('p', {}, 'Todavía no hiciste presupuestos.'),
        h('a', { class: 'btn btn-secondary btn-sm', href: '#/presupuestos/nuevo' }, 'Hacer el primero'),
      ));
    } else {
      recent.replaceChildren(...quotes.slice(0, 5).map((q) => h('a', { class: 'row-item', href: `#/presupuestos/${q.id}` },
        h('span', { class: 'qnum' }, q.number ? quoteNumber(q.number) : '—'),
        h('span', { class: 'row-main' }, h('span', { class: 'row-title' }, q.customers?.name || 'Sin cliente'), h('span', { class: 'row-sub' }, q.title || 'Sin título')),
        h('span', { class: 'row-date' }, q.created_at ? new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(q.created_at)) : '—'),
        h('span', { class: 'amount' }, formatMoney(q.quote_total ?? 0, q.currency || org.currency)),
        statusBadge(effectiveStatus(q, today)),
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

function statCard(label, n, href, extra = null, symbol = '▤') {
  return h('a', { class: 'stat', href },
    h('span', { class: 'stat-icon', 'aria-hidden':'true' }, symbol),
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
