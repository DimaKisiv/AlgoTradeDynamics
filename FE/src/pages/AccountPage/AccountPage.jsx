import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { fmtDateTime } from '../../lib/format';
import styles from './AccountPage.module.css';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <main className={styles.account}>
      <div className="container">
        <div className={`${styles.card} glass-strong`}>
          <header className={styles.head}>
            <span className="eyebrow">Обліковий запис</span>
            <h1 className="display-3">Ваш профіль</h1>
          </header>

          <div className={styles.rows}>
            <div className={styles.row}>
              <span className={styles.label}>Email</span>
              <span className={`${styles.value} mono`}>{user?.email}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Збережених backtest-сесій</span>
              <span className={`${styles.value} mono`}>{user?.runs_count ?? 0}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>Акаунт створено</span>
              <span className={`${styles.value} mono`}>
                {user?.created_at ? fmtDateTime(user.created_at) : '—'}
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <Link to="/backtests" className={styles.link}>Мої backtests</Link>
            <button type="button" className={styles.logout} onClick={handleLogout}>
              <LogOut size={16} /> Вийти
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
