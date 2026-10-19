/* ServiControl · visual scheduler, inspired by field-service calendar patterns. Uses existing APP/db/save/modal engine. */
(function(){
'use strict';
const ICON={home:'<path d="M3 11 12 3l9 8v10h-7v-7h-4v7H3z"/>',agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',jobs:'<path d="M8 4H5v17h14V4h-3"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 12h6M9 16h6"/>',clients:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',equipment:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 12h6M9 17h5"/>',history:'<path d="M3 12a9 9 0 1 0 4-7.5M3 4v5h5M12 7v5l4 3"/>',reports:'<path d="M5 20V9m5 11V4m5 16v-7m5 7V8"/>',plus:'<path d="M12 5v14M5 12h14"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3"/>',wrench:'<path d="M20.9 13a8 8 0 0 1-10 7l-5 3-3-3 3-5a8 8 0 0 1 7-10l-4 5 4 4z"/>',check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'};
const svg=(n)=>'<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICON[n]||ICON.agenda)+'</svg>';
const navs=[['agenda','Agenda','agenda'],['inicio','Inicio','home'],['ordenes','Trabajos','jobs'],['clientes','Clientes','clients'],['equipos','Equipos','equipment'],['historial','Historial','history'],['informes','Informes','reports']];
const state={date:today(),view:window.innerWidth<680?'day':'week',team:'',orderFilter:'open',selected:'',query:'',drawer:'',more:false};
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dt=v=>new Date((v||today())+'T12:00:00');
const shift=(date,days)=>plusDays(date,days);
const mon=v=>{const d=dt(v);d.setDate(d.getDate()-(d.getDay()+6)%7);return iso(d)};
const nice=v=>dt(v).toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric'});
const weekday=v=>dt(v).toLocaleDateString('es-AR',{weekday:'short'}).replace('.','');
const month=v=>dt(v).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
const arr=c=>String(c||'').trim();
const clientName=q=>APP.client(q?.clientId)?.name||'Cliente sin registrar';
const eqOf=o=>APP.eq(o.equipmentId);
const button=(title,act,id='',klass='')=>'<button class="fsBtn '+klass+'" data-action="'+h(act)+'" data-id="'+h(id)+'">'+title+'</button>';
function maybeSeedDemoSchedule(){
 const demo=db.clients.length===3&&db.equipment.length===3&&db.clients.every(c=>c.name.includes('(demo)'));
 if(!demo||db.orders.length!==2||!db.orders.some(o=>o.id==='o2')||db.orders.some(o=>o.time))return;
 const visit=db.orders.find(o=>o.id==='o2');
 if(!visit||visit.status!=='pendiente'||visit.technician!=='Por asignar'||num(visit.cost)!==0)return;
 visit.date=shift(today(),1);visit.time='09:00';visit.duration=90;visit.technician='Martín';visit.notes='Inspección general y verificación de seguridad (demo).';
 db.orders.push({id:'demo-v4-1',equipmentId:'q2',date:today(),time:'11:00',duration:120,status:'pendiente',completedDate:'',technician:'Carolina',cost:0,notes:'Mantenimiento programado de aire acondicionado (demo).'});
 db.orders.push({id:'demo-v4-2',equipmentId:'q3',date:shift(today(),2),time:'14:00',duration:90,status:'pendiente',completedDate:'',technician:'Martín',cost:0,notes:'Revisión de presión y caudal (demo).'});
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(db))}catch(e){}
}
maybeSeedDemoSchedule();
const techs=()=>[...new Set(db.orders.map(o=>arr(o.technician)).filter(t=>t&&t!=='Por asignar'))].sort((a,b)=>a.localeCompare(b,'es'));
const visibleOrder=o=>!state.team||arr(o.technician)===state.team;
const visitDate=o=>o.date||today();
const timeRange=o=>o.time?o.time+' · '+Math.max(30,num(o.duration)||60)+' min':'Sin horario';
const orderTitle=o=>eqOf(o)?.name||'Equipo no disponible';
const orderSub=o=>clientName(eqOf(o));
const orderColor=o=>o.status==='realizado'?'done':/Mart|Carolina/i.test(o.technician||'')?(/Mart/i.test(o.technician)?'':'teal'):'blue';
function shell(content){
 const navi=navs.map(([id,label,ico])=>'<button data-nav="'+id+'" class="'+(tab===id?'active':'')+'" aria-label="'+label+'">'+svg(ico)+'<span>'+label+'</span></button>').join('');
 const bottom=[navs[0],navs[2],navs[3],navs[4]].map(([id,label,ico])=>'<button data-nav="'+id+'" class="'+(tab===id?'active':'')+'">'+svg(ico)+'<span>'+label+'</span></button>').join('')+'<button data-action="fsMore" class="'+(['historial','informes','inicio'].includes(tab)?'active':'')+'">'+svg('dots')+'<span>Más</span></button>';
 return '<div class="fsApp"><aside class="fsRail"><div class="fsMark"><span>SC</span></div><nav class="fsRailNav" aria-label="Módulos">'+navi+'</nav><div class="fsRailBottom">ZENIX AR</div></aside><div class="fsMain"><header class="fsTopbar"><div class="fsBrand"><strong>ServiControl</strong><i class="fsDivider"></i><small>Gestión técnica y planificación</small></div><div class="fsAccount"><span class="fsDemo">VERSIÓN DEMO</span><span class="fsAvatar">SC</span></div></header><main class="fsPage">'+content+'</main></div><nav class="fsMobileNav" aria-label="Navegación móvil">'+bottom+'</nav></div>';
}
function heading(title,subtitle,actions='',eyebrow='GESTIÓN DE SERVICIOS'){
 return '<section class="fsHeading"><div><div class="fsEyebrow">'+h(eyebrow)+'</div><h1>'+h(title)+'</h1><p>'+h(subtitle)+'</p></div><div class="fsButtons">'+actions+'</div></section>';
}
function datesForView(){
 if(state.view==='day'){return [{date:state.date,key:state.date,label:weekday(state.date),num:dt(state.date).getDate()}]}
 if(state.view==='3day')return [0,1,2].map(n=>{const d=shift(state.date,n);return {date:d,key:d,label:weekday(d),num:dt(d).getDate()}});
 const monday=mon(state.date);return Array.from({length:7},(_,i)=>{const d=shift(monday,i);return {date:d,key:d,label:weekday(d),num:dt(d).getDate()}});
}
function rangeTitle(){
 if(state.view==='month')return month(state.date);
 if(state.view==='day')return nice(state.date);
 const ds=datesForView();return dateText(ds[0].date)+' – '+dateText(ds[ds.length-1].date);
}
function slotEvents(date){return db.orders.filter(o=>visitDate(o)===date&&o.time&&visibleOrder(o)).sort((a,b)=>String(a.time).localeCompare(String(b.time)))}
function noTimeEvents(date){return db.orders.filter(o=>visitDate(o)===date&&!o.time&&o.status!=='realizado'&&visibleOrder(o))}
function scheduledEvent(o,index,others){
 const match=/^(\d{1,2}):(\d{2})$/.exec(o.time||'');if(!match)return '';
 const start=Number(match[1])*60+Number(match[2]),from=7*60,to=19*60;
 if(start>=to||start<from)return '';
 const duration=Math.max(30,Math.min(240,Number(o.duration)||60));
 const top=((start-from)/60)*66+2,height=Math.min(duration/60*66-5,(to-start)/60*66-5);
 const overlaps=others.filter(x=>x!==o&&x.time===o.time),half=overlaps.length>0;
 const second=half&&others.indexOf(o)>others.indexOf(overlaps[0]);
 const style='top:'+top+'px;height:'+Math.max(34,height)+'px;'+(half?'width:calc(50% - 6px);right:auto;'+(second?'left:calc(50% + 1px)':'left:5px')+';':'');
 return '<button class="fsEvent '+orderColor(o)+'" style="'+style+'" data-action="fsOrder" data-id="'+h(o.id)+'" title="'+h(orderTitle(o)+' · '+o.time)+'"><b>'+h(orderTitle(o))+'</b><small>'+h(o.technician||'Sin técnico')+'</small><i>'+h(o.time)+'</i></button>';
}
function grid(){const ds=datesForView(),count=ds.length;
 let head='<div class="fsCalendarHead" style="--fs-columns:'+count+'"><div class="fsTimeHead"></div>'+ds.map(d=>'<div class="fsDayHeader '+(d.date===today()?'current':'')+'"><button data-action="fsDay" data-id="'+d.date+'">'+h(d.label)+'</button><strong>'+d.num+'</strong></div>').join('')+'</div>';
 let allday='<div class="fsCalendarAllDay" style="--fs-columns:'+count+'"><div class="fsAllDayLabel">SIN<br>HORA</div>'+ds.map(d=>{const list=noTimeEvents(d.date);return '<div class="fsAllDaySlot">'+list.slice(0,3).map(o=>'<button class="fsUntimed" data-action="fsOrder" data-id="'+h(o.id)+'">'+h(orderTitle(o))+'</button>').join('')+(list.length>3?'<small style="color:#81969f">+'+(list.length-3)+'</small>':'')+'</div>'}).join('')+'</div>';
 const rail='<div class="fsHourRail">'+Array.from({length:12},(_,i)=>'<span class="fsHour" style="top:'+(i*66)+'px">'+String(i+7).padStart(2,'0')+':00</span>').join('')+'</div>';
 const days=ds.map(d=>{const ev=slotEvents(d.date);return '<div class="fsColumn '+(d.date===today()?'current':'')+'">'+ev.map((o,i)=>scheduledEvent(o,i,ev)).join('')+'</div>'}).join('');
 return '<div class="fsCalendarScroll"><div class="fsCalendarInner" style="'+(count<7?'min-width:'+Math.max(360,Math.min(count*230+58,850))+'px;':'')+'">'+head+allday+'<div class="fsTimeline" style="--fs-columns:'+count+'">'+rail+days+'</div></div></div>';
}
function monthView(){
 const first=dt(state.date);first.setDate(1);const begin=mon(iso(first));const dates=Array.from({length:42},(_,i)=>shift(begin,i));
 return '<div class="fsCalendarScroll"><div class="fsMonthGrid">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>'<div class="fsMonthHead">'+d+'</div>').join('')+dates.map(d=>{
 const ev=db.orders.filter(o=>visitDate(o)===d&&visibleOrder(o));const due=db.equipment.filter(q=>q.next===d);
 return '<div class="fsMonthCell '+(dt(d).getMonth()!==first.getMonth()?'out':'')+' '+(d===today()?'current':'')+'"><button class="fsMonthDate" data-action="fsDay" data-id="'+d+'">'+dt(d).getDate()+'</button>'+ev.slice(0,3).map(o=>'<button class="fsMonthItem order" data-action="fsOrder" data-id="'+h(o.id)+'">'+h((o.time?o.time+' ':'')+orderTitle(o))+'</button>').join('')+due.slice(0,2).map(q=>'<button class="fsMonthItem" data-action="fsEquipment" data-id="'+h(q.id)+'">'+h(q.name)+'</button>').join('')+(ev.length+due.length>5?'<small>+'+(ev.length+due.length-5)+' más</small>':'')+'</div>';}).join('')+'</div></div>';
}
function queue(){
 const missing=db.orders.filter(o=>o.status!=='realizado'&&!o.time&&visibleOrder(o));const due=APP.schedule().filter(q=>q.next<=plusDays(today(),30)).sort((a,b)=>a.next.localeCompare(b.next));
 const missingCards=missing.slice(0,9).map(o=>'<button class="fsQueueItem '+(o.date<today()?'late':'')+'" data-action="fsOrder" data-id="'+h(o.id)+'"><strong>'+h(orderTitle(o))+'</strong><small>'+h(orderSub(o))+'</small><span>Orden sin hora · '+h(dateText(o.date))+' →</span></button>');
 const dueCards=due.slice(0,6).map(q=>'<button class="fsQueueItem '+(q.next<today()?'late':'')+'" data-action="fsNewOrder" data-id="'+h(q.id)+'"><strong>'+h(q.name)+'</strong><small>'+h(clientName(q))+'</small><span>'+(q.next<today()?'Vencido: ':'Próxima revisión: ')+h(dateText(q.next))+' · Programar →</span></button>');
 return '<aside class="fsSideQueue"><div class="fsQueueHead"><h2>Por programar</h2><span>'+(missing.length+due.length)+'</span></div><p class="fsQueueSub">Trabajos sin horario y equipos que necesitan una próxima visita.</p><div class="fsQueueList">'+(missingCards.join('')+dueCards.join('')||'<div class="fsEmpty">No hay trabajos pendientes.</div>')+'</div><div class="fsQueueFoot">Las órdenes sin hora se muestran aquí hasta que les asignes un horario. Los mantenimientos son recordatorios, no turnos confirmados.</div></aside>';
}
function calendar(){
 const viewLabel=state.view==='week'?'Semana':state.view==='day'?'Día':state.view==='3day'?'3 días':'Mes';
 const btns=[['day','Día'],['3day','3 días'],['week','Semana'],['month','Mes']].map(x=>'<button data-action="fsView" data-id="'+x[0]+'" class="'+(state.view===x[0]?'active':'')+'">'+x[1]+'</button>').join('');
 const techOptions='<option value="">Todos los técnicos</option>'+techs().map(x=>'<option value="'+h(x)+'" '+(state.team===x?'selected':'')+'>'+h(x)+'</option>').join('');
 const tools='<div class="fsToolbar"><div class="fsDateTools"><span class="fsDateTitle">'+h(rangeTitle())+'</span><button class="fsSquareBtn" data-action="fsPrev" aria-label="Anterior">‹</button><button class="fsSquareBtn" data-action="fsNext" aria-label="Siguiente">›</button><button class="fsToday" data-action="fsToday">Hoy</button></div><div class="fsViewTools"><div class="fsViewSwitch">'+btns+'</div><select class="fsTeamSelect" data-fs-team aria-label="Filtrar por técnico">'+techOptions+'</select></div></div>';
 return '<section class="fsCard">'+tools+'<div class="fsScheduleBody"><div class="fsCalendarPane">'+(state.view==='month'?monthView():grid())+'</div>'+queue()+'</div></section>';
}
function miniJobList(){const list=[...db.orders].sort((a,b)=>(a.status==='realizado')-(b.status==='realizado')||String(a.date).localeCompare(String(b.date))).slice(0,5);
 return '<section class="fsCard"><div class="fsSectionTitle"><h2>Próximos trabajos</h2><button class="fsBtn" data-nav="ordenes" style="min-height:29px;padding:4px 9px;font-size:10px">Ver todos →</button></div>'+(list.length?list.map(o=>'<div class="fsLineItem"><span class="fsCircle">'+svg('jobs')+'</span><div style="min-width:0;flex:1"><strong>'+h(orderTitle(o))+'</strong><small>'+h(orderSub(o))+' · '+h(dateText(o.date))+'</small></div><span class="fsTag '+(o.status==='realizado'?'done':o.date<today()?'late':'')+'">'+(o.status==='realizado'?'Realizado':'Abierto')+'</span></div>').join(''):'<div class="fsEmpty">Todavía no hay órdenes registradas.</div>')+'</section>';
}
function summary(){const due=[...APP.urgent()].sort((a,b)=>a.next.localeCompare(b.next));
 return '<div class="fsBodyExtras">'+miniJobList()+'<section class="fsCard"><div class="fsSectionTitle"><h2>Mantenimientos que requieren atención</h2><button class="fsBtn" data-nav="equipos" style="min-height:29px;padding:4px 9px;font-size:10px">Equipos →</button></div>'+(due.length?due.slice(0,5).map(q=>'<div class="fsLineItem"><span class="fsCircle">'+svg('wrench')+'</span><div style="min-width:0;flex:1"><strong>'+h(q.name)+'</strong><small>'+h(clientName(q))+'</small></div><span class="fsTag late">'+h(dateText(q.next))+'</span></div>').join(''):'<div class="fsEmpty">No hay mantenimientos vencidos.</div>')+'</section></div>';
}
function schedulePage(){return heading('Planificación de servicios','Agenda visual por hora y equipo de trabajo. Seleccioná un bloque para ver o modificar la visita.',button('＋ Nueva visita','fsNewOrder','','primary'),'PLANIFICADOR DE CAMPO')+calendar()+(tab==='inicio'?summary():'')}
function keyText(text){return String(text??'').toLowerCase()}
function tableHeader(title,subtitle,heads,rows){
 return '<section class="fsCard"><div class="fsTableBar"><div><b style="font-size:14px;color:#2a4d54">'+h(title)+'</b><div style="font-size:11px;color:#93a3aa;margin-top:5px">'+h(subtitle)+'</div></div><input data-fs-search class="fsSearch" value="'+h(state.query)+'" placeholder="Buscar..." aria-label="Buscar en esta tabla"></div><div class="fsTableScroll"><table class="fsDataTable"><thead><tr>'+heads.map(hd=>'<th>'+h(hd)+'</th>').join('')+'</tr></thead><tbody id="fsTableBody">'+(rows.length?rows.join(''):'<tr><td colspan="'+heads.length+'"><div class="fsEmpty">No se encontraron registros.</div></td></tr>')+'</tbody></table></div></section>';
}
function nameCell(name,detail){return '<div class="fsTableName"><span class="fsMiniAvatar">'+h(initial(name))+'</span><div><strong>'+h(name)+'</strong><small>'+h(detail)+'</small></div></div>'}
function clientRows(){return db.clients.filter(c=>keyText([c.name,c.address,c.phone].join(' ')).includes(keyText(state.query))).map(c=>{
 const eq=db.equipment.filter(q=>q.clientId===c.id),late=eq.filter(q=>q.next<today()).length;
 return '<tr><td>'+nameCell(c.name,c.address||'Sin dirección')+'</td><td>'+h(c.phone||'No informado')+'</td><td>'+eq.length+'</td><td><span class="fsTag '+(late?'late':'')+'">'+(late?late+' vencidos':'Al día')+'</span></td><td><div class="fsButtons">'+button('Ver ficha','viewClient',c.id)+button('Editar','editClient',c.id)+'</div></td></tr>';});}
function equipRows(){return db.equipment.filter(q=>keyText([q.name,q.serial,q.category,clientName(q)].join(' ')).includes(keyText(state.query))).map(q=>{
 const late=q.next<today();return '<tr><td>'+nameCell(q.name,q.serial||'Sin número de serie')+'</td><td>'+h(clientName(q))+'</td><td>'+h(q.category)+'</td><td>'+h(dateText(q.next))+'</td><td><span class="fsTag '+(late?'late':'')+'">'+(late?'Vencido':'Vigente')+'</span></td><td><div class="fsButtons">'+button('Ver ficha','viewEq',q.id)+button('Editar','editEq',q.id)+'</div></td></tr>';});}
function historyRows(){return db.orders.filter(o=>o.status==='realizado'&&keyText([orderTitle(o),orderSub(o),o.technician,o.notes].join(' ')).includes(keyText(state.query))).sort((a,b)=>b.date.localeCompare(a.date)).map(o=>'<tr><td>'+h(dateText(o.completedDate||o.date))+'</td><td>'+nameCell(orderTitle(o),orderSub(o))+'</td><td>'+h(o.technician||'No asignado')+'</td><td>'+h(money(o.cost||0))+'</td><td>'+button('Informe PDF','orderPdf',o.id)+'</td></tr>');}
function listPage(type){
 if(type==='clientes')return heading('Clientes','Contactos, establecimientos y sus equipos instalados.',button('＋ Agregar cliente','newClient','','primary'),'CARTERA DE CLIENTES')+tableHeader('Directorio','Clientes registrados y seguimiento de activos',['Cliente','Teléfono','Equipos','Estado','Acciones'],clientRows());
 if(type==='equipos')return heading('Equipos e instalaciones','Inventario técnico, número de serie y revisiones preventivas.',button('＋ Registrar equipo','newEq','','primary'),'INVENTARIO TÉCNICO')+tableHeader('Equipos','Todos los equipos en seguimiento',['Equipo','Cliente','Categoría','Próxima revisión','Estado','Acciones'],equipRows());
 return heading('Historial de servicios','Órdenes realizadas, responsables y comprobantes técnicos.',button('＋ Nueva intervención','fsNewOrder','','primary'),'TRABAJOS COMPLETADOS')+tableHeader('Servicios realizados','Informe individual disponible en PDF',['Fecha','Equipo y cliente','Técnico','Importe','Acción'],historyRows());
}
function jobRows(){return [...db.orders].sort((a,b)=>(a.status==='realizado')-(b.status==='realizado')||String(a.date).localeCompare(String(b.date))).filter(o=>state.orderFilter==='all'||(state.orderFilter==='open'?o.status!=='realizado':o.status==='realizado')).filter(o=>keyText([orderTitle(o),orderSub(o),o.technician,o.notes].join(' ')).includes(keyText(state.query)))}
function jobsPage(){const arr=jobRows(),chosen=arr.find(o=>o.id===state.selected)||arr[0];
 const rows=arr.map(o=>'<button class="fsOrderRow '+(chosen?.id===o.id?'active':'')+'" data-action="fsChooseOrder" data-id="'+h(o.id)+'"><span class="fsCircle">'+svg('jobs')+'</span><span style="flex:1;min-width:0"><strong>'+h(orderTitle(o))+'</strong><small>'+h(orderSub(o))+' · '+h(dateText(o.date))+' · '+h(timeRange(o))+'</small></span><span class="fsTag '+(o.status==='realizado'?'done':o.date<today()?'late':'')+'">'+(o.status==='realizado'?'Hecho':'Pendiente')+'</span></button>').join('');
 const detail=chosen?'<div class="fsOrderBody"><span class="fsEyebrow">ORDEN #'+h(String(chosen.id).slice(-6).toUpperCase())+'</span><h2>'+h(orderTitle(chosen))+'</h2><p style="font-size:12px;color:#81929d;margin:0 0 15px">'+h(orderSub(chosen))+'</p>'+[['Fecha',dateText(chosen.date)],['Horario',timeRange(chosen)],['Técnico',chosen.technician||'Sin asignar'],['Estado',chosen.status==='realizado'?'Realizada':'Pendiente'],['Importe',money(chosen.cost||0)],['Observaciones',chosen.notes||'Sin observaciones']].map(x=>'<div class="fsDetailRow"><span>'+h(x[0])+'</span><strong>'+h(x[1])+'</strong></div>').join('')+'<div class="fsButtons" style="margin-top:19px">'+(chosen.status==='realizado'?button('Informe PDF','orderPdf',chosen.id,'primary'):button('Completar','completeOrder',chosen.id,'primary'))+button('Cambiar horario','fsEditTime',chosen.id)+button('Eliminar','delOrder',chosen.id)+'</div></div>':'<div class="fsEmpty">Seleccioná un trabajo de la lista.</div>';
 return heading('Órdenes de trabajo','Organizá las intervenciones y asigná horarios y técnicos.',button('＋ Nueva orden','fsNewOrder','','primary'),'TRABAJOS Y VISITAS')+'<div class="fsJobRows"><section class="fsCard"><div class="fsTableBar"><div class="fsFilterTabs">'+[['open','Abiertas'],['done','Completadas'],['all','Todas']].map(x=>'<button class="'+(state.orderFilter===x[0]?'active':'')+'" data-action="fsFilterOrders" data-id="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><input class="fsSearch" data-fs-search value="'+h(state.query)+'" placeholder="Buscar órdenes..."></div><div id="fsJobResults">'+(rows||'<div class="fsEmpty">No hay órdenes con estos filtros.</div>')+'</div></section><section class="fsCard"><div class="fsSectionTitle"><h2>Detalle de la orden</h2></div>'+detail+'</section></div>';
}
function reportPage(){const data=APP.report();return heading('Informes y respaldos','Exportación de registros y copias de seguridad.',button('Descargar JSON','backup'),'ADMINISTRACIÓN')+'<div class="fsBodyExtras"><section class="fsCard"><div class="fsSectionTitle"><h2>Exportar información</h2></div><div style="padding:20px"><p style="color:#8798a3;line-height:1.6;font-size:12px">Generá un listado de los equipos y sus fechas de mantenimiento.</p><div class="fsButtons" style="margin-top:19px">'+button('Exportar Excel (CSV)','csv','','primary')+button('Guardar PDF','print')+'</div></div></section><section class="fsCard"><div class="fsSectionTitle"><h2>Respaldo local</h2></div><div style="padding:20px"><p style="color:#8798a3;line-height:1.6;font-size:12px">Esta demo almacena la información solo en este navegador. Hacé un respaldo antes de cambiar de dispositivo.</p><div class="fsButtons" style="margin-top:19px">'+button('Descargar JSON','backup','','primary')+button('Importar JSON','import')+button('Borrar datos','clear')+'</div></div></section></div><section class="fsCard" style="margin-top:17px"><div class="fsSectionTitle"><h2>Resumen</h2></div><div style="padding:15px 20px">'+data.summary.map(x=>'<div class="fsDetailRow"><span>'+h(x[0])+'</span><strong>'+h(x[1])+'</strong></div>').join('')+'</div></section>'}
function drawer(orderId){const o=db.orders.find(x=>x.id===orderId);if(!o)return '';const q=eqOf(o);
 return '<button class="fsDrawerBackdrop" aria-label="Cerrar detalle" data-action="fsCloseDrawer"></button><aside class="fsDrawer" role="dialog" aria-modal="true" aria-label="Detalle de la visita"><div class="fsDrawerTop"><span class="fsEyebrow">ORDEN DE SERVICIO</span><button data-action="fsCloseDrawer" aria-label="Cerrar">×</button></div><h2>'+h(orderTitle(o))+'</h2><p>'+h(orderSub(o))+'</p><span class="fsTag '+(o.status==='realizado'?'done':'')+'">'+(o.status==='realizado'?'Finalizada':'Programada')+'</span><div style="margin-top:25px">'+[['Fecha de visita',dateText(o.date)],['Horario',timeRange(o)],['Técnico',o.technician||'Sin asignar'],['Categoría',q?.category||'—'],['Serie',q?.serial||'—'],['Importe',money(o.cost||0)],['Observaciones',o.notes||'Sin observaciones']].map(x=>'<div class="fsDetailRow"><span>'+h(x[0])+'</span><strong>'+h(x[1])+'</strong></div>').join('')+'</div><div class="fsDrawerActions">'+(o.status==='realizado'?button('Ver informe PDF','orderPdf',o.id,'primary'):button('Marcar como realizado','completeOrder',o.id,'primary'))+button('Editar horario','fsEditTime',o.id)+(q?button('Ver equipo','viewEq',q.id):'')+'</div></aside>';
}
function page(){if(tab==='inicio'||tab==='agenda')return schedulePage();if(tab==='ordenes')return jobsPage();if(tab==='clientes'||tab==='equipos'||tab==='historial')return listPage(tab);return reportPage()}
render=function(){document.title='ServiControl · Agenda de trabajo';document.documentElement.style.setProperty('--accent','#278977');const root=document.getElementById('root');root.innerHTML=shell(page())+(state.drawer?drawer(state.drawer):'')};
function goto(name){tab=name;state.drawer='';state.query='';state.selected='';document.getElementById('modal-root').innerHTML='';render()}
APP.actions.fsPrev=()=>{if(state.view==='month'){const d=dt(state.date);d.setDate(1);d.setMonth(d.getMonth()-1);state.date=iso(d)}else state.date=shift(state.date,state.view==='day'?-1:state.view==='3day'?-3:-7);render()};
APP.actions.fsNext=()=>{if(state.view==='month'){const d=dt(state.date);d.setDate(1);d.setMonth(d.getMonth()+1);state.date=iso(d)}else state.date=shift(state.date,state.view==='day'?1:state.view==='3day'?3:7);render()};
APP.actions.fsToday=()=>{state.date=today();render()};
APP.actions.fsView=v=>{if(['day','3day','week','month'].includes(v)){state.view=v;render()}};
APP.actions.fsDay=v=>{state.date=v;state.view='day';render()};
APP.actions.fsOrder=id=>{state.drawer=id;render()};
APP.actions.fsCloseDrawer=()=>{state.drawer='';render()};
APP.actions.fsEquipment=id=>{APP.actions.viewEq(id)};
APP.actions.fsChooseOrder=id=>{state.selected=id;render()};
APP.actions.fsFilterOrders=id=>{state.orderFilter=id;state.selected='';render()};
APP.actions.fsMore=()=>{
 const root=document.getElementById('modal-root');
 root.innerHTML='<button type="button" class="fsMoreMask" data-action="fsCloseMore" aria-label="Cerrar menú de secciones"></button>'+
 '<section class="fsMoreSheet" role="dialog" aria-modal="true" aria-label="Más secciones"><div class="fsMoreHandle"></div><div class="fsMoreHeader"><div><span>MENÚ DE NAVEGACIÓN</span><h2>Más secciones</h2></div><button type="button" class="fsMoreX" data-action="fsCloseMore" aria-label="Cerrar">×</button></div>'+
 '<div class="fsMoreItems">'+navs.filter(x=>['inicio','historial','informes'].includes(x[0])).map(x=>'<button type="button" class="fsMoreItem" data-action="fsMorePage" data-id="'+x[0]+'"><span class="fsMoreItemIcon">'+svg(x[2])+'</span><span class="fsMoreItemText"><strong>'+h(x[1])+'</strong><small>'+(x[0]==='inicio'?'Agenda y planificación del trabajo':x[0]==='historial'?'Servicios realizados y fichas técnicas':'Descargas, informes y respaldos')+'</small></span><span class="fsMoreArrow">›</span></button>').join('')+'</div></section>';
 document.body.classList.add('fsMoreOpen');
 const closeBtn=root.querySelector('.fsMoreX');if(closeBtn)closeBtn.focus();
};
APP.actions.fsCloseMore=()=>{document.getElementById('modal-root').innerHTML='';document.body.classList.remove('fsMoreOpen')};
APP.actions.fsMorePage=id=>{APP.actions.fsCloseMore();goto(id)};
APP.actions.fsNewOrder=id=>{
 if(!db.equipment.length){notify('Primero registrá un equipo.');APP.actions.newEq();return}
 const fields=[{name:'equipmentId',label:'Equipo del cliente',type:'select',wide:true,options:db.equipment.map(q=>({value:q.id,label:q.name+' · '+clientName(q)}))},{name:'date',label:'Fecha de visita',type:'date',default:today()},{name:'time',label:'Hora de inicio (opcional)',type:'time',required:false,default:'09:00'},{name:'duration',label:'Duración estimada (minutos)',type:'number',min:30,default:60},{name:'technician',label:'Técnico responsable',required:false},{name:'status',label:'Estado',type:'select',options:[{value:'pendiente',label:'Programada'},{value:'realizado',label:'Realizada'}]},{name:'cost',label:'Importe del servicio ($)',type:'number',min:0,default:0},{name:'notes',label:'Descripción del trabajo',type:'textarea',wide:true,required:false}];
 modal('Programar visita / orden',fields,v=>{const q=APP.eq(v.equipmentId);if(!q)throw Error('Elegí un equipo válido.');if(v.status==='realizado'&&v.date>today())throw Error('No se puede completar una visita futura.');if(num(v.cost)<0||num(v.duration)<30)throw Error('Revisá el importe y la duración.');const oldLast=q.last,oldNext=q.next;if(v.status==='realizado'){q.last=v.date;q.next=plusDays(v.date,num(q.frequency)||90)}db.orders.push({...v,id:uid(),duration:num(v.duration),cost:num(v.cost),completedDate:v.status==='realizado'?v.date:'',priorLast:oldLast,priorNext:oldNext});state.drawer=''}, {equipmentId:id||db.equipment[0].id},'Podés dejar la hora vacía para agregar el trabajo a «Por programar».');
};
APP.actions.fsEditTime=id=>{const o=db.orders.find(x=>x.id===id);if(!o)return;state.drawer='';render();
 modal('Editar visita',[{name:'date',label:'Fecha',type:'date'},{name:'time',label:'Hora de inicio (opcional)',type:'time',required:false},{name:'duration',label:'Duración (minutos)',type:'number',min:30},{name:'technician',label:'Técnico responsable',required:false},{name:'notes',label:'Notas del trabajo',type:'textarea',required:false,wide:true}],v=>{if(num(v.duration)<30)throw Error('La duración mínima es de 30 minutos.');if(o.status==='realizado'&&v.date!==o.date)throw Error('La fecha de una intervención realizada se conserva por integridad del historial.');Object.assign(o,{date:v.date,time:v.time,duration:num(v.duration),technician:v.technician,notes:v.notes});state.drawer=''}, {date:o.date,time:o.time||'',duration:o.duration||60,technician:o.technician||'',notes:o.notes||''});
};
// Preserve original actions and local-storage format. Replace only navigation behavior.
const oldAddOrder=APP.actions.addOrder;APP.actions.addOrder=id=>APP.actions.fsNewOrder(id);
const originalComplete=APP.actions.completeOrder;
APP.actions.completeOrder=id=>{if(state.drawer){state.drawer='';render()}return originalComplete(id)};
const originalViewEq=APP.actions.viewEq;
if(originalViewEq)APP.actions.viewEq=id=>{if(state.drawer){state.drawer='';render()}return originalViewEq(id)};
document.addEventListener('change',e=>{if(e.target.matches('[data-fs-team]')){state.team=e.target.value;render()}});
document.addEventListener('input',e=>{if(!e.target.matches('[data-fs-search]'))return;state.query=e.target.value;
 const body=document.querySelector('#fsTableBody');if(body){const rows=tab==='clientes'?clientRows():tab==='equipos'?equipRows():tab==='historial'?historyRows():[];body.innerHTML=rows.length?rows.join(''):'<tr><td colspan="6"><div class="fsEmpty">No se encontraron registros.</div></td></tr>';return}
 if(tab==='ordenes'){const list=document.querySelector('#fsJobResults');if(!list)return;const filtered=jobRows(),sel=filtered.find(o=>o.id===state.selected)||filtered[0];list.innerHTML=filtered.map(o=>'<button class="fsOrderRow '+(sel?.id===o.id?'active':'')+'" data-action="fsChooseOrder" data-id="'+h(o.id)+'"><span class="fsCircle">'+svg('jobs')+'</span><span style="flex:1;min-width:0"><strong>'+h(orderTitle(o))+'</strong><small>'+h(orderSub(o))+' · '+h(dateText(o.date))+'</small></span><span class="fsTag">'+(o.status==='realizado'?'Hecho':'Pendiente')+'</span></button>').join('')||'<div class="fsEmpty">No se encontraron órdenes.</div>'}
});
window.addEventListener('resize',()=>{const mobile=window.innerWidth<680;if(mobile&&state.view==='week'){state.view='day';render()}});
render();
})();