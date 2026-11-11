// Álgebra lineal densa mínima: factorización de Cholesky para matrices simétricas definidas positivas.

/** Factoriza K (n×n, fila mayor) en sitio: K = L·Lᵀ. Devuelve {ok} o {ok:false, pivot}. */
export function cholesky(K, n, tol = 1e-10) {
  let maxD = 0;
  for (let i = 0; i < n; i++) maxD = Math.max(maxD, K[i * n + i]);
  if (!(maxD > 0)) return { ok: false, pivot: 0 };
  const eps = maxD * tol;
  for (let j = 0; j < n; j++) {
    const rj = j * n;
    let d = K[rj + j];
    for (let k = 0; k < j; k++) d -= K[rj + k] * K[rj + k];
    if (!(d > eps)) return { ok: false, pivot: j };
    d = Math.sqrt(d);
    K[rj + j] = d;
    for (let i = j + 1; i < n; i++) {
      const ri = i * n;
      let s = K[ri + j];
      for (let k = 0; k < j; k++) s -= K[ri + k] * K[rj + k];
      K[ri + j] = s / d;
    }
  }
  return { ok: true };
}

/** Resuelve L·Lᵀ·x = b con la L que dejó cholesky(). */
export function cholSolve(L, n, b) {
  const x = Float64Array.from(b);
  for (let i = 0; i < n; i++) {
    let s = x[i];
    const ri = i * n;
    for (let k = 0; k < i; k++) s -= L[ri + k] * x[k];
    x[i] = s / L[ri + i];
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}

/**
 * Modo de menor rigidez de una matriz semidefinida (el "mecanismo"):
 * iteración inversa sobre K + μI. Devuelve un vector normalizado a máximo 1.
 */
export function softestMode(K, n, iterations = 8) {
  let maxD = 0;
  for (let i = 0; i < n; i++) maxD = Math.max(maxD, K[i * n + i]);
  const mu = (maxD || 1) * 1e-7;
  const A = Float64Array.from(K);
  for (let i = 0; i < n; i++) A[i * n + i] += mu;
  if (!cholesky(A, n, 1e-14).ok) return new Float64Array(n);
  let v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = Math.sin(i * 12.9898 + 1.3) * 0.5 + 0.61; // semilla determinista
  for (let it = 0; it < iterations; it++) {
    v = cholSolve(A, n, v);
    let m = 0;
    for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(v[i]));
    if (!m) break;
    for (let i = 0; i < n; i++) v[i] /= m;
  }
  return v;
}
