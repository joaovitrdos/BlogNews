import { Link } from 'react-router-dom';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

const PLACEHOLDER = 'https://placehold.co/600x400/1e293b/94a3b8?text=BlogNews';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function NewsCard({ news, large = false }) {
  const { ttsSpeak, ttsStop, ttsCurrentKey, prefs } = useAccessibility();
  const ttsKey = 'card-' + news.id;
  const isPlaying = ttsCurrentKey === ttsKey;
  const imageUrl = news.image_url || PLACEHOLDER;

  function handleOuvir(e) {
    e.preventDefault();
    if (isPlaying) { ttsStop(); return; }
    ttsSpeak(news.ai_summary || news.summary || news.title, ttsKey);
  }

  if (large) {
    return (
      <article className="group block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-white border border-slate-100">
        <Link to={`/noticia/${news.id}`} className="block">
          <div className="relative h-60 overflow-hidden bg-slate-100">
            <img
              src={imageUrl}
              alt={news.title}
              onError={e => { e.target.src = PLACEHOLDER; }}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
            {news.category && (
              <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {news.category}
              </span>
            )}
          </div>
          <div className="p-4 pb-3">
            <h2 className="text-base font-bold text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-2 mb-2 leading-snug">
              {news.title}
            </h2>
            <p className="text-gray-500 text-sm line-clamp-2 mb-3 leading-relaxed">{news.summary}</p>
            <time className="text-xs text-slate-400">{formatDate(news.published_at)}</time>
          </div>
        </Link>
        {prefs.toggles['tts'] && (
          <div className="px-4 pb-4">
            <button
              onClick={handleOuvir}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${isPlaying ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'}`}
              aria-label={isPlaying ? 'Parar leitura' : 'Ouvir resumo desta notícia'}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>
              </svg>
              {isPlaying ? 'Parar' : 'Ouvir'}
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <Link to={`/noticia/${news.id}`} className="group flex gap-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 border border-slate-100">
      <div className="w-24 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100">
        <img
          src={imageUrl}
          alt={news.title}
          onError={e => { e.target.src = PLACEHOLDER; }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="flex-1 min-w-0">
        {news.category && (
          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wide">{news.category}</span>
        )}
        <h3 className="font-semibold text-gray-900 group-hover:text-brand-600 transition-colors line-clamp-2 text-sm mt-0.5 leading-snug">
          {news.title}
        </h3>
        <time className="text-xs text-slate-400 mt-1 block">{formatDate(news.published_at)}</time>
      </div>
    </Link>
  );
}
