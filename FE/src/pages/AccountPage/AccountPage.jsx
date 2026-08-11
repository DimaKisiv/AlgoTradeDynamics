import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, ExternalLink, LogOut, Send, Unplug } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import {
  createTelegramConnectLink,
  disconnectTelegram,
  fetchTelegramStatus,
  sendTelegramTest,
  updateTelegramPreferences,
} from '../../api/notifications';
import { fmtDateTime } from '../../lib/format';
import styles from './AccountPage.module.css';
import {useLanguage} from "../../context/LanguageContext.jsx";

const defaultTelegram = {
  configured: false,
  connected: false,
  enabled: false,
  username: null,
  connected_at: null,
  notify_trades: true,
  notify_bot_status: true,
  notify_errors: true,
  notify_risk: true,
};

export default function AccountPage() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [telegram, setTelegram] = useState(defaultTelegram);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState('');
  const [telegramError, setTelegramError] = useState('');
  const pollRef = useRef(null);

  const loadTelegram = async ({ quiet = false } = {}) => {
    if (!quiet) setTelegramLoading(true);
    try {
      const data = await fetchTelegramStatus();
      setTelegram(data);
      if (data.connected && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setTelegramMessage('Telegram успішно підключено.');
      }
      return data;
    } catch (error) {
      if (!quiet) setTelegramError(error.detail || error.message || 'Не вдалося завантажити Telegram settings');
      return null;
    } finally {
      if (!quiet) setTelegramLoading(false);
    }
  };

  useEffect(() => {
    loadTelegram();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const handleConnectTelegram = async () => {
    setTelegramBusy(true);
    setTelegramError('');
    setTelegramMessage('');
    try {
      const data = await createTelegramConnectLink();
      window.open(data.connect_url, '_blank', 'noopener,noreferrer');
      setTelegramMessage('У Telegram натисніть Start. Статус тут оновиться автоматично.');
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => loadTelegram({ quiet: true }), 2000);
    } catch (error) {
      setTelegramError(error.detail || error.message || 'Не вдалося створити Telegram link');
    } finally {
      setTelegramBusy(false);
    }
  };

  const handlePreference = async (key, checked) => {
    const previous = telegram;
    setTelegram((current) => ({ ...current, [key]: checked }));
    setTelegramError('');
    try {
      const data = await updateTelegramPreferences({ [key]: checked });
      setTelegram(data);
    } catch (error) {
      setTelegram(previous);
      setTelegramError(error.detail || error.message || 'Не вдалося зберегти налаштування');
    }
  };

  const handleTestTelegram = async () => {
    setTelegramBusy(true);
    setTelegramError('');
    setTelegramMessage('');
    try {
      await sendTelegramTest();
      setTelegramMessage('Тестове повідомлення відправлено в Telegram.');
    } catch (error) {
      setTelegramError(error.detail || error.message || 'Не вдалося відправити тест');
    } finally {
      setTelegramBusy(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    setTelegramBusy(true);
    setTelegramError('');
    try {
      await disconnectTelegram();
      setTelegram(defaultTelegram);
      await loadTelegram({ quiet: true });
      setTelegramMessage('Telegram відключено.');
    } catch (error) {
      setTelegramError(error.detail || error.message || 'Не вдалося відключити Telegram');
    } finally {
      setTelegramBusy(false);
    }
  };

  return (
    <main className={styles.account}>
      <div className="container">
        <div className={styles.stack}>
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

          <section className={`${styles.card} glass-strong`}>
            <header className={styles.telegramHead}>
              <div>
                <span className="eyebrow">Notifications</span>
                <h2 className={styles.sectionTitle}><Bell size={21} /> Telegram</h2>
              </div>
              {!telegramLoading && telegram.connected && (
                <span className={styles.connectedBadge}><CheckCircle2 size={14} /> Connected</span>
              )}
            </header>

            {telegramLoading ? (
              <p className={styles.muted}>Завантаження…</p>
            ) : !telegram.configured ? (
              <div className={styles.notice}>
                Telegram bot ще не налаштований на backend. Додайте TELEGRAM_BOT_TOKEN і TELEGRAM_BOT_USERNAME в environment.
              </div>
            ) : !telegram.connected ? (
              <div className={styles.telegramConnect}>
                <p className={styles.muted}>
                  Підключіть Telegram, щоб отримувати події торгових ботів без відкритої AlgoTradeDynamics.
                </p>
                <button type="button" className={styles.primaryAction} onClick={handleConnectTelegram} disabled={telegramBusy}>
                  <ExternalLink size={16} /> Connect Telegram
                </button>
              </div>
            ) : (
              <>
                <div className={styles.rows}>
                  <div className={styles.row}>
                    <span className={styles.label}>Telegram</span>
                    <span className={`${styles.value} mono`}>{telegram.username ? `@${telegram.username}` : 'Connected chat'}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>Підключено</span>
                    <span className={`${styles.value} mono`}>{telegram.connected_at ? fmtDateTime(telegram.connected_at) : '—'}</span>
                  </div>
                </div>

                <div className={styles.preferences}>
                  <label className={styles.switchRow}>
                    <span><strong>Notifications enabled</strong><small>Головний перемикач Telegram сповіщень</small></span>
                    <input type="checkbox" checked={telegram.enabled} onChange={(e) => handlePreference('enabled', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>Trades</strong><small>Входи, виходи, fills, TP та закриття позиції</small></span>
                    <input type="checkbox" checked={telegram.notify_trades} onChange={(e) => handlePreference('notify_trades', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>Bot status</strong><small>Старт та зупинка торгового бота</small></span>
                    <input type="checkbox" checked={telegram.notify_bot_status} onChange={(e) => handlePreference('notify_bot_status', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>Risk warnings</strong><small>Блокування дії risk guard-ом</small></span>
                    <input type="checkbox" checked={telegram.notify_risk} onChange={(e) => handlePreference('notify_risk', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>Errors</strong><small>Помилки runtime та rejected orders</small></span>
                    <input type="checkbox" checked={telegram.notify_errors} onChange={(e) => handlePreference('notify_errors', e.target.checked)} />
                  </label>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.primaryAction} onClick={handleTestTelegram} disabled={telegramBusy}>
                    <Send size={16} /> Test notification
                  </button>
                  <button type="button" className={styles.disconnect} onClick={handleDisconnectTelegram} disabled={telegramBusy}>
                    <Unplug size={16} /> Disconnect
                  </button>
                </div>
              </>
            )}

            {telegramMessage && <div className={styles.successMessage}>{telegramMessage}</div>}
            {telegramError && <div className={styles.errorMessage}>{telegramError}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
