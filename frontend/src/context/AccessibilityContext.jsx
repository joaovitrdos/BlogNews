import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'blog-acessivel-prefs';
const DEFAULTS = {
  font: 100,
  cb: 'none',
  toggles: {
    'dark-mode': false,
    'high-contrast': false,
    'invert': false,
    'saturate': false,
    'readable-font': false,
    'line-spacing': false,
    'letter-spacing': false,
    'highlight-links': false,
    'tts': false,
    'hover-tts': false,
    'reduce-motion': false,
    'big-cursor': false,
  },
};

const TOGGLE_TARGETS = {
  'dark-mode': 'body', 'high-contrast': 'body', 'invert': 'html', 'saturate': 'html',
  'readable-font': 'body', 'line-spacing': 'body', 'letter-spacing': 'body',
  'highlight-links': 'body', 'tts': 'body',
  'hover-tts': 'body', 'reduce-motion': 'body', 'big-cursor': 'body',
};

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(DEFAULTS);
    const p = JSON.parse(raw);
    return { ...deepClone(DEFAULTS), ...p, toggles: { ...DEFAULTS.toggles, ...(p.toggles || {}) } };
  } catch { return deepClone(DEFAULTS); }
}

function playBeep(freq, duration, vol = 0.35) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {}
}

const AudioFX = {
  click: () => playBeep(880, 80, 0.4),
  on: () => playBeep(1320, 90, 0.45),
  off: () => playBeep(660, 90, 0.4),
  open: () => playBeep(1100, 140, 0.35),
  close: () => playBeep(550, 140, 0.3),
};

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [modalOpen, setModalOpen] = useState(false);
  const [ttsCurrentKey, setTtsCurrentKey] = useState(null);
  const [selectedText, setSelectedText] = useState('');

  function saveAndSet(newPrefs) {
    setPrefs(newPrefs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs)); } catch {}
  }

  // Apply classes to html/body
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    ['font-100', 'font-115', 'font-130', 'font-150'].forEach(c => html.classList.remove(c));
    html.classList.add('font-' + prefs.font);
    ['cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia', 'cb-achromatopsia'].forEach(c => html.classList.remove(c));
    if (prefs.cb && prefs.cb !== 'none') html.classList.add('cb-' + prefs.cb);
    Object.entries(prefs.toggles).forEach(([key, val]) => {
      const target = TOGGLE_TARGETS[key] === 'html' ? html : body;
      target.classList.toggle(key, !!val);
    });
  }, [prefs]);

  // Auto-open modal on first page load
  useEffect(() => {
    const t = setTimeout(() => setModalOpen(true), 380);
    return () => clearTimeout(t);
  }, []);

  // Selection TTS listener
  useEffect(() => {
    if (!prefs.toggles['tts']) { setSelectedText(''); return; }
    const handler = () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : '';
      setSelectedText(text.length > 1 ? text : '');
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [prefs.toggles['tts']]);

  const ttsStop = useCallback(() => {
    const synth = window.speechSynthesis;
    if (synth && (synth.speaking || synth.pending)) synth.cancel();
    setTtsCurrentKey(null);
  }, []);

  const ttsSpeak = useCallback((text, key, opts = {}) => {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    ttsStop();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const voice = voices.find(v => /pt-BR/i.test(v.lang)) || voices.find(v => /pt/i.test(v.lang)) || voices[0];
    if (voice) { utt.voice = voice; utt.lang = voice.lang; } else utt.lang = 'pt-BR';
    utt.rate = opts.rate || 1;
    utt.pitch = opts.pitch || 1;
    utt.volume = opts.volume || 1;
    utt.onend = () => setTtsCurrentKey(null);
    utt.onerror = () => setTtsCurrentKey(null);
    const k = key || text.substring(0, 24);
    setTtsCurrentKey(k);
    synth.speak(utt);
  }, [ttsStop]);

  function setFont(value) {
    saveAndSet({ ...prefs, font: parseInt(value, 10) || 100 });
    AudioFX.click();
  }

  function setColorblind(value) {
    saveAndSet({ ...prefs, cb: value });
    AudioFX.click();
  }

  function setToggle(key, value) {
    saveAndSet({ ...prefs, toggles: { ...prefs.toggles, [key]: !!value } });
    AudioFX[value ? 'on' : 'off']();
    if (!value && (key === 'tts' || key === 'hover-tts')) {
      ttsStop();
      setSelectedText('');
    }
  }

  function reset() {
    saveAndSet(deepClone(DEFAULTS));
    AudioFX.click();
    ttsStop();
    setSelectedText('');
  }

  function openModal() {
    setModalOpen(true);
    AudioFX.open();
  }

  function closeModal() {
    setModalOpen(false);
    AudioFX.close();
  }

  return (
    <AccessibilityContext.Provider value={{
      prefs, modalOpen, openModal, closeModal,
      setFont, setColorblind, setToggle, reset,
      ttsSpeak, ttsStop, ttsCurrentKey,
      selectedText, setSelectedText,
    }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  return useContext(AccessibilityContext);
}
