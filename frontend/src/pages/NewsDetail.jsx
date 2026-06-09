import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Spinner from '../components/Spinner.jsx';
import { getNewsById, getRelatedNews } from '../services/api.js';
import NewsCard from '../components/NewsCard.jsx';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const PLACEHOLDER = 'https://placehold.co/800x400/1e293b/94a3b8?text=BlogNews';

export default function NewsDetail() {
  const { id } = useParams();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [related, setRelated] = useState([]);
  const { ttsSpeak, ttsStop, ttsCurrentKey, prefs } = useAccessibility();

  const ttsKey = 'article-' + id;
  const isPlaying = ttsCurrentKey === ttsKey;

  useEffect(() => {
    setRelated([]);
    getNewsById(id)
      .then(data => {
        setNews(data);
        if (data.category) {
          getRelatedNews(data.category, data.id, 4)
            .then(setRelated)
            .catch(() => {});
        }
      })
      .catch(() => setError('Notícia não encontrada.'))
      .finally(() => setLoading(false));
  }, [id]);

  function handleOuvir() {
    if (isPlaying) { ttsStop(); return; }
    const text = news?.ai_summary || news?.summary || '';
    if (text) ttsSpeak(text, ttsKey);
  }

  if (loading) return <Spinner />;
  if (error) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <p className="text-red-500 mb-4">{error}</p>
      <Link to="/" className="text-brand-600 hover:underline">Voltar ao início</Link>
    </div>
  );

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/noticias" className="inline-flex items-center gap-1 text-slate-400 hover:text-brand-600 text-sm mb-6 transition-colors">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Voltar às notícias
      </Link>

      {news.category && (
        <span className="inline-block bg-brand-50 text-brand-700 text-xs font-bold px-3 py-1 rounded-full mb-3 border border-brand-100">
          {news.category}
        </span>
      )}

      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug mb-4">
        {news.title}
      </h1>

      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mb-5 pb-5 border-b border-slate-100">
        <span className="font-medium text-slate-600">{news.source}</span>
        <span className="text-slate-300">·</span>
        <time>{formatDate(news.published_at)}</time>
        {prefs.toggles['tts'] && (
          <button
            onClick={handleOuvir}
            className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
              isPlaying ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600 border border-brand-100 hover:bg-brand-100'
            }`}
            aria-label={isPlaying ? 'Parar leitura' : 'Ouvir artigo em voz alta'}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>
            </svg>
            {isPlaying ? 'Parar' : 'Ouvir artigo'}
          </button>
        )}
      </div>

      <img
        src={news.image_url || PLACEHOLDER}
        alt={news.title}
        onError={e => { e.target.src = PLACEHOLDER; }}
        className="w-full rounded-xl object-cover max-h-80 mb-6 bg-slate-100"
      />

      {news.ai_summary && news.ai_summary !== news.summary && (
        <div className="bg-brand-50 border-l-4 border-brand-500 p-4 rounded-r-xl mb-6">
          <p className="text-xs font-bold text-brand-600 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            Resumo com IA
          </p>
          <p className="text-gray-800 leading-relaxed text-sm">{news.ai_summary}</p>
        </div>
      )}

      {news.summary && (
        <div className="text-gray-700 leading-relaxed mb-6 text-base">
          <p>{news.summary}</p>
        </div>
      )}

      {news.ai_keywords?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {news.ai_keywords.map(k => (
            <span key={k} className="bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded-full">{k}</span>
          ))}
        </div>
      )}

      <a
        href={news.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 bg-brand-600 text-white font-semibold px-6 py-3 rounded-full hover:bg-brand-700 transition-colors shadow-sm"
      >
        Ler notícia completa no G1
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
      </a>

      {related.length > 0 && (
        <section className="mt-12 pt-8 border-t border-slate-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Mais em <span className="text-brand-600">{news.category}</span>
          </h2>
          <div className="flex flex-col gap-3">
            {related.map(item => (
              <NewsCard key={item.id} news={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
