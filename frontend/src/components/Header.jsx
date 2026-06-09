import { Link, NavLink } from 'react-router-dom';
import { useAccessibility } from '../context/AccessibilityContext.jsx';

export default function Header() {
  const { openModal } = useAccessibility();

  return (
    <header className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-0 flex items-stretch justify-between">
        <Link
          to="/"
          className="flex items-center gap-0 text-xl font-bold tracking-tight py-4 hover:opacity-80 transition-opacity"
        >
          <span className="text-white">Blog</span>
          <span className="text-brand-400">News</span>
          <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded">
            IA
          </span>
        </Link>

        <nav className="flex gap-1 text-sm font-medium items-center">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `px-3 py-5 border-b-2 transition-colors ${
                isActive
                  ? 'border-brand-400 text-white'
                  : 'border-transparent text-slate-300 hover:text-white hover:border-slate-500'
              }`
            }
          >
            Início
          </NavLink>
          <NavLink
            to="/noticias"
            className={({ isActive }) =>
              `px-3 py-5 border-b-2 transition-colors ${
                isActive
                  ? 'border-brand-400 text-white'
                  : 'border-transparent text-slate-300 hover:text-white hover:border-slate-500'
              }`
            }
          >
            Notícias
          </NavLink>
          <button
            onClick={openModal}
            className="ml-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors text-sm"
            aria-label="Abrir configurações de acessibilidade"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
              <path d="M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"/>
            </svg>
            Acessibilidade
          </button>
        </nav>
      </div>
    </header>
  );
}
