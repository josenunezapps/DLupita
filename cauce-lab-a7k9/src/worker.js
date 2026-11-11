import { optimize, stress } from "./engine.js";
self.onmessage = ({ data }) => {
  try {
    self.postMessage({
      id: data.id,
      result:
        data.type === "stress"
          ? stress(data.model)
          : optimize(data.model, data.budget),
    });
  } catch (e) {
    self.postMessage({ id: data.id, error: e.message });
  }
};
