import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="nav__inner container">
        <Link to="/" className="nav__brand" aria-label="AlgoTradeDynamics home">
          <span className="nav__logo">
            <Activity size={18} strokeWidth={2.5} />
          </span>
          <span className="nav__brand-text">
            AlgoTrade<span className="text-accent">Dynamics</span>
          </span>
        </Link>

        <div className="nav__links">
          <NavLink to="/" end className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}>
            Огляд
          </NavLink>
          <NavLink to="/app" className={({ isActive }) => `nav__link ${isActive ? 'is-active' : ''}`}>
            Backtest
          </NavLink>
          <NavLink
            to="/runs"
            className={({ isActive }) =>
              `nav__link ${isActive || location.pathname.startsWith('/runs/') ? 'is-active' : ''}`
            }
          >
            Історія
          </NavLink>
        </div>

        <div className="nav__cta">
          <Link to="/app" className="nav__cta-btn">
            Запустити <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
