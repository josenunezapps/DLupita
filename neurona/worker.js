// Entrena la red en segundo plano para que la página no se congele.
importScripts('shapes.js', 'net.js');
const { Shapes, NN } = self;

self.onmessage = e => {
  const m = e.data;
  if (m.cmd !== 'train') return;
  const custom = m.custom || [], K = Shapes.CLASSES.length + custom.length;
  let net;
  if (m.init) { net = NN.unpack(m.init); if (m.removeIdx != null) net.removeOutput(m.removeIdx); net.resizeOutput(K); }
  else net = new NN.Net([784, 128, 64, K]);
  // set de validación fijo (nunca se usa para entrenar)
  const val = []; for (let i = 0; i < Math.max(240, K * 20); i++) { const y = i % K; val.push([Shapes.sample(y, custom), y]); }
  const evalAcc = () => { let ok = 0; const per = new Array(K).fill(0), tot = new Array(K).fill(0); for (const [x, y] of val) { const o = net.forward(x); let a = 0; for (let j = 1; j < K; j++) if (o[j] > o[a]) a = j; tot[y]++; if (a === y) { ok++; per[y]++; } } return { acc: ok / val.length, per: per.map((v, i) => v / tot[i]) }; };
  const total = m.samples, B = 32, focus = m.focus ?? null; // focus: índice de clase nueva a reforzar
  let seen = 0, lossAcc = 0, lossN = 0, lastPost = 0;
  const t0 = Date.now();
  post({ type: 'progress', seen: 0, total, loss: null, ...evalAcc(), ms: 0 });
  while (seen < total) {
    for (let k = 0; k < B; k++) {
      const y = focus !== null && Math.random() < .35 ? focus : Math.floor(Math.random() * K);
      const x = Shapes.sample(y, custom);
      net.forward(x); lossAcc += net.backward(y); lossN++; seen++;
      if (k === 0 && seen - lastPost >= 200) { var preview = { x: Array.from(x), y }; }
    }
    const frac = seen / total, lr = (m.init ? 1.2e-3 : 2.2e-3) * (frac < .75 ? 1 : .35);
    net.step(B, lr);
    if (seen - lastPost >= 320 || seen >= total) {
      lastPost = seen;
      post({ type: 'progress', seen, total, loss: lossAcc / lossN, ...evalAcc(), preview, ms: Date.now() - t0 });
      lossAcc = 0; lossN = 0;
    }
  }
  post({ type: 'done', model: NN.pack(net), ...evalAcc(), ms: Date.now() - t0 });
};
function post(o) { self.postMessage(o); }
