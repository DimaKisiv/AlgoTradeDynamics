import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import styles from './RegisterPage.module.css';

export default function RegisterPage() {
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
      setError('Пароль має містити щонайменше 6 символів');
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.detail || err.message || 'Не вдалося зареєструватися');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.auth}>
      <div className={`${styles.card} glass-strong`}>
        <span className="eyebrow">Реєстрація</span>
        <h1 className={`display-3 ${styles.title}`}>Створіть акаунт.</h1>
        <p className="lead">
          Зареєструйтеся, щоб створювати ботів, запускати emulator і зберігати історичні тести.
        </p>

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
              autoComplete="new-password"
              placeholder="мінімум 6 символів"
              minLength={6}
              required
            />
            <span className={styles.hint}>Щонайменше 6 символів.</span>
          </label>

          {error && <div className={styles.error} role="alert">⚠ {error}</div>}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Створення…' : 'Зареєструватися'}
          </button>
        </form>

        <p className={styles.switch}>
          Вже маєте акаунт? <Link to="/login">Увійти</Link>
        </p>
      </div>
    </main>
  );
}
