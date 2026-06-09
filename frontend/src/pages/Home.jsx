import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NewsCard from '../components/NewsCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { getLatestNews } from '../services/api.js';

export default function Home() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getLatestNews(9)
      .then(setNews)
      .catch(() => setError('Não foi possível carregar as notícias.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  if (error) return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-center text-red-500">{error}</div>
  );

  const [featured, ...rest] = news;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <section className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-1 h-6 bg-brand-600 rounded-full inline-block" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-gray-900">Últimas Notícias</h1>
        </div>
        <p className="text-gray-400 text-sm ml-4">Notícias do G1 processadas com IA — resumos e categorias automáticos</p>
      </section>

      {news.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">Carregando notícias do G1...</p>
          <p className="text-sm">O primeiro fetch pode levar alguns minutos.</p>
        </div>
      ) : (
        <>
          {featured && (
            <section className="mb-8">
              <NewsCard news={featured} large />
            </section>
          )}
          {rest.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1 h-5 bg-slate-300 rounded-full inline-block" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-gray-700">Mais notícias</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map(n => <NewsCard key={n.id} news={n} large />)}
              </div>
            </section>
          )}
        </>
      )}

      <div className="text-center mt-10">
        <Link
          to="/noticias"
          className="inline-block bg-brand-600 text-white font-semibold px-8 py-3 rounded-full hover:bg-brand-700 transition-colors shadow-sm"
        >
          Ver todas as notícias
        </Link>
      </div>
    </div>
  );
}
