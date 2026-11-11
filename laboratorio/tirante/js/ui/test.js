// Ensayo destructivo: reproduce en pantalla la secuencia calculada por core/failure.js
// y, al colapsar, lanza la simulación física del derrumbe.
import { loadToFailure } from '../core/failure.js';
import { createCollapse } from '../core/physics.js';
import { bounds } from '../core/model.js';
import { $, num, reducedMotion } from './dom.js';

const mult = (v) => '×' + num(v, 2);

export function startTest(app) {
  const model = app.store.get().model;
  const f = loadToFailure(model);
  if (!f.ok) { app.toast(f.reason, { kind: 'error' }); return null; }

  const overlay = $('#testOverlay'), card = $('#testCard'), gauge = $('#testLambda');
  const names = (ids) => new Intl.ListFormat('es', { type: 'conjunction' }).format(ids);
  const b = bounds(model), span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
  const rampTime = 2.4;
  const test = {
    f, lambda: 0, clock: 0, fired: new Set(), flashes: [], sim: null, phase: 'loading', hold: 0, lastNow: 0,
    stageAt(l) { return f.stages.find((s) => l <= s.to) || f.stages[f.stages.length - 1]; },
    alive(id) { return test.sim.links.some((k) => k.id === id && k.alive); },
    advance(now) {
      const dt = test.lastNow ? Math.min(0.05, (now - test.lastNow) / 1000) : 0; test.lastNow = now;
      test.clock += dt;
      if (test.phase === 'loading') {
        if (test.hold > 0) { test.hold -= dt; return; }
        test.lambda = Math.min(f.collapseLambda, test.lambda + dt * f.collapseLambda / rampTime);
        gauge.textContent = mult(test.lambda);
        for (const ev of f.events) {
          if (!test.fired.has(ev.memberId) && test.lambda >= ev.lambda - 1e-9) {
            test.fired.add(ev.memberId); test.flashes.push({ id: ev.memberId, t: test.clock }); test.hold = 0.45;
            navigator.vibrate?.(30);
            break;
          }
        }
        if (test.fired.size === f.events.length && test.hold <= 0 && test.lambda >= f.collapseLambda - 1e-9) {
          test.phase = 'collapse';
          test.sim = createCollapse(model, { removed: f.removed, groundY: b.minY - Math.max(1.5, span * 0.22), gravity: 9.81 * Math.max(1, span / 14) });
          setTimeout(showCard, 900);
        }
      } else if (test.phase === 'collapse') {
        test.sim.step(1 / 60); test.sim.step(1 / 60);
        if (test.sim.time > 9 || (test.sim.time > 2.5 && test.sim.energy() < 1e-7)) test.phase = 'done';
      }
    },
    close() { overlay.hidden = true; card.hidden = true; app.test = null; $('#stage').classList.remove('testing'); },
  };

  function showCard() {
    if (app.test !== test) return;
    const first = f.events[0], rest = f.events.slice(1).map((e) => e.memberId);
    $('#testTitle').textContent = f.collapseLambda < 1
      ? `Se cae antes de llegar a la carga prevista: aguanta ${mult(f.collapseLambda)}`
      : `Se cayó con ${mult(f.collapseLambda)} la carga prevista`;
    $('#testBody').textContent = `La primera en ceder fue ${first.memberId}, por ${first.mode}, con ${mult(first.lambda)} la carga.`
      + (rest.length ? ` La estructura repartió el esfuerzo y siguió en pie hasta que también cedieron ${names(rest)}.` : ' Como no tenía barras de sobra, al perderla se convirtió en un mecanismo.')
      + (f.vehicleNode ? ` El vehículo quedó detenido sobre ${f.vehicleNode}, su peor posición.` : '');
    card.hidden = false;
    card.querySelector('.primary').focus();
  }

  $('#stage').classList.add('testing');
  overlay.hidden = false; card.hidden = true; gauge.textContent = mult(0);
  app.test = test;
  if (reducedMotion()) { test.lambda = f.collapseLambda; f.events.forEach((e) => test.fired.add(e.memberId)); test.phase = 'done'; gauge.textContent = mult(test.lambda); showCard(); }
  return test;
}
