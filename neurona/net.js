// Red neuronal (perceptrón multicapa) escrita a mano: ReLU, softmax, entropía cruzada, Adam. Sin librerías.
(function (G) {
  function randn() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  class Net {
    constructor(sizes) {
      this.sizes = sizes; this.L = sizes.length - 1;
      this.W = []; this.b = []; this.mW = []; this.vW = []; this.mb = []; this.vb = []; this.t = 0;
      for (let l = 0; l < this.L; l++) {
        const n = sizes[l], m = sizes[l + 1], std = Math.sqrt(2 / n); // inicialización de He
        const W = new Float32Array(n * m); for (let i = 0; i < W.length; i++) W[i] = randn() * std;
        this.W.push(W); this.b.push(new Float32Array(m));
        this.mW.push(new Float32Array(n * m)); this.vW.push(new Float32Array(n * m)); this.mb.push(new Float32Array(m)); this.vb.push(new Float32Array(m));
      }
      this.acts = sizes.map(n => new Float32Array(n)); this.deltas = sizes.map(n => new Float32Array(n));
      this.gW = this.W.map(w => new Float32Array(w.length)); this.gb = this.b.map(b => new Float32Array(b.length));
    }
    /** Cambia la cantidad de salidas (para aprender clases nuevas) conservando lo aprendido. */
    resizeOutput(k) {
      const l = this.L - 1, n = this.sizes[l], old = this.sizes[l + 1];
      if (k === old) return;
      const W = new Float32Array(n * k), b = new Float32Array(k), std = Math.sqrt(2 / n);
      for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) W[i * k + j] = j < old ? this.W[l][i * old + j] : randn() * std * .5;
      for (let j = 0; j < Math.min(k, old); j++) b[j] = this.b[l][j];
      this.W[l] = W; this.b[l] = b; this.sizes[l + 1] = k;
      this.mW[l] = new Float32Array(n * k); this.vW[l] = new Float32Array(n * k); this.mb[l] = new Float32Array(k); this.vb[l] = new Float32Array(k);
      this.gW[l] = new Float32Array(n * k); this.gb[l] = new Float32Array(k);
      this.acts[l + 1] = new Float32Array(k); this.deltas[l + 1] = new Float32Array(k);
    }
    /** Quita la salida j (cuando se olvida una clase aprendida). */
    removeOutput(j) {
      const l = this.L - 1, n = this.sizes[l], old = this.sizes[l + 1], k = old - 1;
      const W = new Float32Array(n * k), b = new Float32Array(k);
      for (let i = 0; i < n; i++) for (let o = 0, q = 0; o < old; o++) { if (o === j) continue; W[i * k + q++] = this.W[l][i * old + o]; }
      for (let o = 0, q = 0; o < old; o++) if (o !== j) b[q++] = this.b[l][o];
      this.W[l] = W; this.b[l] = b; this.sizes[l + 1] = k;
      this.mW[l] = new Float32Array(n * k); this.vW[l] = new Float32Array(n * k); this.mb[l] = new Float32Array(k); this.vb[l] = new Float32Array(k);
      this.gW[l] = new Float32Array(n * k); this.gb[l] = new Float32Array(k);
      this.acts[l + 1] = new Float32Array(k); this.deltas[l + 1] = new Float32Array(k);
    }
    forward(x) {
      this.acts[0].set(x);
      for (let l = 0; l < this.L; l++) {
        const a = this.acts[l], z = this.acts[l + 1], W = this.W[l], b = this.b[l], n = this.sizes[l], m = this.sizes[l + 1];
        z.set(b);
        for (let i = 0; i < n; i++) { const ai = a[i]; if (ai === 0) continue; const row = i * m; for (let j = 0; j < m; j++) z[j] += ai * W[row + j]; }
        if (l < this.L - 1) for (let j = 0; j < m; j++) { if (z[j] < 0) z[j] = 0; }
        else { let mx = -Infinity; for (let j = 0; j < m; j++) if (z[j] > mx) mx = z[j]; let s = 0; for (let j = 0; j < m; j++) { z[j] = Math.exp(z[j] - mx); s += z[j]; } for (let j = 0; j < m; j++) z[j] /= s; }
      }
      return this.acts[this.L];
    }
    /** Acumula gradientes de una muestra. Devuelve la pérdida. */
    backward(y) {
      const L = this.L, out = this.acts[L];
      const loss = -Math.log(Math.max(1e-9, out[y]));
      const dOut = this.deltas[L]; for (let j = 0; j < out.length; j++) dOut[j] = out[j] - (j === y ? 1 : 0);
      for (let l = L - 1; l >= 0; l--) {
        const a = this.acts[l], d = this.deltas[l + 1], W = this.W[l], gW = this.gW[l], gb = this.gb[l], n = this.sizes[l], m = this.sizes[l + 1];
        for (let j = 0; j < m; j++) gb[j] += d[j];
        const dPrev = this.deltas[l];
        for (let i = 0; i < n; i++) {
          const ai = a[i], row = i * m; let s = 0;
          if (ai !== 0) for (let j = 0; j < m; j++) { gW[row + j] += ai * d[j]; s += W[row + j] * d[j]; }
          else if (l > 0) { /* ReLU apagada: no propaga */ }
          dPrev[i] = l > 0 && ai > 0 ? s : 0;
        }
      }
      return loss;
    }
    step(batch, lr = 1e-3, b1 = .9, b2 = .999, eps = 1e-8, wd = 1e-5) {
      this.t++; const c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
      for (let l = 0; l < this.L; l++) {
        const upd = (P, Gr, M, V, decay) => { for (let i = 0; i < P.length; i++) { const g = Gr[i] / batch + decay * P[i]; M[i] = b1 * M[i] + (1 - b1) * g; V[i] = b2 * V[i] + (1 - b2) * g * g; P[i] -= lr * (M[i] / c1) / (Math.sqrt(V[i] / c2) + eps); Gr[i] = 0; } };
        upd(this.W[l], this.gW[l], this.mW[l], this.vW[l], wd); upd(this.b[l], this.gb[l], this.mb[l], this.vb[l], 0);
      }
    }
    export() { return { sizes: this.sizes.slice(), W: this.W.map(w => Array.from(w)), b: this.b.map(b => Array.from(b)) }; }
    static import(o) { const n = new Net(o.sizes); n.W = o.W.map(w => Float32Array.from(w)); n.b = o.b.map(b => Float32Array.from(b)); return n; }
  }

  // empaquetado compacto de pesos (float32 → base64) para guardarlos en el navegador
  function pack(net) {
    const parts = [...net.W, ...net.b]; const total = parts.reduce((s, p) => s + p.length, 0);
    const buf = new Float32Array(total); let o = 0; for (const p of parts) { buf.set(p, o); o += p.length; }
    const bytes = new Uint8Array(buf.buffer); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { sizes: net.sizes.slice(), data: btoa(s) };
  }
  function unpack(o) {
    const bin = atob(o.data), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buf = new Float32Array(bytes.buffer), net = new Net(o.sizes); let p = 0;
    for (let l = 0; l < net.L; l++) { net.W[l] = buf.slice(p, p + net.W[l].length); p += net.W[l].length; }
    for (let l = 0; l < net.L; l++) { net.b[l] = buf.slice(p, p + net.b[l].length); p += net.b[l].length; }
    return net;
  }

  G.NN = { Net, pack, unpack };
})(typeof self !== 'undefined' ? self : globalThis);
