import { Link } from 'react-router-dom';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

export default function Footer() {
  const { openModal } = useAccessibility();

  return (
    <footer className="bg-slate-900 text-slate-400 text-sm mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <span className="text-white font-semibold text-base">
              Blog<span className="text-brand-400">News</span>
            </span>
            <p className="text-xs text-slate-500">Notícias do G1 processadas com inteligência artificial</p>
          </div>
          <nav className="flex gap-4 text-xs items-center">
            <Link to="/" className="hover:text-white transition-colors">Início</Link>
            <Link to="/noticias" className="hover:text-white transition-colors">Notícias</Link>
            <button
              onClick={openModal}
              className="hover:text-white transition-colors"
            >
              Acessibilidade
            </button>
          </nav>
        </div>
        <div className="border-t border-slate-800 mt-6 pt-4 text-center text-xs text-slate-600">
          © {new Date().getFullYear()} BlogNews — Conteúdo de terceiros exibido com fins informativos
        </div>
      </div>
    </footer>
  );
}
