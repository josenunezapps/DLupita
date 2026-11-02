/* Estado del comercio, exclusivo del menú desplegable de Doña Lupita. */
(function(){
  'use strict';
  var fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Argentina/Ushuaia',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  function getLocalTime(){
    var obj={};
    fmt.formatToParts(new Date()).forEach(function(part){obj[part.type]=part.value});
    return {day:obj.weekday,minutes:Number(obj.hour)*60+Number(obj.minute)};
  }
  function updateHours(){
    var status=document.getElementById('menu-business-status');
    var detail=document.getElementById('menu-business-hours');
    var dot=document.getElementById('menu-business-dot');
    if(!status||!detail||!dot)return;
    var now=getLocalTime();
    var sunday=now.day==='Sun';
    var lunch=now.minutes>=720&&now.minutes<900;
    var dinner=now.minutes>=1200&&now.minutes<1440;
    var open=!sunday&&(lunch||dinner);
    status.textContent=open?'Abierto ahora':'Cerrado ahora';
    dot.classList.toggle('open',open);
    dot.classList.toggle('closed',!open);
    detail.textContent=sunday?'Domingo cerrado · abre el lunes a las 12:00':
      lunch?'Abierto hasta las 15:00':
      dinner?'Abierto hasta las 00:00':
      now.minutes<720?'Abre hoy a las 12:00':'Vuelve a abrir a las 20:00';
  }
  function init(){
    updateHours();
    window.setInterval(updateHours,60000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)updateHours()});
    window.addEventListener('focus',updateHours);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();