import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  X,
} from "lucide-react";

import Button from "../../components/ui/Button/Button";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import {
  createBot,
  deleteBot,
  listBots,
  startBot,
  stopBot,
  updateBot,
} from "../../api/bots";
import { emulatorApi } from "../../api/emulator";
import styles from "./BotsPage.module.css";

const INITIAL_FORM = {
  name: "BTC Emulator Grid Bot",
  exchange: "bybit",
  environment: "emulator",
  strategy_type: "grid",
  category: "linear",
  symbol: "BTCUSDT",
  order_qty: "0.001",
  grid_orders_count: "2",
  grid_step_percent: "5",
  is_active: true,
  emulator_api_key: "emulator-default-key",
  settings: {},
};

const SELECT_OPTIONS = {
  exchange: [{ value: "bybit", label: "Bybit-compatible" }],
  environment: [
    { value: "emulator", label: "Local Emulator" },
    { value: "demo", label: "Bybit Demo" },
    { value: "testnet", label: "Bybit Testnet" },
    { value: "live", label: "Bybit Live" },
  ],
  strategy_type: [{ value: "grid", label: "Grid" }],
  category: [
    { value: "linear", label: "Linear" },
    { value: "spot", label: "Spot" },
    { value: "inverse", label: "Inverse" },
  ],
};

function toFormState(bot) {
  if (!bot) {return { ...INITIAL_FORM };}
  return {
    name: bot.name,
    exchange: bot.exchange,
    environment: bot.environment,
    strategy_type: bot.strategy_type,
    category: bot.category,
    symbol: bot.symbol,
    order_qty: String(bot.order_qty),
    grid_orders_count: String(bot.grid_orders_count),
    grid_step_percent: String(bot.grid_step_percent),
    is_active: Boolean(bot.is_active),
    emulator_api_key: bot.settings?.emulator_api_key || "emulator-default-key",
    settings: bot.settings || {},
  };
}

function toPayload(form) {
  const settings = { ...(form.settings || {}) };
  if (form.environment === "emulator") {
    settings.emulator_api_key = form.emulator_api_key;
  } else {
    delete settings.emulator_api_key;
  }
  return {
    name: form.name.trim(),
    exchange: form.exchange,
    environment: form.environment,
    strategy_type: form.strategy_type,
    category: form.category,
    symbol: form.symbol.trim().toUpperCase(),
    order_qty: Number(form.order_qty),
    grid_orders_count: Number(form.grid_orders_count),
    grid_step_percent: Number(form.grid_step_percent),
    is_active: form.is_active,
    settings,
  };
}

export default function BotsPage() {
  const [bots, setBots] = useState([]);
  const [emulatorAccounts, setEmulatorAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBotId, setActionBotId] = useState(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingBotId, setEditingBotId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ ...INITIAL_FORM });

  const loadBots = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listBots();
      setBots(data);
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося завантажити ботів.");
    } finally {
      setLoading(false);
    }
  };

  const loadEmulatorAccounts = async () => {
    try {
      setEmulatorAccounts(await emulatorApi.accounts());
    } catch {
      setEmulatorAccounts([]);
    }
  };

  useEffect(() => {
    loadBots();
    loadEmulatorAccounts();
  }, []);

  const openCreate = () => {
    const defaultKey = emulatorAccounts[0]?.api_key || "emulator-default-key";
    setEditingBotId(null);
    setForm({ ...INITIAL_FORM, emulator_api_key: defaultKey });
    setFormError("");
    setSuccessMessage("");
    setIsFormOpen(true);
  };

  const openEdit = (bot) => {
    setEditingBotId(bot.id);
    setForm(toFormState(bot));
    setFormError("");
    setSuccessMessage("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditingBotId(null);
    setForm({ ...INITIAL_FORM });
    setFormError("");
    setIsFormOpen(false);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setFormError("");
      setSuccessMessage("");
      const payload = toPayload(form);
      if (editingBotId) {
        await updateBot(editingBotId, payload);
      } else {
        await createBot(payload);
      }
      await loadBots();
      closeForm();
    } catch (e) {
      setFormError(e.detail || e.message || "Не вдалося зберегти бота.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (botId) => {
    if (!window.confirm("Видалити цього бота?")) {return;}
    try {
      setError("");
      setSuccessMessage("");
      await deleteBot(botId);
      await loadBots();
      if (editingBotId === botId) {closeForm();}
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося видалити бота.");
    }
  };

  const handleStart = async (botId) => {
    try {
      setActionBotId(botId);
      setError("");
      const result = await startBot(botId);
      await loadBots();
      const createdCount = result.orders?.length || 0;
      setSuccessMessage(
        createdCount > 0
          ? `Бот запущено. Створено ордерів: ${createdCount}.`
          : result.message || "Цикл бота виконано без створення нових ордерів.",
      );
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося запустити бота.");
    } finally {
      setActionBotId(null);
    }
  };

  const handleStop = async (botId) => {
    try {
      setActionBotId(botId);
      setError("");
      await stopBot(botId);
      await loadBots();
      setSuccessMessage("Бот зупинено.");
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося зупинити бота.");
    } finally {
      setActionBotId(null);
    }
  };

  return (
    <main className={styles.bots}>
      <div className="container">
        <header className={styles.hero}>
          <span className="eyebrow">Bots Control</span>
          <h1 className="display-2">
            Створюйте та керуйте{" "}
            <span className="italic-accent">конфігураціями ботів</span>.
          </h1>
          <p className="lead">
            Бот може працювати з локальним Exchange Emulator, Bybit Demo,
            Testnet або Live. Для безпечних тестів обирайте Local Emulator.
          </p>

          <div className={styles.heroActions}>
            <Button icon={<Plus size={16} />} onClick={openCreate}>
              Створити бота
            </Button>
            <Button
              variant="ghost"
              icon={<RefreshCw size={16} />}
              onClick={() => { loadBots(); loadEmulatorAccounts(); }}
              disabled={loading}
            >
              Оновити список
            </Button>
          </div>
        </header>

        {error && <div className={`${styles.state} ${styles.stateError}`}>{error}</div>}
        {successMessage && <div className={styles.state}>{successMessage}</div>}
        {loading && <div className={styles.state}>Завантаження ботів…</div>}

        <div className={styles.layout}>
          <section className={styles.listSection}>
            {!loading && bots.length === 0 && (
              <Card className={styles.emptyState}>
                <Bot size={28} />
                <h3>Поки що ботів немає</h3>
                <p className="text-secondary">Створіть перший grid-бот для локального emulator-акаунта.</p>
                <Button icon={<Plus size={16} />} onClick={openCreate}>Створити першого бота</Button>
              </Card>
            )}

            {!loading && bots.length > 0 && (
              <div className={styles.botsGrid}>
                {bots.map((bot) => (
                  <Card key={bot.id} className={styles.botCard}>
                    <CardHeader
                      eyebrow={bot.environment}
                      title={bot.name}
                      action={
                        <span className={`${styles.status} ${bot.is_active ? styles.statusActive : styles.statusPaused}`}>
                          {bot.is_active ? "Active" : "Paused"}
                        </span>
                      }
                    />
                    <div className={styles.botMeta}>
                      <span className="pill"><span className="dot" /> {bot.exchange}</span>
                      <span className="pill">{bot.strategy_type}</span>
                      <span className="pill">{bot.category}</span>
                      <span className="pill">Runtime: {bot.runtime_status}</span>
                    </div>
                    <dl className={styles.botSpecs}>
                      <div><dt>Symbol</dt><dd className="mono">{bot.symbol}</dd></div>
                      <div><dt>Order Qty</dt><dd className="mono">{bot.order_qty}</dd></div>
                      <div><dt>Grid Orders</dt><dd className="mono">{bot.grid_orders_count}</dd></div>
                      <div><dt>Grid Step %</dt><dd className="mono">{bot.grid_step_percent}</dd></div>
                      <div><dt>Runtime</dt><dd className="mono">{bot.runtime_status}</dd></div>
                      <div><dt>Enabled</dt><dd className="mono">{bot.is_active ? "Yes" : "No"}</dd></div>
                    </dl>
                    <div className={styles.botActions}>
                      <Button icon={<Play size={16} />} onClick={() => handleStart(bot.id)} loading={actionBotId === bot.id && bot.runtime_status !== "running"} disabled={actionBotId === bot.id}>Start</Button>
                      <Button variant="ghost" icon={<Square size={16} />} onClick={() => handleStop(bot.id)} disabled={actionBotId === bot.id}>Stop</Button>
                      <Button variant="ghost" icon={<PencilLine size={16} />} onClick={() => openEdit(bot)}>Редагувати</Button>
                      <Link to={`/bots/${bot.id}`} className={styles.botLink}>Open</Link>
                      <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => handleDelete(bot.id)}>Видалити</Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <aside className={styles.formSection}>
            <Card className={styles.formCard}>
              <CardHeader
                eyebrow={editingBotId ? "Edit bot" : "New bot"}
                title={editingBotId ? "Оновити конфігурацію" : "Створити конфігурацію"}
                action={isFormOpen ? (
                  <button type="button" className={styles.closeButton} onClick={closeForm} aria-label="Закрити форму"><X size={16} /></button>
                ) : null}
              />

              {!isFormOpen ? (
                <div className={styles.formPlaceholder}>
                  <p className="text-secondary">Оберіть існуючого бота для редагування або створіть нового.</p>
                  <Button icon={<Plus size={16} />} onClick={openCreate}>Відкрити форму</Button>
                </div>
              ) : (
                <form className={styles.form} onSubmit={handleSubmit}>
                  <label className={styles.field}><span>Назва</span><input name="name" value={form.name} onChange={handleChange} required /></label>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Exchange</span>
                      <select name="exchange" value={form.exchange} onChange={handleChange}>
                        {SELECT_OPTIONS.exchange.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Environment</span>
                      <select name="environment" value={form.environment} onChange={handleChange}>
                        {SELECT_OPTIONS.environment.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>

                  {form.environment === "emulator" && (
                    <label className={styles.field}>
                      <span>Emulator account</span>
                      <select name="emulator_api_key" value={form.emulator_api_key} onChange={handleChange}>
                        {emulatorAccounts.length === 0 && <option value="emulator-default-key">Default Emulator Account</option>}
                        {emulatorAccounts.map((account) => (
                          <option key={account.id} value={account.api_key}>{account.name} — ${Number(account.balance).toLocaleString("en-US")}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Strategy</span>
                      <select name="strategy_type" value={form.strategy_type} onChange={handleChange}>
                        {SELECT_OPTIONS.strategy_type.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className={styles.field}>
                      <span>Category</span>
                      <select name="category" value={form.category} onChange={handleChange}>
                        {SELECT_OPTIONS.category.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}><span>Symbol</span><input name="symbol" value={form.symbol} onChange={handleChange} required /></label>
                    <label className={styles.field}><span>Order Qty</span><input name="order_qty" type="number" min="0.000001" step="0.000001" value={form.order_qty} onChange={handleChange} required /></label>
                  </div>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}><span>Grid Orders Count</span><input name="grid_orders_count" type="number" min="1" step="1" value={form.grid_orders_count} onChange={handleChange} required /></label>
                    <label className={styles.field}><span>Grid Step %</span><input name="grid_step_percent" type="number" min="0.01" step="0.01" value={form.grid_step_percent} onChange={handleChange} required /></label>
                  </div>

                  <label className={styles.toggle}><input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} /><span>Бот активний</span></label>

                  {formError && <div className={`${styles.state} ${styles.stateError}`}>{formError}</div>}

                  <div className={styles.formActions}>
                    <Button type="submit" loading={saving}>{editingBotId ? "Зберегти зміни" : "Створити бота"}</Button>
                    <Button type="button" variant="ghost" onClick={closeForm}>Скасувати</Button>
                  </div>
                </form>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </main>
  );
}
