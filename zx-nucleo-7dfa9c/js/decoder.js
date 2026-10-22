/* Decodifica imágenes fuera del hilo principal y devuelve ImageBitmap transferible. */
self.onmessage = async (e) => {
  const { id, blob } = e.data;
  try {
    const bm = await createImageBitmap(blob);
    self.postMessage({ id, bm }, [bm]);
  } catch (err) {
    self.postMessage({ id, err: String(err) });
  }
};
