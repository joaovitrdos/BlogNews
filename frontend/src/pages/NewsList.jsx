import { useEffect, useState, useCallback } from 'react';
import NewsCard from '../components/NewsCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { getNewsList, getCategories } from '../services/api.js';

const PAGE_SIZE = 18;

export default function NewsList() {
  const [news, setNews] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');

  const loadNews = useCallback(async (p, cat) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getNewsList({ limit: PAGE_SIZE, offset: p * PAGE_SIZE, category: cat || undefined });
      setNews(data.news);
      setTotal(data.total);
    } catch {
      setError('Erro ao carregar notícias.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadNews(page, selectedCategory);
  }, [page, selectedCategory, loadNews]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-6 bg-brand-600 rounded-full inline-block" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900">Todas as Notícias</h1>
        {total > 0 && <span className="text-sm text-slate-400 font-normal">{total} notícias</span>}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => { setSelectedCategory(''); setPage(0); }}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            !selectedCategory
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-600 border-slate-200 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          Todas
        </button>
        {categories.map(c => (
          <button
            key={c.category}
            onClick={() => { setSelectedCategory(c.category); setPage(0); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              selectedCategory === c.category
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-slate-200 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {c.category} <span className="ml-1 opacity-50">({c.count})</span>
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : error ? (
        <p className="text-red-500 text-center py-8">{error}</p>
      ) : news.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Nenhuma notícia encontrada.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {news.map(n => <NewsCard key={n.id} news={n} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-gray-700 disabled:opacity-40 hover:border-brand-400 hover:text-brand-600 transition-colors text-sm font-medium"
          >
            ← Anterior
          </button>
          <span className="text-sm text-slate-500">Página {page + 1} de {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white disabled:opacity-40 hover:bg-brand-700 transition-colors text-sm font-medium"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
