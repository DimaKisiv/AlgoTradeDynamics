import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, LogOut, UserCircle } from "lucide-react";

import { useAuth } from "../../../context/AuthContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
      <div className={`${styles.navInner} container`}>
        <Link
          to="/"
          className={styles.navBrand}
          aria-label="AlgoTradeDynamics home"
        >
          <span className={styles.navLogo}>
            <Activity size={18} strokeWidth={2.5} />
          </span>
          <span className={styles.navBrandText}>
            AlgoTrade<span className="text-accent">Dynamics</span>
          </span>
        </Link>

        <div className={styles.navLinks}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.isActive : ""}`
            }
          >
            Огляд
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink
                to="/app"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.isActive : ""}`
                }
              >
                Backtest
              </NavLink>
              <NavLink
                to="/bots"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.isActive : ""}`
                }
              >
                Боти
              </NavLink>
              <NavLink
                to="/emulator"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.isActive : ""}`
                }
              >
                Emulator
              </NavLink>
              <NavLink
                to="/runs"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive || location.pathname.startsWith("/runs/") ? styles.isActive : ""}`
                }
              >
                Історія
              </NavLink>
            </>
          )}
        </div>

        <div className={styles.navCta}>
          {isAuthenticated ? (
            <>
              <Link
                to="/account"
                className={styles.navAccount}
                title={user?.email}
              >
                <UserCircle size={16} />
                <span className={styles.navAccountEmail}>{user?.email}</span>
              </Link>
              <button
                type="button"
                className={styles.navLogout}
                onClick={handleLogout}
                aria-label="Вийти"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className={styles.navLogin}>
                Увійти
              </Link>
              <Link to="/register" className={styles.navCtaBtn}>
                Реєстрація <span aria-hidden>→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
