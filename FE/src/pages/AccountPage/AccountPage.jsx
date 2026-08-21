import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Download, ExternalLink, LogOut, Send, ShieldCheck, Trash2, Unplug } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useConfirmModal } from '../../context/ConfirmModalContext';
import {
  createTelegramConnectLink,
  disconnectTelegram,
  fetchTelegramStatus,
  sendTelegramTest,
  updateTelegramPreferences,
} from '../../api/notifications';
import { deleteMyAccount, downloadMyData } from '../../api/privacy';
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
  const { t, tr, locale } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { confirm } = useConfirmModal();
  const [telegram, setTelegram] = useState(defaultTelegram);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState('');
  const [telegramError, setTelegramError] = useState('');
  const pollRef = useRef(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState('');
  const [privacyError, setPrivacyError] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const loadTelegram = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {setTelegramLoading(true);}
    try {
      const data = await fetchTelegramStatus();
      setTelegram(data);
      if (data.connected && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setTelegramMessage(tr('Telegram успішно підключено.', 'Telegram connected successfully.'));
      }
      return data;
    } catch (error) {
      if (!quiet) {setTelegramError(error.detail || error.message || tr('Не вдалося завантажити Telegram settings', 'Failed to load Telegram settings'));}
      return null;
    } finally {
      if (!quiet) {setTelegramLoading(false);}
    }
  }, [tr]);

  useEffect(() => {
    loadTelegram();
    return () => {
      if (pollRef.current) {clearInterval(pollRef.current);}
    };
  }, [loadTelegram]);

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
      setTelegramMessage(tr('У Telegram натисніть Start. Статус тут оновиться автоматично.', 'Press Start in Telegram. The status here will update automatically.'));
      if (pollRef.current) {clearInterval(pollRef.current);}
      pollRef.current = setInterval(() => loadTelegram({ quiet: true }), 2000);
    } catch (error) {
      setTelegramError(error.detail || error.message || tr('Не вдалося створити Telegram link', 'Failed to create Telegram link'));
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
      setTelegramError(error.detail || error.message || tr('Не вдалося зберегти налаштування', 'Failed to save settings'));
    }
  };

  const handleTestTelegram = async () => {
    setTelegramBusy(true);
    setTelegramError('');
    setTelegramMessage('');
    try {
      await sendTelegramTest();
      setTelegramMessage(tr('Тестове повідомлення відправлено в Telegram.', 'Test notification sent to Telegram.'));
    } catch (error) {
      setTelegramError(error.detail || error.message || tr('Не вдалося відправити тест', 'Failed to send test notification'));
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
      setTelegramMessage(tr('Telegram відключено.', 'Telegram disconnected.'));
    } catch (error) {
      setTelegramError(error.detail || error.message || tr('Не вдалося відключити Telegram', 'Failed to disconnect Telegram'));
    } finally {
      setTelegramBusy(false);
    }
  };

  const handleDataExport = async () => {
    setPrivacyBusy(true);
    setPrivacyError('');
    setPrivacyMessage('');
    try {
      await downloadMyData();
      setPrivacyMessage(tr('Експорт ваших даних підготовлено.', 'Your data export has been prepared.'));
    } catch (error) {
      setPrivacyError(error.detail || error.message || tr('Не вдалося експортувати дані', 'Failed to export data'));
    } finally {
      setPrivacyBusy(false);
    }
  };

   const handleDeleteAccount = async () => {
     if (!deletePassword) {
       setPrivacyError(tr('Введіть пароль для підтвердження.', 'Enter your password to confirm.'));
       return;
     }
     const confirmed = await confirm({
       title: tr('Видалити акаунт?', 'Delete account?'),
       message: tr(
         'Видалити акаунт та operational дані? Regulatory audit записи можуть зберігатися до завершення retention period.',
         'Delete the account and operational data? Regulatory audit records may be retained until their retention period ends.',
       ),
       confirmLabel: tr('Видалити акаунт', 'Delete account'),
       cancelLabel: tr('Скасувати', 'Cancel'),
       isDanger: true,
     });
     if (!confirmed) {return;}
     setPrivacyBusy(true);
     setPrivacyError('');
     try {
       await deleteMyAccount(deletePassword);
       await logout();
       navigate('/', { replace: true });
     } catch (error) {
       setPrivacyError(error.detail || error.message || tr('Не вдалося видалити акаунт', 'Failed to delete account'));
     } finally {
       setPrivacyBusy(false);
     }
   };

  return (
    <main className={styles.account}>
      <div className="container">
        <div className={styles.stack}>
          <div className={`${styles.card} glass-strong`}>
            <header className={styles.head}>
              <span className="eyebrow">{t('account.eyebrow')}</span>
              <h1 className="display-3">{t('account.title')}</h1>
            </header>

            <div className={styles.rows}>
              <div className={styles.row}>
                <span className={styles.label}>{t('account.email')}</span>
                <span className={`${styles.value} mono`}>{user?.email}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>{t('account.savedBacktests')}</span>
                <span className={`${styles.value} mono`}>{user?.runs_count ?? 0}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>{t('account.createdAt')}</span>
                <span className={`${styles.value} mono`}>
                  {user?.created_at ? fmtDateTime(user.created_at, locale) : '—'}
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <Link to="/backtests" className={styles.link}>{t('account.myBacktests')}</Link>
              <button type="button" className={styles.logout} onClick={handleLogout}>
                <LogOut size={16} /> {t('account.logout')}
              </button>
            </div>
          </div>

          <section className={`${styles.card} glass-strong`}>
            <header className={styles.telegramHead}>
              <div>
                <span className="eyebrow">{tr('Сповіщення', 'Notifications')}</span>
                <h2 className={styles.sectionTitle}><Bell size={21} /> Telegram</h2>
              </div>
              {!telegramLoading && telegram.connected && (
                <span className={styles.connectedBadge}><CheckCircle2 size={14} /> {tr('Підключено', 'Connected')}</span>
              )}
            </header>

            {telegramLoading ? (
              <p className={styles.muted}>{tr('Завантаження…', 'Loading…')}</p>
            ) : !telegram.configured ? (
              <div className={styles.notice}>
                {tr('Telegram bot ще не налаштований на backend. Додайте TELEGRAM_BOT_TOKEN і TELEGRAM_BOT_USERNAME в environment.', 'Telegram bot is not configured on the backend yet. Add TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME to the environment.')}
              </div>
            ) : !telegram.connected ? (
              <div className={styles.telegramConnect}>
                <p className={styles.muted}>
                  {tr('Підключіть Telegram, щоб отримувати події торгових ботів без відкритої AlgoTradeDynamics.', 'Connect Telegram to receive trading-bot events without keeping AlgoTradeDynamics open.')}
                </p>
                <button type="button" className={styles.primaryAction} onClick={handleConnectTelegram} disabled={telegramBusy}>
                  <ExternalLink size={16} /> {tr('Підключити Telegram', 'Connect Telegram')}
                </button>
              </div>
            ) : (
              <>
                <div className={styles.rows}>
                  <div className={styles.row}>
                    <span className={styles.label}>Telegram</span>
                    <span className={`${styles.value} mono`}>{telegram.username ? `@${telegram.username}` : tr('Підключений чат', 'Connected chat')}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.label}>{tr('Підключено', 'Connected')}</span>
                    <span className={`${styles.value} mono`}>{telegram.connected_at ? fmtDateTime(telegram.connected_at, locale) : '—'}</span>
                  </div>
                </div>

                <div className={styles.preferences}>
                  <label className={styles.switchRow}>
                    <span><strong>{tr('Сповіщення увімкнено', 'Notifications enabled')}</strong><small>{tr('Головний перемикач Telegram сповіщень', 'Master switch for Telegram notifications')}</small></span>
                    <input type="checkbox" checked={telegram.enabled} onChange={(e) => handlePreference('enabled', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>{tr('Угоди', 'Trades')}</strong><small>{tr('Входи, виходи, fills, TP та закриття позиції', 'Entries, exits, fills, TP, and position closes')}</small></span>
                    <input type="checkbox" checked={telegram.notify_trades} onChange={(e) => handlePreference('notify_trades', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>{tr('Статус бота', 'Bot status')}</strong><small>{tr('Старт та зупинка торгового бота', 'Trading bot start and stop')}</small></span>
                    <input type="checkbox" checked={telegram.notify_bot_status} onChange={(e) => handlePreference('notify_bot_status', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>{tr('Risk-попередження', 'Risk warnings')}</strong><small>{tr('Блокування дії risk guard-ом', 'Actions blocked by the risk guard')}</small></span>
                    <input type="checkbox" checked={telegram.notify_risk} onChange={(e) => handlePreference('notify_risk', e.target.checked)} />
                  </label>
                  <label className={styles.switchRow}>
                    <span><strong>{tr('Помилки', 'Errors')}</strong><small>{tr('Помилки runtime та rejected orders', 'Runtime errors and rejected orders')}</small></span>
                    <input type="checkbox" checked={telegram.notify_errors} onChange={(e) => handlePreference('notify_errors', e.target.checked)} />
                  </label>
                </div>

                <div className={styles.actions}>
                  <button type="button" className={styles.primaryAction} onClick={handleTestTelegram} disabled={telegramBusy}>
                    <Send size={16} /> {tr('Тестове сповіщення', 'Test notification')}
                  </button>
                  <button type="button" className={styles.disconnect} onClick={handleDisconnectTelegram} disabled={telegramBusy}>
                    <Unplug size={16} /> {tr('Відключити', 'Disconnect')}
                  </button>
                </div>
              </>
            )}

            {telegramMessage && <div className={styles.successMessage}>{telegramMessage}</div>}
            {telegramError && <div className={styles.errorMessage}>{telegramError}</div>}
          </section>

          <section className={`${styles.card} glass-strong`}>
            <header className={styles.telegramHead}>
              <div>
                <span className="eyebrow">GDPR / Privacy</span>
                <h2 className={styles.sectionTitle}><ShieldCheck size={21} /> {tr('Ваші дані', 'Your data')}</h2>
              </div>
            </header>
            <p className={styles.muted}>{tr(
              'Ви можете завантажити дані, пов’язані з вашим акаунтом. При видаленні профіль, боти, backtests, sessions та preferences видаляються; immutable regulatory audit може зберігатися згідно retention policy.',
              'You can download data related to your account. On deletion, the profile, bots, backtests, sessions, and preferences are removed; immutable regulatory audit records may be retained under the retention policy.',
            )}</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primaryAction} onClick={handleDataExport} disabled={privacyBusy}>
                <Download size={16} /> {tr('Завантажити мої дані', 'Download my data')}
              </button>
            </div>
            <div className={styles.deleteZone}>
              <div><strong>{tr('Видалення акаунта', 'Account deletion')}</strong><small>{tr('Потрібен ваш пароль. Дія незворотна для operational data.', 'Your password is required. Operational-data deletion is irreversible.')}</small></div>
              <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder={tr('Поточний пароль', 'Current password')} autoComplete="current-password" />
              <button type="button" className={styles.disconnect} onClick={handleDeleteAccount} disabled={privacyBusy}>
                <Trash2 size={16} /> {tr('Видалити акаунт', 'Delete account')}
              </button>
            </div>
            {privacyMessage && <div className={styles.successMessage}>{privacyMessage}</div>}
            {privacyError && <div className={styles.errorMessage}>{privacyError}</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
