// Texto a voz con Web Speech API. Lee frase por frase para poder resaltar,
// avanzar, retroceder, cambiar voz o velocidad sin perder el punto de lectura.
import { settings, saveSettings } from './db.js';
import { toast } from './util.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voiceList = [];
function loadVoices() { voiceList = synth ? synth.getVoices() : []; return voiceList; }
if (synth) synth.addEventListener?.('voiceschanged', loadVoices);

function pickVoice() {
  const s = settings();
  loadVoices();
  let v = voiceList.find(x => x.voiceURI === s.ttsVoice);
  if (!v) {
    const es = voiceList.filter(x => /^es/i.test(x.lang));
    v = es.find(x => /AR|419|US|MX/i.test(x.lang) && x.localService) || es.find(x => x.localService) || es[0] || null;
  }
  return v;
}

/**
 * Reproductor. Un "adaptador" (lector PDF o EPUB) le entrega frases:
 *  adapter.load(opts) -> { sentences:[{text,...}], index }
 *  adapter.next()     -> igual que load, para la página/capítulo siguiente (null al final)
 *  adapter.highlight(sentence|null)
 */
class Player {
  constructor() {
    this.state = 'idle'; // idle | loading | playing | paused
    this.sentences = []; this.index = 0; this.adapter = null; this.token = 0;
    this.listeners = new Set();
    this.sleepEnd = 0; this.sleepTick = null;
    this.title = '';
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { this.listeners.forEach(fn => { try { fn(this); } catch (e) { console.error(e); } }); this.updateMediaSession(); }
  get current() { return this.sentences[this.index] || null; }
  get active() { return this.state === 'playing' || this.state === 'loading' || this.state === 'paused'; }

  async start(adapter, opts = {}) {
    if (!synth) { toast('Tu navegador no permite la lectura en voz alta.'); return; }
    this.cancelSpeech();
    this.adapter = adapter; this.title = opts.title || '';
    this.state = 'loading'; this.emit();
    const tok = ++this.token;
    let r;
    try { r = await adapter.load(opts); } catch (e) { console.error(e); r = null; }
    if (tok !== this.token) return;
    if (!r) { this.stop(); toast('No hay texto para leer en esta parte.'); return; }
    this.sentences = r.sentences; this.index = r.index || 0;
    this.state = 'playing';
    if (!this.sentences.length || this.index >= this.sentences.length) return this.advanceUnit(tok);
    this.speak();
  }

  cancelSpeech() { if (synth && (synth.speaking || synth.pending)) synth.cancel(); }

  speak() {
    const tok = ++this.token;
    this.cancelSpeech();
    const s = this.sentences[this.index];
    if (!s) { this.advanceUnit(tok); return; }
    try { this.adapter.highlight(s); } catch (e) { console.error(e); }
    const u = new SpeechSynthesisUtterance(s.text);
    const v = pickVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-ES';
    u.rate = settings().ttsRate || 1;
    let started = false;
    u.onstart = () => { started = true; };
    u.onend = () => {
      if (tok !== this.token || this.state !== 'playing') return;
      this.index++; this.speak();
    };
    u.onerror = (e) => {
      if (tok !== this.token || this.state !== 'playing') return;
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      if (e.error === 'not-allowed') { this.pause(); toast('Tocá reproducir para iniciar la voz.'); return; }
      this.index++; setTimeout(() => { if (tok === this.token && this.state === 'playing') this.speak(); }, 60);
    };
    // Algunos navegadores ignoran la primera frase si se llama justo después de cancel().
    setTimeout(() => { if (tok === this.token && this.state === 'playing') synth.speak(u); }, 30);
    // Vigilancia: si la voz nunca arranca (bug de algunos Android), saltar.
    setTimeout(() => { if (tok === this.token && this.state === 'playing' && !started && !synth.speaking) { this.index++; this.speak(); } }, 6000 + s.text.length * 20);
    this.emit();
  }

  async advanceUnit(tok) {
    this.state = 'loading'; this.emit();
    for (let guard = 0; guard < 30; guard++) {
      let r = null;
      try { r = await this.adapter.next(); } catch (e) { console.error(e); }
      if (tok !== this.token) return;
      if (!r) { this.stop(); toast('Llegaste al final del libro.'); return; }
      if (r.sentences.length) {
        this.sentences = r.sentences; this.index = 0; this.state = 'playing'; this.speak(); return;
      }
    }
    this.stop();
  }

  toggle() {
    if (this.state === 'playing' || this.state === 'loading') this.pause();
    else if (this.state === 'paused') this.resume();
  }
  pause() { if (!this.active) return; this.token++; this.cancelSpeech(); this.state = 'paused'; this.emit(); }
  resume() { if (this.state !== 'paused') return; this.state = 'playing'; this.speak(); }
  stop() {
    this.token++; this.cancelSpeech(); this.state = 'idle';
    try { this.adapter?.highlight(null); } catch {}
    this.setSleep(0, true);
    this.emit();
  }
  nextSentence() {
    if (!this.sentences.length) return;
    if (this.index < this.sentences.length - 1) this.index++;
    else if (this.state === 'playing') { this.index++; }
    this.restart();
  }
  prevSentence() { if (this.index > 0) this.index--; this.restart(); }
  restart() {
    if (this.state === 'playing') this.speak();
    else { const s = this.current; if (s) this.adapter?.highlight(s); this.emit(); }
  }
  async setRate(rate) { await saveSettings({ ttsRate: rate }); if (this.state === 'playing') this.speak(); else this.emit(); }
  async setVoice(uri) { await saveSettings({ ttsVoice: uri }); if (this.state === 'playing') this.speak(); else this.emit(); }

  setSleep(min, silent = false) {
    clearInterval(this.sleepTick); this.sleepTick = null;
    this.sleepEnd = min ? Date.now() + min * 60000 : 0;
    if (min) {
      this.sleepTick = setInterval(() => {
        if (Date.now() >= this.sleepEnd) {
          this.sleepEnd = 0; clearInterval(this.sleepTick); this.sleepTick = null;
          this.pause(); toast('Temporizador de sueño: la lectura en voz alta se detuvo.');
        }
        this.listeners.forEach(fn => fn(this, 'tick'));
      }, 1000);
    }
    if (!silent) this.emit();
  }
  sleepLeft() { return this.sleepEnd ? Math.max(0, this.sleepEnd - Date.now()) : 0; }

  updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      if (this.state === 'idle') { navigator.mediaSession.playbackState = 'none'; return; }
      navigator.mediaSession.metadata = new MediaMetadata({ title: this.title || 'MiLibroPDF', artist: 'MiLibroPDF · lectura en voz alta' });
      navigator.mediaSession.playbackState = this.state === 'paused' ? 'paused' : 'playing';
      navigator.mediaSession.setActionHandler('play', () => this.resume());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSentence());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prevSentence());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
    } catch {}
  }
}

export const player = new Player();

export const tts = {
  supported: !!synth,
  async voices() {
    if (!synth) return [];
    loadVoices();
    if (!voiceList.length) {
      await new Promise(r => {
        const t = setTimeout(r, 1500);
        synth.addEventListener('voiceschanged', () => { clearTimeout(t); r(); }, { once: true });
      });
      loadVoices();
    }
    return [...voiceList].sort((a, b) =>
      (Number(/^es/i.test(b.lang)) - Number(/^es/i.test(a.lang))) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  },
  pickVoice,
  sample(text) {
    if (!synth) { toast('Tu navegador no permite la lectura en voz alta.'); return; }
    player.pause();
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'es-ES';
    u.rate = settings().ttsRate || 1;
    synth.speak(u);
  },
};
