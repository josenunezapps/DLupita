export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function validate(m) {
  if (!m || m.version !== 1 || typeof m.name !== "string" || m.name.length > 80)
    throw Error("El archivo no es un proyecto CAUCE válido.");
  for (const [k, min, max] of [
    ["rate", 1, 240],
    ["duration", 15, 480],
    ["seed", 1, 999999],
  ])
    if (!Number.isFinite(m[k]) || m[k] < min || m[k] > max)
      throw Error("Valor fuera de rango: " + k);
  if (
    !Array.isArray(m.stations) ||
    m.stations.length < 1 ||
    m.stations.length > 6
  )
    throw Error("Usá entre 1 y 6 estaciones.");
  const ids = new Set();
  m.stations.forEach((s) => {
    if (
      !s ||
      typeof s.id !== "string" ||
      ids.has(s.id) ||
      !/^s[a-z0-9-]{1,40}$/.test(s.id)
    )
      throw Error("Identificador de estación inválido.");
    ids.add(s.id);
    if (
      typeof s.name !== "string" ||
      !s.name.trim() ||
      s.name.length > 35 ||
      !Number.isFinite(s.time) ||
      s.time < 0.1 ||
      s.time > 30 ||
      !Number.isInteger(s.servers) ||
      s.servers < 1 ||
      s.servers > 10 ||
      !Number.isFinite(s.variation) ||
      s.variation < 0 ||
      s.variation > 1
    )
      throw Error("Revisá los parámetros de las estaciones.");
  });
  return structuredClone(m);
}
export function simulate(input, seed = input.seed, trace = true) {
  const m = validate(input),
    rng = random(seed),
    clients = [];
  let t = 0;
  while (true) {
    t += (-Math.log(1 - rng()) * 60) / m.rate;
    if (t > m.duration) break;
    clients.push({
      id: clients.length,
      arrival: t,
      end: t,
      wait: 0,
      steps: [],
    });
  }
  const stations = m.stations.map((s, si) => {
    const free = Array(s.servers).fill(0);
    let busy = 0,
      wait = 0,
      maxQueue = 0;
    const events = [];
    const arrivals = [...clients].sort((a, b) => a.end - b.end || a.id - b.id);
    for (const c of arrivals) {
      const arrival = c.end;
      let lane = 0;
      for (let i = 1; i < free.length; i++) if (free[i] < free[lane]) lane = i;
      const start = Math.max(arrival, free[lane]),
        r = random(seed + c.id * 7919 + si * 104729)();
      const service = s.time * (1 + s.variation * (2 * r - 1)),
        end = start + service;
      free[lane] = end;
      busy += Math.max(
        0,
        Math.min(end, m.duration) - Math.min(start, m.duration),
      );
      wait += start - arrival;
      c.wait += start - arrival;
      c.end = end;
      if (start > arrival) {
        events.push([arrival, 1], [start, -1]);
      }
      if (trace) c.steps.push({ arrival, start, end, lane });
    }
    let q = 0;
    events
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .forEach((e) => {
        q += e[1];
        maxQueue = Math.max(maxQueue, q);
      });
    return {
      id: s.id,
      wait: wait / (clients.length || 1),
      utilization: busy / (m.duration * s.servers),
      maxQueue,
    };
  });
  const waits = clients.map((c) => c.wait).sort((a, b) => a - b);
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  return {
    arrived: clients.length,
    completed: clients.filter((c) => c.end <= m.duration).length,
    wait: mean(waits),
    p95: waits[Math.max(0, Math.ceil(waits.length * 0.95) - 1)] || 0,
    cycle: mean(clients.map((c) => c.end - c.arrival)),
    stations,
    clients: trace ? clients : [],
    duration: m.duration,
  };
}
export function snapshot(result, t) {
  return result.stations.map((s, i) => {
    let queue = 0,
      busy = 0;
    for (const c of result.clients) {
      const x = c.steps[i];
      if (t >= x.arrival && t < x.start) queue++;
      if (t >= x.start && t < x.end) busy++;
    }
    return { queue, busy };
  });
}
export function allocations(n, budget) {
  const out = [];
  function walk(a, left) {
    if (a.length === n - 1) {
      out.push([...a, left]);
      return;
    }
    for (let i = 0; i <= left; i++) walk([...a, i], left - i);
  }
  walk([], budget);
  return out;
}
export function optimize(m, budget = 2) {
  const base = validate(m);
  if (!Number.isInteger(budget) || budget < 1 || budget > 4)
    throw Error("Elegí de 1 a 4 recursos.");
  const seeds = [17, 137, 941, 2027, 8191].map((x) => x + base.seed);
  const score = (model) =>
    seeds.reduce((a, s) => a + simulate(model, s, false).wait, 0) /
    seeds.length;
  const baseline = score(base);
  let best = null,
    tested = 0;
  for (const allocation of allocations(base.stations.length, budget)) {
    const candidate = structuredClone(base);
    candidate.stations.forEach((s, i) => (s.servers += allocation[i]));
    if (candidate.stations.some((s) => s.servers > 10)) continue;
    const wait = score(candidate);
    tested++;
    if (!best || wait < best.wait)
      best = { model: candidate, allocation, wait };
  }
  if (!best)
    throw Error("Todas las estaciones alcanzaron el máximo de recursos.");
  const samples = [];
  for (let i = 0; i < 20; i++) {
    const seed = base.seed + 50000 + i * 119;
    samples.push(
      simulate(base, seed, false).wait - simulate(best.model, seed, false).wait,
    );
  }
  const improvement = samples.reduce((a, b) => a + b, 0) / samples.length,
    sd = Math.sqrt(
      samples.reduce((a, b) => a + (b - improvement) ** 2, 0) / 19,
    );
  return {
    ...best,
    baseline,
    tested,
    improvement,
    margin: (2.093 * sd) / Math.sqrt(20),
  };
}
export const presets = {
  cafe: {
    version: 1,
    name: "Café del horizonte",
    rate: 38,
    duration: 120,
    seed: 4261,
    stations: [
      {
        id: "s1",
        name: "Pedido y pago",
        time: 1.2,
        servers: 1,
        variation: 0.35,
      },
      { id: "s2", name: "Preparación", time: 3.4, servers: 2, variation: 0.45 },
      { id: "s3", name: "Entrega", time: 0.7, servers: 1, variation: 0.2 },
    ],
  },
  taller: {
    version: 1,
    name: "Taller de bicicletas",
    rate: 9,
    duration: 240,
    seed: 4261,
    stations: [
      { id: "s1", name: "Recepción", time: 3, servers: 1, variation: 0.3 },
      { id: "s2", name: "Diagnóstico", time: 9, servers: 1, variation: 0.6 },
      { id: "s3", name: "Reparación", time: 12, servers: 2, variation: 0.5 },
      { id: "s4", name: "Retiro", time: 2, servers: 1, variation: 0.2 },
    ],
  },
  envios: {
    version: 1,
    name: "Estudio de envíos",
    rate: 65,
    duration: 120,
    seed: 4261,
    stations: [
      { id: "s1", name: "Selección", time: 1.4, servers: 2, variation: 0.4 },
      { id: "s2", name: "Empaque", time: 2.3, servers: 2, variation: 0.4 },
      { id: "s3", name: "Despacho", time: 0.8, servers: 1, variation: 0.2 },
    ],
  },
};
export function stress(input) {
  const m = validate(input),
    capacity = Math.min(...m.stations.map((s) => (60 * s.servers) / s.time));
  const rates = [
    ...new Set(
      Array.from({ length: 12 }, (_, i) =>
        Math.min(240, Math.max(1, Math.round(capacity * (0.25 + i * 0.125)))),
      ),
    ),
  ];
  return {
    capacity,
    points: rates.map((rate) => {
      let wait = 0,
        completed = 0;
      for (let i = 0; i < 5; i++) {
        const r = simulate({ ...m, rate }, m.seed + i * 997, false);
        wait += r.wait / 5;
        completed += r.completed / 5;
      }
      return { rate, wait, completed };
    }),
  };
}
