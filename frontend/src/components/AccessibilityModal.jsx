import { useEffect, useRef } from 'react';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

const TOGGLES = [
  { section: 'Contraste e cor', items: [
    { key: 'dark-mode',     label: 'Modo escuro',      desc: 'Reduz fadiga visual' },
    { key: 'high-contrast', label: 'Alto contraste',   desc: 'Preto e amarelo' },
    { key: 'invert',        label: 'Inverter cores',   desc: 'Negativo da página' },
    { key: 'saturate',      label: 'Saturação alta',   desc: 'Cores mais vivas' },
  ]},
  { section: 'Leitura', items: [
    { key: 'readable-font',   label: 'Fonte legível',         desc: 'Atkinson Hyperlegible' },
    { key: 'line-spacing',    label: 'Espaçamento amplo',     desc: 'Linhas mais arejadas' },
    { key: 'letter-spacing',  label: 'Espaço entre letras',   desc: 'Texto mais aberto' },
    { key: 'highlight-links', label: 'Destacar links',        desc: 'Sublinhado e cor' },
    { key: 'tts',             label: 'Leitor em voz alto',    desc: 'Selecione texto e ouça' },
    { key: 'hover-tts',       label: 'Ler ao passar o mouse', desc: 'Lê frases em tempo real' },
  ]},
  { section: 'Movimento', items: [
    { key: 'reduce-motion', label: 'Reduzir animações', desc: 'Para sensibilidade vestibular' },
    { key: 'big-cursor',    label: 'Cursor grande',     desc: 'Mais fácil de ver' },
  ]},
];

const FONT_OPTIONS = [
  { value: 100, label: 'A',    small: 'padrão' },
  { value: 115, label: 'A+',   small: 'maior' },
  { value: 130, label: 'A++',  small: 'grande' },
  { value: 150, label: 'A+++', small: 'extra' },
];

const CB_OPTIONS = [
  { value: 'none',         label: 'Nenhum' },
  { value: 'protanopia',   label: 'Protanopia',   small: 'vermelho' },
  { value: 'deuteranopia', label: 'Deuteranopia', small: 'verde' },
  { value: 'tritanopia',   label: 'Tritanopia',   small: 'azul' },
  { value: 'achromatopsia',label: 'Acromatopsia', small: 'P&B' },
];

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function AccessibilityModal() {
  const { prefs, modalOpen, closeModal, setFont, setColorblind, setToggle, reset } = useAccessibility();
  const panelRef = useRef(null);

  useEffect(() => {
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      const els = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (els?.length) setTimeout(() => els[0].focus(), 50);
    } else {
      document.body.style.overflow = '';
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key !== 'Tab') return;
      const els = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || [])
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (!els.length) return;
      if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalOpen, closeModal]);

  if (!modalOpen) return null;

  return (
    <div
      className="a11y-modal fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-title"
      aria-describedby="a11y-desc"
    >
      {/* Backdrop */}
      <div
        className="a11y-backdrop absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
        onClick={closeModal}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        role="document"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-6 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1 h-4 bg-brand-600 rounded-full" aria-hidden="true" />
              <p className="text-xs font-bold text-brand-600 uppercase tracking-wider">Acessibilidade</p>
            </div>
            <h2 id="a11y-title" className="text-xl font-bold text-gray-900">Configurações de acessibilidade</h2>
            <p id="a11y-desc" className="text-sm text-slate-400 mt-1">Ative apenas o que precisar. Suas preferências ficam salvas neste navegador.</p>
          </div>
          <button
            onClick={closeModal}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            aria-label="Fechar configurações de acessibilidade"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex flex-col gap-6 min-h-0 flex-1">
          {/* Tamanho do texto */}
          <fieldset className="border-0 p-0 m-0">
            <legend className="text-sm font-semibold text-gray-700 mb-3">Tamanho do texto</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tamanho do texto">
              {FONT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={prefs.font === opt.value}
                  onClick={() => setFont(opt.value)}
                  className={`flex flex-col items-start px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    prefs.font === opt.value
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-slate-200 text-gray-600 hover:border-brand-400'
                  }`}
                >
                  {opt.label}
                  <span className={`text-xs font-normal mt-0.5 ${prefs.font === opt.value ? 'text-blue-200' : 'text-slate-400'}`}>{opt.small}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Seções de toggles */}
          {TOGGLES.map(({ section, items }) => (
            <fieldset key={section} className="border-0 p-0 m-0">
              <legend className="text-sm font-semibold text-gray-700 mb-3">{section}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map(t => (
                  <label key={t.key} className={`a11y-toggle flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${prefs.toggles[t.key] ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-slate-50 hover:bg-slate-100'}`}>
                    <input
                      type="checkbox"
                      checked={!!prefs.toggles[t.key]}
                      onChange={e => setToggle(t.key, e.target.checked)}
                    />
                    <span className="a11y-toggle-ui" />
                    <span className="flex flex-col gap-0.5 text-sm">
                      <strong className="font-semibold text-gray-800">{t.label}</strong>
                      <span className="text-xs text-slate-400">{t.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {/* Daltonismo */}
          <fieldset className="border-0 p-0 m-0">
            <legend className="text-sm font-semibold text-gray-700 mb-3">Filtros para daltonismo</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filtro para daltonismo">
              {CB_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={prefs.cb === opt.value}
                  onClick={() => setColorblind(opt.value)}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    prefs.cb === opt.value
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-slate-200 text-gray-600 hover:border-brand-400'
                  }`}
                >
                  {opt.label}
                  {opt.small && <span className={`text-xs font-normal mt-0.5 ${prefs.cb === opt.value ? 'text-blue-200' : 'text-slate-400'}`}>{opt.small}</span>}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={reset}
            className="text-sm text-slate-400 hover:text-slate-700 font-medium transition-colors px-4 py-2 rounded-lg hover:bg-slate-200"
          >
            Restaurar padrão
          </button>
          <button
            onClick={closeModal}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-2 rounded-full transition-colors"
          >
            Salvar e continuar
          </button>
        </div>
      </div>
    </div>
  );
}
