import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
  const { t } = useLanguage();
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError(t('register.shortPassword'));
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.detail || err.message || t('register.errorFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.auth}>
      <div className={`${styles.card} glass-strong`}>
        <span className="eyebrow">{t('register.eyebrow')}</span>
        <h1 className={`display-3 ${styles.title}`}>{t('register.title')}</h1>
        <p className="lead">
          {t('register.lead')}
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>{t('register.email')}</span>
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
            <span>{t('register.password')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t('register.passwordPlaceholder')}
              minLength={6}
              required
            />
            <span className={styles.hint}>{t('register.passwordHint')}</span>
          </label>

          {error && <div className={styles.error} role="alert">⚠ {error}</div>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? t('register.submitLoading') : t('register.submit')}
          </button>
        </form>

        <p className={styles.switch}>
          {t('register.haveAccount')} <Link to="/login">{t('register.loginLink')}</Link>
        </p>
      </div>
    </main>
  );
}
