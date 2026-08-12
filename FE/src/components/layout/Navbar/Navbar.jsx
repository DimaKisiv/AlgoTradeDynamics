import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Activity, LogOut, UserCircle } from "lucide-react";

import { useAuth } from "../../../context/AuthContext";
import { useLanguage } from "../../../context/LanguageContext";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { language, setLanguage, t, tr } = useLanguage();

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
      <header className={styles.header}>
        <nav className={`${styles.nav} ${scrolled ? styles.navScrolled : ""}`}>
          <div className={`${styles.navInner} container`}>
            <Link
                to="/"
                className={styles.navBrand}
                aria-label={t("navbar.homeAria")}
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
                {t("navbar.home")}
              </NavLink>
              {isAuthenticated && (
                  <>
                    <NavLink to="/bots" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.isActive : ""}`}>
                      {t("navbar.bots")}
                    </NavLink>
                    <NavLink to="/backtests" className={({ isActive }) => `${styles.navLink} ${isActive || location.pathname.startsWith("/backtests/") ? styles.isActive : ""}`}>
                      {t("navbar.backtests")}
                    </NavLink>
                    <NavLink to="/emulator" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.isActive : ""}`}>
                      {t("navbar.emulator")}
                    </NavLink>
                    <NavLink to="/compliance/audit" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.isActive : ""}`}>
                      {tr("Комплаєнс", "Compliance")}
                    </NavLink>
                  </>
              )}
            </div>

            <div className={styles.navCta}>
              <div className={styles.langSwitch} role="group" aria-label={tr("Перемикач мови", "Language switch")}>
                <button
                    type="button"
                    className={`${styles.langButton} ${language === "uk" ? styles.langButtonActive : ""}`}
                    onClick={() => setLanguage("uk")}
                >
                  UA
                </button>
                <button
                    type="button"
                    className={`${styles.langButton} ${language === "en" ? styles.langButtonActive : ""}`}
                    onClick={() => setLanguage("en")}
                >
                  EN
                </button>
              </div>
              {isAuthenticated ? (
                  <>
                    <Link
                        to="/account"
                        className={styles.navAccount}
                        title={user?.email}
                        aria-label={t("navbar.accountAria")}
                    >
                      <UserCircle size={16} />
                      <span className={styles.navAccountEmail}>{user?.email}</span>
                    </Link>
                    <button
                        type="button"
                        className={styles.navLogout}
                        onClick={handleLogout}
                        aria-label={t("navbar.logoutAria")}
                    >
                      <LogOut size={16} />
                    </button>
                  </>
              ) : (
                  <>
                    <Link to="/login" className={styles.navLogin}>
                      {t("navbar.login")}
                    </Link>
                    <Link to="/register" className={styles.navCtaBtn}>
                      {t("navbar.register")} <span aria-hidden>→</span>
                    </Link>
                  </>
              )}
            </div>
          </div>
        </nav>
      </header>
  );
}
