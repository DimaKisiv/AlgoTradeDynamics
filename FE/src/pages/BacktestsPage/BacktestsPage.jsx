import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, Bot, CalendarRange, CirclePlay, Copy, Database, GitCompareArrows, LoaderCircle, Trash2, XCircle } from "lucide-react";

import { backtestsApi } from "../../api/backtests";
import { listBots } from "../../api/bots";
import Button from "../../components/ui/Button/Button";
import { PnlValue, StatusBadge } from "../../components/trading/TradingBadges/TradingBadges";
import { fmtDateTime, fmtMoneySigned, fmtPctSigned } from "../../lib/format";
import { useLanguage } from "../../context/LanguageContext";
import styles from "./BacktestsPage.module.css";

const ACTIVE = new Set(["queued", "running", "paused"]);
const toDateTimeInput = (timestamp) => {
  const date = new Date(Number(timestamp));
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const fromDateTimeInput = (value) => new Date(value).getTime();
const INTERVAL_LABELS = {
  en: { "1": "1 minute", "3": "3 minutes", "5": "5 minutes", "15": "15 minutes", "30": "30 minutes", "60": "1 hour", "120": "2 hours", "240": "4 hours", "360": "6 hours", "720": "12 hours", D: "1 day", W: "1 week" },
  uk: { "1": "1 хвилина", "3": "3 хвилини", "5": "5 хвилин", "15": "15 хвилин", "30": "30 хвилин", "60": "1 година", "120": "2 години", "240": "4 години", "360": "6 годин", "720": "12 годин", D: "1 день", W: "1 тиждень" },
};

function Stat({ label, value, icon }) {
  return <div className={styles.stat}><span>{icon}{label}</span><strong>{value}</strong></div>;
}

export default function BacktestsPage() {
  const { tr, language, locale } = useLanguage();
  const intervalLabel = (interval) => INTERVAL_LABELS[language]?.[String(interval)] || String(interval);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState([]);
  const [bots, setBots] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedRuns, setSelectedRuns] = useState([]);
  const [form, setForm] = useState({
    bot_id: "",
    dataset_id: "",
    from: "2024-01-01T00:00",
    to: "2024-12-31T23:59",
    initial_balance: "10000",
    fee_rate: "0.0002",
    slippage_percent: "0",
    path_mode: "conservative",
    end_behavior: "keep_open",
    name: "",
  });

  const load = useCallback(async () => {
    try {
      const [runData, botData, datasetData] = await Promise.all([
        backtestsApi.list(), listBots(), backtestsApi.datasets(),
      ]);
      setRuns(runData);
      setBots(botData);
      setDatasets(datasetData);
      setForm((current) => {
        if (current.bot_id || !botData.length) return current;
        const bot = botData[0];
        const matching = datasetData.find((item) => item.symbol === bot.symbol && item.category === bot.category) || null;
        return {
          ...current,
          bot_id: String(bot.id),
          dataset_id: matching ? String(matching.id) : "",
          from: matching ? toDateTimeInput(matching.from_time) : current.from,
          to: matching ? toDateTimeInput(matching.to_time) : current.to,
        };
      });
      setError("");
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося завантажити backtests', 'Failed to load backtests'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const duplicateId = Number(searchParams.get("duplicate"));
    if (!duplicateId) return;
    backtestsApi.get(duplicateId).then((detail) => {
      setForm({
        bot_id: String(detail.source_bot_id || ""), dataset_id: String(detail.dataset_id || detail.configuration?.dataset?.id || ""),
        from: toDateTimeInput(detail.start_time), to: toDateTimeInput(detail.end_time),
        initial_balance: String(detail.initial_balance), fee_rate: String(detail.fee_rate),
        slippage_percent: String(detail.slippage_percent), path_mode: detail.path_mode,
        end_behavior: detail.end_behavior, name: `${detail.name} · ${tr('копія', 'copy')}`,
      });
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }).catch((e) => setError(e.detail || e.message));
  }, [searchParams, setSearchParams, tr]);
  useEffect(() => {
    if (!runs.some((run) => ACTIVE.has(run.status))) return undefined;
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, [runs, load]);

  const selectedBot = bots.find((item) => item.id === Number(form.bot_id));
  const botDatasets = useMemo(
    () => datasets.filter((item) => !selectedBot || (item.symbol === selectedBot.symbol && item.category === selectedBot.category)),
    [datasets, selectedBot],
  );
  const selectedDataset = botDatasets.find((item) => item.id === Number(form.dataset_id)) || null;

  const chooseBot = (botId) => {
    const bot = bots.find((item) => item.id === Number(botId));
    const matching = datasets.find((item) => item.symbol === bot?.symbol && item.category === bot?.category) || null;
    setForm((current) => ({
      ...current,
      bot_id: String(botId),
      dataset_id: matching ? String(matching.id) : "",
      from: matching ? toDateTimeInput(matching.from_time) : current.from,
      to: matching ? toDateTimeInput(matching.to_time) : current.to,
    }));
  };

  const chooseDataset = (datasetId) => {
    const dataset = botDatasets.find((item) => item.id === Number(datasetId));
    setForm((current) => ({
      ...current,
      dataset_id: String(datasetId),
      from: dataset ? toDateTimeInput(dataset.from_time) : current.from,
      to: dataset ? toDateTimeInput(dataset.to_time) : current.to,
    }));
  };

  const start = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      const run = await backtestsApi.create({
        bot_id: Number(form.bot_id),
        dataset_id: Number(form.dataset_id),
        start_time: fromDateTimeInput(form.from),
        end_time: fromDateTimeInput(form.to),
        initial_balance: Number(form.initial_balance),
        fee_rate: Number(form.fee_rate),
        slippage_percent: Number(form.slippage_percent),
        path_mode: form.path_mode,
        end_behavior: form.end_behavior,
        name: form.name || null,
      });
      navigate(`/backtests/${run.id}`);
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося запустити backtest', 'Failed to start backtest'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (run) => {
    if (!window.confirm(`${tr('Видалити backtest', 'Delete backtest')} “${run.name}”?`)) return;
    try { await backtestsApi.remove(run.id); await load(); }
    catch (e) { setError(e.detail || e.message); }
  };

  const cancel = async (run) => {
    try { await backtestsApi.cancel(run.id); await load(); }
    catch (e) { setError(e.detail || e.message); }
  };
  const duplicate = async (summary) => {
    try {
      const detail = await backtestsApi.get(summary.id);
      setForm({
        bot_id: String(detail.source_bot_id || ""),
        dataset_id: String(detail.dataset_id || detail.configuration?.dataset?.id || ""),
        from: toDateTimeInput(detail.start_time),
        to: toDateTimeInput(detail.end_time),
        initial_balance: String(detail.initial_balance),
        fee_rate: String(detail.fee_rate),
        slippage_percent: String(detail.slippage_percent),
        path_mode: detail.path_mode,
        end_behavior: detail.end_behavior,
        name: `${detail.name} · ${tr('копія', 'copy')}`,
      });
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e.detail || e.message); }
  };

  const toggleSelected = (runId) => {
    setSelectedRuns((current) => current.includes(runId)
      ? current.filter((item) => item !== runId)
      : [...current, runId].slice(-5));
  };


  const completed = runs.filter((run) => run.status === "completed");
  const best = completed.reduce((value, run) => Math.max(value, Number(run.metrics?.return_percent || -Infinity)), -Infinity);

  return (
    <main className={styles.page}>
      <div className="container">
        <header className={styles.hero}>
          <div>
            <span className="eyebrow">{tr('Історична лабораторія ботів', 'Historical Bot Lab')}</span>
            <h1 className="display-2">{tr('Бектести', 'Bot')} <span className="italic-accent">{tr('ботів', 'Backtests')}</span></h1>
            <p className="lead">{tr('Запускайте Grid Bot, DCA Bot або Pattern Scalper на конкретному ізольованому OHLCV dataset без змішування джерел і періодів.', 'Run Grid Bot, DCA Bot, or Pattern Scalper against a specific isolated OHLCV dataset without mixing sources or periods.')}</p>
          </div>
          <Button icon={<CirclePlay size={17} />} onClick={() => setShowForm((value) => !value)}>
            {showForm ? tr('Закрити форму', 'Close form') : tr('Новий backtest', 'New backtest')}
          </Button>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.stats}>
          <Stat icon={<BarChart3 size={14} />} label={tr('Всього запусків', 'Total runs')} value={runs.length} />
          <Stat icon={<CirclePlay size={14} />} label={tr('Запущено', 'Running')} value={runs.filter((run) => ACTIVE.has(run.status)).length} />
          <Stat icon={<Database size={14} />} label={tr('Datasets', 'Datasets')} value={datasets.length} />
          <Stat icon={<Bot size={14} />} label={tr('Найкраща дохідність', 'Best return')} value={Number.isFinite(best) ? fmtPctSigned(best) : "—"} />
        </section>

        {showForm && (
          <form className={`${styles.form} glass-strong`} onSubmit={start}>
            <div className={styles.formHead}>
              <div><span className="eyebrow">{tr('Новий запуск', 'New run')}</span><h2>{tr('Налаштування тесту', 'Test configuration')}</h2></div>
              <p>{tr('Оригінальний бот та його звичайний emulator account не змінюються.', 'The original bot and its regular emulator account remain unchanged.')}</p>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.wide}><span>{tr('Бот', 'Bot')}</span><select value={form.bot_id} onChange={(e) => chooseBot(e.target.value)} required>
                {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name} · {bot.symbol}</option>)}
              </select></label>
              <label className={styles.wide}><span>{tr('Історичний dataset', 'Historical dataset')}</span><select value={form.dataset_id} onChange={(e) => chooseDataset(e.target.value)} required>
                <option value="" disabled>{tr('Оберіть dataset', 'Choose dataset')}</option>
                {botDatasets.map((item) => <option key={item.id} value={item.id}>{item.name} · {intervalLabel(item.interval)} · {item.candles.toLocaleString(locale)} {tr('свічок', 'candles')}</option>)}
              </select></label>
              <label><span>{tr('Початковий баланс', 'Starting balance')}</span><input type="number" min="0.01" step="0.01" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} /></label>
              <label><span>{tr('Від', 'From')}</span><input type="datetime-local" step="60" value={form.from} min={selectedDataset ? toDateTimeInput(selectedDataset.from_time) : undefined} max={selectedDataset ? toDateTimeInput(selectedDataset.to_time) : undefined} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
              <label><span>{tr('До', 'To')}</span><input type="datetime-local" step="60" value={form.to} min={selectedDataset ? toDateTimeInput(selectedDataset.from_time) : undefined} max={selectedDataset ? toDateTimeInput(selectedDataset.to_time) : undefined} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
              <label><span>{tr('Шлях виконання', 'Execution path')}</span><select value={form.path_mode} onChange={(e) => setForm({ ...form, path_mode: e.target.value })}>
                <option value="conservative">{tr('Консервативний · O→H→L→C', 'Conservative · O→H→L→C')}</option><option value="ohlc">{tr('Open → High → Low → Close', 'Open → High → Low → Close')}</option><option value="olhc">{tr('Open → Low → High → Close', 'Open → Low → High → Close')}</option><option value="close">{tr('Тільки Close', 'Close only')}</option>
              </select></label>
              <label><span>{tr('Кінець тесту', 'End of test')}</span><select value={form.end_behavior} onChange={(e) => setForm({ ...form, end_behavior: e.target.value })}>
                <option value="keep_open">{tr('Залишити позицію відкритою', 'Keep open position')}</option><option value="force_close">{tr('Примусово закрити за фінальною ціною', 'Force-close at final price')}</option>
              </select></label>
              <label><span>{tr('Комісія', 'Fee rate')}</span><input type="number" min="0" max="0.1" step="0.00001" value={form.fee_rate} onChange={(e) => setForm({ ...form, fee_rate: e.target.value })} /></label>
              <label><span>{tr('Прослизання ринку %', 'Market slippage %')}</span><input type="number" min="0" max="10" step="0.01" value={form.slippage_percent} onChange={(e) => setForm({ ...form, slippage_percent: e.target.value })} /></label>
              <label className={styles.wide}><span>{tr('Назва запуску (необов’язково)', 'Run name (optional)')}</span><input value={form.name} placeholder={selectedBot ? `${selectedBot.name} · ${tr('історичний тест', 'historical test')}` : tr('Назва backtest', 'Backtest name')} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            </div>
            {selectedBot && <div className={styles.snapshot}>
              <span>{selectedBot.strategy_type === "pattern_scalper" ? "Pattern Scalper" : selectedBot.strategy_type === "dca" ? "DCA Bot" : "Grid Bot"}</span>
              <span>{selectedBot.symbol}</span>
              <span>{selectedBot.order_qty} {tr('кількість', 'qty')}</span>
              {selectedBot.strategy_type === "grid" ? <>
                <span>{selectedBot.grid_orders_count} {tr('рівнів сітки', 'grid levels')}</span><span>{selectedBot.grid_step_percent}% {tr('крок', 'step')}</span>
              </> : selectedBot.strategy_type === "dca" ? <>
                <span>{selectedBot.grid_orders_count} {tr('страхувальних', 'safety orders')}</span><span>{selectedBot.grid_step_percent}% {tr('перший крок', 'first step')}</span>
              </> : <>
                <span>{selectedBot.settings?.timeframe || selectedDataset?.interval || "—"} {tr('таймфрейм', 'timeframe')}</span>
                <span>{selectedBot.settings?.risk_per_trade_percent ?? 0.5}% {tr('ризик', 'risk')}</span>
              </>}
              <span>{selectedBot.settings?.take_profit_percent ?? selectedBot.settings?.take_profit_atr ?? 1.5} TP</span>
            </div>}
            {selectedDataset && <div className={`${styles.datasetCard} ${selectedDataset.missing_candles ? styles.datasetBad : styles.datasetGood}`}>
              <div><strong>{selectedDataset.name}</strong><span>{selectedDataset.symbol} · {intervalLabel(selectedDataset.interval)} · {selectedDataset.exchange}</span></div>
              <div><span>{new Date(selectedDataset.from_time).toLocaleDateString(locale)} — {new Date(selectedDataset.to_time).toLocaleDateString(locale)}</span><span>{selectedDataset.candles.toLocaleString(locale)} {tr('свічок', 'candles')} · {selectedDataset.quality?.has_volume ? tr('volume доступний', 'volume available') : tr('без volume', 'no volume')}</span></div>
              <b>{selectedDataset.missing_candles ? `${selectedDataset.missing_candles} ${tr('пропущених свічок', 'missing candles')}` : tr('Повний dataset', 'Complete dataset')}</b>
            </div>}
            {selectedBot && botDatasets.length === 0 && <div className={styles.datasetWarning}>{tr('Для', 'There is no historical data for')} {selectedBot.symbol} {tr('ще немає історичних даних.', 'yet.')} <Link to="/emulator">{tr('Відкрий Emulator → Historical', 'Open Emulator → Historical')}</Link>, {tr('завантаж свічки з Bybit або імпортуй CSV.', 'download candles from Bybit or import a CSV.')}</div>}
            <div className={styles.formActions}><Button type="submit" loading={busy} disabled={!bots.length || !selectedDataset}>{tr('Запустити backtest', 'Start backtest')}</Button></div>
          </form>
        )}

        <section className={styles.listSection}>
          <div className={styles.sectionTitle}><div><span className="eyebrow">{tr('Запуски', 'Runs')}</span><h2>{tr('Історія тестів', 'Test history')}</h2></div>{selectedRuns.length >= 2 && <Button variant="ghost" icon={<GitCompareArrows size={16}/>} onClick={() => navigate(`/backtests/compare?ids=${selectedRuns.join(",")}`)}>{tr('Порівняти', 'Compare')} {selectedRuns.length}</Button>}</div>
          {loading ? <div className={styles.loading}><LoaderCircle className={styles.spin} /> {tr('Завантаження…', 'Loading…')}</div> : runs.length === 0 ? (
            <div className={styles.empty}>{tr('Ще немає backtest-запусків. Обери існуючого бота й історичний dataset.', 'There are no backtest runs yet. Choose an existing bot and a historical dataset.')}</div>
          ) : (
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr>
              <th className={styles.selectCell}></th><th>{tr('Запуск', 'Run')}</th><th>{tr('Період', 'Period')}</th><th>{tr('Статус', 'Status')}</th><th>{tr('Прогрес', 'Progress')}</th><th>{tr('Чистий PnL', 'Net PnL')}</th><th>{tr('Дохідність', 'Return')}</th><th>{tr('Просадка', 'Drawdown')}</th><th>{tr('Дії', 'Actions')}</th>
            </tr></thead><tbody>{runs.map((run) => (
              <tr key={run.id}>
                <td className={styles.selectCell}><input type="checkbox" aria-label={`${tr('Вибрати', 'Select')} ${run.name}`} disabled={run.status !== "completed"} checked={selectedRuns.includes(run.id)} onChange={() => toggleSelected(run.id)} /></td>
                <td><Link className={styles.runName} to={`/backtests/${run.id}`}>{run.name}</Link><small>{run.bot_name} · {run.symbol} · {intervalLabel(run.interval)} · {run.dataset_name || `Dataset #${run.dataset_id || "legacy"}` }</small></td>
                <td><span className={styles.date}><CalendarRange size={13} />{new Date(run.start_time).toLocaleString(locale)} — {new Date(run.end_time).toLocaleString(locale)}</span><small>{fmtDateTime(run.created_at, locale)}</small></td>
                <td><StatusBadge status={run.status} />{run.error && <small className={styles.failed}>{run.error}</small>}</td>
                <td><div className={styles.progress}><i style={{ width: `${run.progress || 0}%` }} /></div><small>{Number(run.progress || 0).toFixed(1)}% · {run.processed_candles}/{run.total_candles}</small></td>
                <td><PnlValue value={run.metrics?.net_total_pnl}>{run.metrics?.net_total_pnl == null ? "—" : fmtMoneySigned(run.metrics.net_total_pnl)}</PnlValue></td>
                <td><PnlValue value={run.metrics?.return_percent}>{run.metrics?.return_percent == null ? "—" : fmtPctSigned(run.metrics.return_percent)}</PnlValue></td>
                <td><span className={styles.negative}>{run.metrics?.maximum_drawdown_percent == null ? "—" : fmtPctSigned(run.metrics.maximum_drawdown_percent)}</span></td>
                <td><div className={styles.actions}><Link to={`/backtests/${run.id}`}>{tr('Відкрити', 'Open')}</Link><button onClick={() => duplicate(run)} title={tr('Дублювати', 'Duplicate')}><Copy size={16} /></button>{ACTIVE.has(run.status) ? <button onClick={() => cancel(run)} title={tr('Скасувати', 'Cancel')}><XCircle size={16} /></button> : <button onClick={() => remove(run)} title={tr('Видалити', 'Delete')}><Trash2 size={16} /></button>}</div></td>
              </tr>
            ))}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
}
