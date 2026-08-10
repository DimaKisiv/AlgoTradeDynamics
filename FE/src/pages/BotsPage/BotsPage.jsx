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
  timeframe: "1",
  lookback_candles: "200",
  minimum_signal_score: "0.85",
  volume_multiplier: "1.5",
  stop_loss_atr: "1.2",
  take_profit_atr: "1.8",
  max_holding_minutes: "30",
  cooldown_minutes: "15",
  risk_per_trade_percent: "0.5",
  max_daily_loss_percent: "2",
  allow_short: true,
  enable_breakout_retest: true,
  enable_flag: true,
  enable_triangle: true,
  enable_double_top_bottom: true,
  enable_liquidity_sweep: true,
  is_active: true,
  emulator_api_key: "emulator-default-key",
  settings: {},
};

const SCALPER_SETTING_KEYS = [
  "timeframe",
  "lookback_candles",
  "minimum_signal_score",
  "volume_multiplier",
  "stop_loss_atr",
  "take_profit_atr",
  "max_holding_minutes",
  "cooldown_minutes",
  "risk_per_trade_percent",
  "max_daily_loss_percent",
  "allow_short",
  "position_sizing",
  "max_position_qty",
  "max_open_orders",
  "pattern_scalper_state",
  "strategy_revision",
  "require_trend_confirmation",
  "require_breakout_confirmation",
  "require_volume_confirmation",
  "breakout_buffer_atr",
  "minimum_body_atr",
  "require_rsi_confirmation",
  "require_retest_confirmation",
  "maximum_breakout_body_atr",
  "minimum_ema_separation_atr",
  "minimum_ema_slope_atr",
  "minimum_breakout_close_location",
  "retest_tolerance_atr",
  "retest_max_penetration_atr",
  "retest_reclaim_atr",
  "minimum_confirmation_body_atr",
  "context_timeframe",
  "context_ema_fast_period",
  "context_ema_slow_period",
  "context_structure_lookback",
  "context_min_ema_separation_atr",
  "context_min_ema_slope_atr",
  "pattern_volume_multiplier",
  "enable_breakout_retest",
  "enable_flag",
  "enable_triangle",
  "enable_double_top_bottom",
  "enable_liquidity_sweep",
  "flag_impulse_lookback",
  "flag_pullback_lookback",
  "flag_min_impulse_atr",
  "flag_max_retrace",
  "triangle_lookback",
  "triangle_min_contraction",
  "double_pattern_lookback",
  "double_pattern_tolerance_atr",
  "double_pattern_min_separation",
  "liquidity_sweep_lookback",
  "liquidity_sweep_penetration_atr",
  "liquidity_sweep_reclaim_atr",
];

const SELECT_OPTIONS = {
  exchange: [{ value: "bybit", label: "Bybit-compatible" }],
  environment: [
    { value: "emulator", label: "Local Emulator" },
    { value: "demo", label: "Bybit Demo" },
    { value: "testnet", label: "Bybit Testnet" },
    { value: "live", label: "Bybit Live" },
  ],
  strategy_type: [
    { value: "grid", label: "Grid Bot" },
    { value: "pattern_scalper", label: "Pattern Scalper" },
  ],
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
    timeframe: String(bot.settings?.timeframe ?? "1"),
    lookback_candles: String(bot.settings?.lookback_candles ?? "200"),
    minimum_signal_score: String(bot.settings?.minimum_signal_score ?? "0.85"),
    volume_multiplier: String(bot.settings?.pattern_volume_multiplier ?? bot.settings?.volume_multiplier ?? "1.5"),
    stop_loss_atr: String(bot.settings?.stop_loss_atr ?? "1.2"),
    take_profit_atr: String(bot.settings?.take_profit_atr ?? "1.8"),
    max_holding_minutes: String(bot.settings?.max_holding_minutes ?? "30"),
    cooldown_minutes: String(bot.settings?.cooldown_minutes ?? "15"),
    risk_per_trade_percent: String(bot.settings?.risk_per_trade_percent ?? "0.5"),
    max_daily_loss_percent: String(bot.settings?.max_daily_loss_percent ?? "2"),
    allow_short: bot.settings?.allow_short ?? true,
    enable_breakout_retest: bot.settings?.enable_breakout_retest ?? true,
    enable_flag: bot.settings?.enable_flag ?? true,
    enable_triangle: bot.settings?.enable_triangle ?? true,
    enable_double_top_bottom: bot.settings?.enable_double_top_bottom ?? true,
    enable_liquidity_sweep: bot.settings?.enable_liquidity_sweep ?? true,
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
  SCALPER_SETTING_KEYS.forEach((key) => delete settings[key]);
  if (form.strategy_type === "pattern_scalper") {
    Object.assign(settings, {
      timeframe: form.timeframe,
      lookback_candles: Number(form.lookback_candles),
      minimum_signal_score: Number(form.minimum_signal_score),
      volume_multiplier: Number(form.volume_multiplier),
      stop_loss_atr: Number(form.stop_loss_atr),
      take_profit_atr: Number(form.take_profit_atr),
      max_holding_minutes: Number(form.max_holding_minutes),
      cooldown_minutes: Number(form.cooldown_minutes),
      risk_per_trade_percent: Number(form.risk_per_trade_percent),
      max_daily_loss_percent: Number(form.max_daily_loss_percent),
      allow_short: form.allow_short,
      position_sizing: "risk_capped",
      max_position_qty: Number(form.order_qty),
      max_open_orders: 1,
      strategy_revision: 4,
      context_timeframe: "5",
      pattern_volume_multiplier: Number(form.volume_multiplier),
      enable_breakout_retest: form.enable_breakout_retest,
      enable_flag: form.enable_flag,
      enable_triangle: form.enable_triangle,
      enable_double_top_bottom: form.enable_double_top_bottom,
      enable_liquidity_sweep: form.enable_liquidity_sweep,
      context_ema_fast_period: 12,
      context_ema_slow_period: 36,
      context_structure_lookback: 12,
      context_min_ema_separation_atr: 0.10,
      context_min_ema_slope_atr: 0.02,
      flag_impulse_lookback: 6,
      flag_pullback_lookback: 5,
      flag_min_impulse_atr: 1.6,
      flag_max_retrace: 0.62,
      triangle_lookback: 12,
      triangle_min_contraction: 0.22,
      double_pattern_lookback: 32,
      double_pattern_tolerance_atr: 0.45,
      double_pattern_min_separation: 5,
      liquidity_sweep_lookback: 20,
      liquidity_sweep_penetration_atr: 0.08,
      liquidity_sweep_reclaim_atr: 0.04,
      // Revision-3 breakout/retest knobs remain for the breakout_retest sub-pattern.
      require_trend_confirmation: false,
      require_breakout_confirmation: true,
      require_volume_confirmation: true,
      require_rsi_confirmation: false,
      require_retest_confirmation: true,
      breakout_buffer_atr: 0.08,
      minimum_body_atr: 0.25,
      maximum_breakout_body_atr: 1.6,
      minimum_ema_separation_atr: 0.08,
      minimum_ema_slope_atr: 0.015,
      minimum_breakout_close_location: 0.65,
      retest_tolerance_atr: 0.25,
      retest_max_penetration_atr: 0.35,
      retest_reclaim_atr: 0.03,
      minimum_confirmation_body_atr: 0.08,
    });
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
    setForm((current) => {
      const next = {
        ...current,
        [name]: type === "checkbox" ? checked : value,
      };
      if (name === "strategy_type" && value === "pattern_scalper") {
        next.category = "linear";
        if (!editingBotId) {
          next.timeframe = "1";
          next.volume_multiplier = "1.5";
        }
      }
      return next;
    });
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
                <p className="text-secondary">Створіть Grid Bot або Pattern Scalper для локального emulator-акаунта.</p>
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
                      {bot.strategy_type === "grid" ? (
                        <>
                          <div><dt>Grid Orders</dt><dd className="mono">{bot.grid_orders_count}</dd></div>
                          <div><dt>Grid Step %</dt><dd className="mono">{bot.grid_step_percent}</dd></div>
                        </>
                      ) : (
                        <>
                          <div><dt>Entry TF</dt><dd className="mono">{bot.settings?.timeframe || "1"}m</dd></div>
                          <div><dt>Context TF</dt><dd className="mono">{bot.settings?.context_timeframe || "5"}m</dd></div>
                          <div><dt>Min Signal</dt><dd className="mono">{Math.round(Number(bot.settings?.minimum_signal_score || 0.85) * 100)}%</dd></div>
                        </>
                      )}
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
                      <select name="category" value={form.category} onChange={handleChange} disabled={form.strategy_type === "pattern_scalper"}>
                        {SELECT_OPTIONS.category.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className={styles.fieldGrid}>
                    <label className={styles.field}><span>Symbol</span><input name="symbol" value={form.symbol} onChange={handleChange} required /></label>
                    <label className={styles.field}><span>Order Qty</span><input name="order_qty" type="number" min="0.000001" step="0.000001" value={form.order_qty} onChange={handleChange} required /></label>
                  </div>

                  {form.strategy_type === "grid" ? (
                    <div className={styles.fieldGrid}>
                      <label className={styles.field}><span>Grid Orders Count</span><input name="grid_orders_count" type="number" min="1" step="1" value={form.grid_orders_count} onChange={handleChange} required /></label>
                      <label className={styles.field}><span>Grid Step %</span><input name="grid_step_percent" type="number" min="0.01" step="0.01" value={form.grid_step_percent} onChange={handleChange} required /></label>
                    </div>
                  ) : (
                    <div className={styles.strategyFields}>
                      <p className={styles.strategyHint}>
                        Revision 4: EMA більше не є сигналом входу. Бот визначає 5m market context, а угоду відкриває лише коли на entry timeframe сформувався ввімкнений price-action pattern і його підтверджують context, volume/RSI та candle structure. Для scalping рекомендовано 1m entry + 5m context.
                      </p>
                      <div className={styles.fieldGrid}>
                        <label className={styles.field}><span>Timeframe</span><select name="timeframe" value={form.timeframe} onChange={handleChange}><option value="1">1m</option><option value="3">3m</option><option value="5">5m</option><option value="15">15m</option><option value="30">30m</option><option value="60">1h</option></select></label>
                        <label className={styles.field}><span>Lookback candles</span><input name="lookback_candles" type="number" min="60" max="1000" step="1" value={form.lookback_candles} onChange={handleChange} required /></label>
                      </div>
                      <div className={styles.fieldGrid}>
                        <label className={styles.field}><span>Minimum signal score</span><input name="minimum_signal_score" type="number" min="0.1" max="1" step="0.05" value={form.minimum_signal_score} onChange={handleChange} required /></label>
                        <label className={styles.field}><span>Volume multiplier</span><input name="volume_multiplier" type="number" min="0.1" step="0.1" value={form.volume_multiplier} onChange={handleChange} required /></label>
                      </div>
                      <div className={styles.fieldGrid}>
                        <label className={styles.field}><span>Stop-loss, ATR</span><input name="stop_loss_atr" type="number" min="0.1" step="0.1" value={form.stop_loss_atr} onChange={handleChange} required /></label>
                        <label className={styles.field}><span>Take-profit, ATR</span><input name="take_profit_atr" type="number" min="0.1" step="0.1" value={form.take_profit_atr} onChange={handleChange} required /></label>
                      </div>
                      <div className={styles.fieldGrid}>
                        <label className={styles.field}><span>Max holding, min</span><input name="max_holding_minutes" type="number" min="1" step="1" value={form.max_holding_minutes} onChange={handleChange} required /></label>
                        <label className={styles.field}><span>Cooldown, min</span><input name="cooldown_minutes" type="number" min="0" step="1" value={form.cooldown_minutes} onChange={handleChange} required /></label>
                      </div>
                      <div className={styles.fieldGrid}>
                        <label className={styles.field}><span>Risk per trade %</span><input name="risk_per_trade_percent" type="number" min="0.01" max="10" step="0.01" value={form.risk_per_trade_percent} onChange={handleChange} required /></label>
                        <label className={styles.field}><span>Daily loss limit %</span><input name="max_daily_loss_percent" type="number" min="0.1" max="100" step="0.1" value={form.max_daily_loss_percent} onChange={handleChange} required /></label>
                      </div>
                      <div className={styles.fieldGrid}>
                        <label className={styles.toggle}><input name="enable_breakout_retest" type="checkbox" checked={form.enable_breakout_retest} onChange={handleChange} /><span>Breakout + Retest</span></label>
                        <label className={styles.toggle}><input name="enable_flag" type="checkbox" checked={form.enable_flag} onChange={handleChange} /><span>Bull / Bear Flag</span></label>
                        <label className={styles.toggle}><input name="enable_triangle" type="checkbox" checked={form.enable_triangle} onChange={handleChange} /><span>Triangle / Compression</span></label>
                        <label className={styles.toggle}><input name="enable_double_top_bottom" type="checkbox" checked={form.enable_double_top_bottom} onChange={handleChange} /><span>Double Top / Bottom</span></label>
                        <label className={styles.toggle}><input name="enable_liquidity_sweep" type="checkbox" checked={form.enable_liquidity_sweep} onChange={handleChange} /><span>Liquidity Sweep</span></label>
                      </div>
                      <label className={styles.toggle}><input name="allow_short" type="checkbox" checked={form.allow_short} onChange={handleChange} /><span>Дозволити SHORT</span></label>
                    </div>
                  )}

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
