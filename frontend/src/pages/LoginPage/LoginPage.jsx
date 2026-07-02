import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/app';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.detail || err.message || 'Не вдалося увійти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.auth}>
      <div className={`${styles.card} glass-strong`}>
        <span className="eyebrow">Вхід</span>
        <h1 className={`display-3 ${styles.title}`}>З поверненням.</h1>
        <p className="lead">Увійдіть, щоб працювати з вашими backtest-сесіями.</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <label className={styles.field}>
            <span>Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>

          {error && <div className={styles.error} role="alert">⚠ {error}</div>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Вхід…' : 'Увійти'}
          </button>
        </form>

        <p className={styles.switch}>
          Немає акаунта? <Link to="/register">Зареєструватися</Link>
        </p>
        <p className={styles.demo}>Демо: demo@algotrade.dev / demo1234</p>
      </div>
    </main>
  );
}
