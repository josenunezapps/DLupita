# Neurona — una IA que aprende frente a tus ojos

Una red neuronal escrita desde cero en JavaScript que aprende a reconocer dibujos **en tu navegador**: sin librerías de IA, sin servidores, sin internet.

**Demo:** https://josenunezapps.github.io/DLupita/neurona/

- **Aprende en vivo**: al abrir la página, un generador inventa miles de dibujos a mano alzada (torcidos, sin cerrar, con temblor) y la red entrena frente a vos en ~8 segundos, con el error y los aciertos en vivo.
- **Adivina mientras dibujás**: 12 cosas (círculo, cuadrado, triángulo, estrella, corazón, rayo, flecha, casa, luna, carita, espiral, ola).
- **Enseñale algo nuevo**: dibujalo 6 veces y lo aprende en ~4 segundos, sin olvidar lo anterior (aprendizaje por transferencia).
- **Adentro de la red**: ves qué neuronas se encienden y por dónde viaja la señal; y qué patrones aprendió la primera capa.
- **Desafío**: 6 rondas de "¿me adivina?" contra reloj.

## Técnica
`shapes.js` (generador + aumentación + rasterizado tipo MNIST), `net.js` (perceptrón 784-128-64-N con ReLU, softmax, entropía cruzada y Adam), `worker.js` (entrenamiento en un Web Worker), `app.js` (pizarra, visualización, enseñar, desafío). Los pesos quedan guardados en el navegador.

Resultados medidos: 100% en validación sintética; 24/24 dibujos a mano con mouse; clase nueva aprendida con 6 ejemplos y reconocida 4/4.
