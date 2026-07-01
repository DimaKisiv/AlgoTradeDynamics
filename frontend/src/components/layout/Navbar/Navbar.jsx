import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Activity } from 'lucide-react';
import styles from './Navbar.module.css';

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
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ''}`}>
      <div className={`${styles.navInner} container`}>
        <Link to="/" className={styles.navBrand} aria-label="AlgoTradeDynamics home">
          <span className={styles.navLogo}>
            <Activity size={18} strokeWidth={2.5} />
          </span>
          <span className={styles.navBrandText}>
            AlgoTrade<span className="text-accent">Dynamics</span>
          </span>
        </Link>

        <div className={styles.navLinks}>
          <NavLink to="/" end className={({ isActive }) => `${styles.navLink} ${isActive ? styles.isActive : ''}`}>
            Огляд
          </NavLink>
          <NavLink to="/app" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.isActive : ''}`}>
            Backtest
          </NavLink>
          <NavLink
            to="/runs"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive || location.pathname.startsWith('/runs/') ? styles.isActive : ''}`
            }
          >
            Історія
          </NavLink>
        </div>

        <div className={styles.navCta}>
          <Link to="/app" className={styles.navCtaBtn}>
            Запустити <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
