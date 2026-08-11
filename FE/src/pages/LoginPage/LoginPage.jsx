import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { t } = useLanguage();
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
      setError(err.detail || err.message || t('login.errorFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.auth}>
      <div className={`${styles.card} glass-strong`}>
        <span className="eyebrow">{t('login.eyebrow')}</span>
        <h1 className={`display-3 ${styles.title}`}>{t('login.title')}</h1>
        <p className="lead">{t('login.lead')}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>{t('login.email')}</span>
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
            <span>{t('login.password')}</span>
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
            {loading ? t('login.submitLoading') : t('login.submit')}
          </button>
        </form>

        <p className={styles.switch}>
          {t('login.noAccount')} <Link to="/register">{t('login.registerLink')}</Link>
        </p>
        <p className={styles.demo}>{t('login.demo')}: demo@algotrade.dev / demo1234</p>
      </div>
    </main>
  );
}
