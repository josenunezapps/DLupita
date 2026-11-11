// Simulación visual del derrumbe: partículas con integración de Verlet y barras como restricciones
// de distancia. Es una aproximación para mostrar el colapso; los números salen del análisis estático.

export function createCollapse(model, { removed = [], groundY, gravity = 9.81, breakStrain = 0.1 } = {}) {
  const gone = new Set(removed);
  const index = new Map(model.nodes.map((n, i) => [n.id, i]));
  const particles = model.nodes.map((n) => ({
    x: n.x, y: n.y, px: n.x, py: n.y, x0: n.x, y0: n.y,
    fixX: n.support === 'pin' || n.support === 'rollerY',
    fixY: n.support === 'pin' || n.support === 'rollerX',
  }));
  const links = model.members.filter((b) => !gone.has(b.id)).map((b) => {
    const a = index.get(b.a), c = index.get(b.b);
    return { id: b.id, a, b: c, L: Math.hypot(particles[c].x - particles[a].x, particles[c].y - particles[a].y), alive: true };
  });
  const sim = { particles, links, time: 0, breaks: [], groundY };

  sim.step = (dt = 1 / 60) => {
    sim.time += dt;
    for (const p of particles) {
      const vx = (p.x - p.px) * 0.996, vy = (p.y - p.py) * 0.996;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy - gravity * dt * dt;
    }
    for (let it = 0; it < 12; it++) {
      for (const l of links) {
        if (!l.alive) continue;
        const A = particles[l.a], B = particles[l.b];
        const dx = B.x - A.x, dy = B.y - A.y;
        const d = Math.hypot(dx, dy) || 1e-9;
        const diff = (d - l.L) / d / 2;
        A.x += dx * diff; A.y += dy * diff;
        B.x -= dx * diff; B.y -= dy * diff;
      }
      for (const p of particles) {
        if (p.fixX) p.x = p.x0;
        if (p.fixY) p.y = p.y0;
        if (p.y < groundY) { p.y = groundY; p.px = p.x - (p.x - p.px) * 0.4; }
      }
    }
    for (const l of links) {
      if (!l.alive) continue;
      const A = particles[l.a], B = particles[l.b];
      const d = Math.hypot(B.x - A.x, B.y - A.y);
      if (Math.abs(d - l.L) / l.L > breakStrain) {
        l.alive = false;
        sim.breaks.push({ id: l.id, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, time: sim.time });
      }
    }
  };

  sim.energy = () => particles.reduce((e, p) => e + (p.x - p.px) ** 2 + (p.y - p.py) ** 2, 0);
  return sim;
}
