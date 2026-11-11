import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulate,
  optimize,
  validate,
  presets,
  snapshot,
  allocations,
} from "../src/engine.js";
test("reproducible for identical seed", () =>
  assert.deepEqual(simulate(presets.cafe), simulate(presets.cafe)));
test("different seeds change arrivals", () =>
  assert.notDeepEqual(
    simulate(presets.cafe, 1).clients,
    simulate(presets.cafe, 2).clients,
  ));
test("clients conserved and chronological service, no resource overlap", () => {
  for (const m of Object.values(presets)) {
    const r = simulate(m);
    assert.equal(r.arrived, r.clients.length);
    assert.ok(r.completed <= r.arrived);
    for (let i = 0; i < m.stations.length; i++) {
      for (let lane = 0; lane < m.stations[i].servers; lane++) {
        let end = 0;
        for (const s of r.clients
          .map((c) => c.steps[i])
          .filter((s) => s.lane === lane)
          .sort((a, b) => a.start - b.start)) {
          assert.ok(s.start >= s.arrival);
          assert.ok(s.start >= end);
          assert.ok(s.end >= s.start);
          end = s.end;
        }
      }
    }
    for (const s of r.stations)
      assert.ok(s.utilization >= 0 && s.utilization <= 1.000001);
  }
});
test("snapshot accounting equals admitted minus departed", () => {
  const r = simulate(presets.cafe);
  for (let t = 0; t < 120; t += 0.7) {
    const count = snapshot(r, t).reduce((a, s) => a + s.queue + s.busy, 0);
    assert.equal(
      count,
      r.clients.filter((c) => c.arrival <= t && c.end > t).length,
    );
  }
});
test("zero service variance honors exact duration", () => {
  const m = structuredClone(presets.cafe);
  m.stations.forEach((s) => (s.variation = 0));
  const r = simulate(m);
  r.clients.forEach((c) =>
    c.steps.forEach((s, i) =>
      assert.ok(Math.abs(s.end - s.start - m.stations[i].time) < 1e-9),
    ),
  );
});
test("optimizer conserves resources and improves training mean", () => {
  const r = optimize(presets.cafe, 2);
  assert.equal(
    r.allocation.reduce((a, b) => a + b),
    2,
  );
  assert.equal(r.tested, 6);
  assert.ok(r.wait <= r.baseline);
  assert.ok(Number.isFinite(r.margin));
  assert.ok(r.improvement > 0);
});
test("all integer allocations enumerated once", () => {
  const a = allocations(6, 4);
  assert.equal(a.length, 126);
  assert.equal(new Set(a.map(JSON.stringify)).size, 126);
  a.forEach((x) =>
    assert.equal(
      x.reduce((a, b) => a + b),
      4,
    ),
  );
});
test("malformed imports rejected", () => {
  for (const change of [
    (m) => (m.rate = Infinity),
    (m) => (m.stations = []),
    (m) => (m.stations[0].servers = 1.2),
    (m) => (m.stations[0].name = ""),
    (m) => (m.stations[0].id = '\" onclick='),
    (m) => (m.stations[1].id = m.stations[0].id),
    (m) => (m.version = 2),
  ]) {
    const m = structuredClone(presets.cafe);
    change(m);
    assert.throws(() => validate(m));
  }
});
test("quiet system has valid empty statistics", () => {
  const m = structuredClone(presets.cafe);
  m.rate = 1;
  m.duration = 15;
  let r;
  for (let seed = 1; seed < 100; seed++) {
    r = simulate(m, seed);
    if (!r.arrived) break;
  }
  assert.equal(r.arrived, 0);
  assert.equal(r.wait, 0);
  assert.equal(r.p95, 0);
});
test("store undo redo and persistence roundtrip", async () => {
  let raw = null;
  global.localStorage = {
    getItem: () => raw,
    setItem: (k, v) => {
      raw = v;
    },
  };
  const { Store } = await import("../src/store.js");
  const s = new Store(),
    m = structuredClone(s.model);
  m.rate = 77;
  s.set(m);
  assert.equal(new Store().model.rate, 77);
  s.undo();
  assert.equal(s.model.rate, 38);
  s.redo();
  assert.equal(s.model.rate, 77);
  s.undo();
  s.set({ ...m, rate: 80 });
  assert.equal(s.future.length, 0);
});
test("stress curve exposes bottleneck capacity and finite bounded samples", async () => {
  const { stress } = await import("../src/engine.js");
  const r = stress(presets.cafe);
  assert.ok(Math.abs(r.capacity - 120 / 3.4) < 1e-9);
  assert.equal(r.points.length, 12);
  r.points.forEach((p) => {
    assert.ok(p.rate >= 1 && p.rate <= 240);
    assert.ok(p.wait >= 0 && Number.isFinite(p.wait));
  });
  assert.ok(r.points.at(-1).wait > r.points[0].wait);
});
