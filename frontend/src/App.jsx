import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext.jsx';
import AccessibilityModal from './components/AccessibilityModal.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import NewsList from './pages/NewsList.jsx';
import NewsDetail from './pages/NewsDetail.jsx';

const HOVER_IGNORE = '.a11y-backdrop,.skip-link,.tts-fab,.tts-fab *,script,style,svg,svg *';
const HOVER_DELAY = 260;
const BLOCK_TAGS = ['P','LI','BLOCKQUOTE','H1','H2','H3','H4','H5','H6','A','BUTTON','LABEL','LEGEND','TIME','DD','DT','FIGCAPTION','TD','TH','SUMMARY'];

function getCaretInfo(x, y) {
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return null;
}

function findBlockAncestor(node) {
  let cur = node;
  if (cur?.nodeType === Node.TEXT_NODE) cur = cur.parentElement;
  let fallback = null;
  for (let i = 0; cur && i < 12; i++) {
    if (cur.matches?.(HOVER_IGNORE)) return null;
    if (cur.tagName && BLOCK_TAGS.includes(cur.tagName)) return cur;
    if (!fallback && cur.tagName) {
      const inner = (cur.innerText || cur.textContent || '').trim();
      if (inner && inner.length > 1 && inner.length < 200) fallback = cur;
    }
    cur = cur.parentElement;
  }
  return fallback;
}

function getSentenceAtPoint(x, y, fallbackEl) {
  const info = getCaretInfo(x, y);
  let textNode = info?.node;
  let localOffset = info?.offset || 0;
  if (textNode && textNode.nodeType !== Node.TEXT_NODE) {
    const walker = document.createTreeWalker(textNode, NodeFilter.SHOW_TEXT, null);
    textNode = walker.nextNode();
    localOffset = 0;
  }
  const block = findBlockAncestor(textNode || fallbackEl);
  if (!block) return null;
  const fullText = (block.innerText || block.textContent || '').replace(/\s+/g, ' ').trim();
  if (!fullText || fullText.length < 2) return null;
  if (!block._a11yKey) block._a11yKey = Math.random().toString(36).slice(2);
  const bk = block._a11yKey;
  if (fullText.length <= 240 || !textNode?.nodeValue) return { text: fullText, key: 'blk:' + bk };
  const localText = textNode.nodeValue;
  const offset = Math.min(Math.max(localOffset, 0), localText.length);
  let start = offset, end = offset;
  while (start > 0 && !/[.!?\n]/.test(localText[start - 1])) start--;
  while (end < localText.length && !/[.!?\n]/.test(localText[end])) end++;
  if (end < localText.length) end++;
  const sentence = localText.substring(start, end).replace(/\s+/g, ' ').trim();
  return sentence.length < 4 ? { text: fullText, key: 'blk:' + bk } : { text: sentence, key: 'snt:' + bk + ':' + start };
}

function AppInner() {
  const { prefs, ttsSpeak, ttsStop, ttsCurrentKey, selectedText, setSelectedText } = useAccessibility();
  const hoverTimerRef = useRef(null);
  const lastHoverKeyRef = useRef('');

  // Hover TTS
  useEffect(() => {
    if (!prefs.toggles['hover-tts']) return;
    const onMove = (e) => {
      const target = e.target;
      if (!target || target.matches?.(HOVER_IGNORE)) return;
      const result = getSentenceAtPoint(e.clientX, e.clientY, target);
      if (!result?.text) return;
      if (result.key === lastHoverKeyRef.current) return;
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        lastHoverKeyRef.current = result.key;
        ttsSpeak(result.text, result.key, { rate: 1.05 });
      }, HOVER_DELAY);
    };
    const onLeave = (e) => { if (!e.relatedTarget) { clearTimeout(hoverTimerRef.current); } };
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseout', onLeave);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onLeave);
      clearTimeout(hoverTimerRef.current);
      lastHoverKeyRef.current = '';
    };
  }, [prefs.toggles['hover-tts'], ttsSpeak]);

  const isPlaying = !!ttsCurrentKey;

  function handleFab() {
    if (isPlaying) { ttsStop(); return; }
    if (selectedText) {
      ttsSpeak(selectedText, 'fab');
      setSelectedText('');
    }
  }

  const showFab = prefs.toggles['tts'] && !!selectedText;

  return (
    <>
      {/* SVG colorblind filter defs */}
      <svg aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <defs>
          <filter id="protanopia"><feColorMatrix type="matrix" values="0.567,0.433,0,0,0 0.558,0.442,0,0,0 0,0.242,0.758,0,0 0,0,0,1,0"/></filter>
          <filter id="deuteranopia"><feColorMatrix type="matrix" values="0.625,0.375,0,0,0 0.7,0.3,0,0,0 0,0.3,0.7,0,0 0,0,0,1,0"/></filter>
          <filter id="tritanopia"><feColorMatrix type="matrix" values="0.95,0.05,0,0,0 0,0.433,0.567,0,0 0,0.475,0.525,0,0 0,0,0,1,0"/></filter>
          <filter id="achromatopsia"><feColorMatrix type="matrix" values="0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0.299,0.587,0.114,0,0 0,0,0,1,0"/></filter>
        </defs>
      </svg>

      <a href="#conteudo-principal" className="skip-link">Pular para o conteúdo principal</a>

      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main id="conteudo-principal" style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/noticias" element={<NewsList />} />
            <Route path="/noticia/:id" element={<NewsDetail />} />
          </Routes>
        </main>
        <Footer />
      </div>

      <AccessibilityModal />

      {/* TTS FAB */}
      {(showFab || isPlaying) && (
        <button
          className={`tts-fab${isPlaying ? ' is-playing' : ''}`}
          onClick={handleFab}
          aria-label={isPlaying ? 'Parar leitura' : 'Ler conteúdo selecionado em voz alta'}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/>
          </svg>
          <span>{isPlaying ? 'Parar' : 'Ouvir seleção'}</span>
        </button>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AccessibilityProvider>
        <AppInner />
      </AccessibilityProvider>
    </BrowserRouter>
  );
}
