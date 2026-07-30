import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, Bot, CalendarRange, CirclePlay, Copy, Database, GitCompareArrows, LoaderCircle, Trash2, XCircle } from "lucide-react";

import { backtestsApi } from "../../api/backtests";
import { listBots } from "../../api/bots";
import Button from "../../components/ui/Button/Button";
import { PnlValue, StatusBadge } from "../../components/trading/TradingBadges/TradingBadges";
import { fmtDateTime, fmtMoneySigned, fmtPctSigned } from "../../lib/format";
import styles from "./BacktestsPage.module.css";

const ACTIVE = new Set(["queued", "running", "paused"]);
const toDateInput = (ms) => new Date(ms).toISOString().slice(0, 10);
const startOfDay = (value) => new Date(`${value}T00:00:00Z`).getTime();
const endOfDay = (value) => new Date(`${value}T23:59:59.999Z`).getTime();

function Stat({ label, value, icon }) {
  return <div className={styles.stat}><span>{icon}{label}</span><strong>{value}</strong></div>;
}

export default function BacktestsPage() {
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
    interval: "D",
    from: "2024-01-01",
    to: "2024-12-31",
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
        const matching = datasetData.find((item) => item.symbol === bot.symbol) || datasetData[0];
        return {
          ...current,
          bot_id: String(bot.id),
          interval: matching?.interval || "1",
          from: matching ? toDateInput(matching.from_time) : current.from,
          to: matching ? toDateInput(matching.to_time) : current.to,
        };
      });
      setError("");
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося завантажити backtests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const duplicateId = Number(searchParams.get("duplicate"));
    if (!duplicateId) return;
    backtestsApi.get(duplicateId).then((detail) => {
      setForm({
        bot_id: String(detail.source_bot_id || ""), interval: detail.interval,
        from: toDateInput(detail.start_time), to: toDateInput(detail.end_time),
        initial_balance: String(detail.initial_balance), fee_rate: String(detail.fee_rate),
        slippage_percent: String(detail.slippage_percent), path_mode: detail.path_mode,
        end_behavior: detail.end_behavior, name: `${detail.name} · copy`,
      });
      setShowForm(true);
      setSearchParams({}, { replace: true });
    }).catch((e) => setError(e.detail || e.message));
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    if (!runs.some((run) => ACTIVE.has(run.status))) return undefined;
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, [runs, load]);

  const selectedBot = bots.find((item) => item.id === Number(form.bot_id));
  const botDatasets = useMemo(
    () => datasets.filter((item) => !selectedBot || item.symbol === selectedBot.symbol),
    [datasets, selectedBot],
  );
  const selectedDataset = botDatasets.find((item) => item.interval === form.interval);

  const chooseBot = (botId) => {
    const bot = bots.find((item) => item.id === Number(botId));
    const matching = datasets.find((item) => item.symbol === bot?.symbol) || null;
    setForm((current) => ({
      ...current,
      bot_id: String(botId),
      interval: matching?.interval || current.interval,
      from: matching ? toDateInput(matching.from_time) : current.from,
      to: matching ? toDateInput(matching.to_time) : current.to,
    }));
  };

  const start = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      const run = await backtestsApi.create({
        bot_id: Number(form.bot_id),
        interval: form.interval,
        start_time: startOfDay(form.from),
        end_time: endOfDay(form.to),
        initial_balance: Number(form.initial_balance),
        fee_rate: Number(form.fee_rate),
        slippage_percent: Number(form.slippage_percent),
        path_mode: form.path_mode,
        end_behavior: form.end_behavior,
        name: form.name || null,
      });
      navigate(`/backtests/${run.id}`);
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося запустити backtest");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (run) => {
    if (!window.confirm(`Видалити backtest “${run.name}”?`)) return;
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
        interval: detail.interval,
        from: toDateInput(detail.start_time),
        to: toDateInput(detail.end_time),
        initial_balance: String(detail.initial_balance),
        fee_rate: String(detail.fee_rate),
        slippage_percent: String(detail.slippage_percent),
        path_mode: detail.path_mode,
        end_behavior: detail.end_behavior,
        name: `${detail.name} · copy`,
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
            <span className="eyebrow">Historical Bot Lab</span>
            <h1 className="display-2">Bot <span className="italic-accent">Backtests</span></h1>
            <p className="lead">Той самий grid worker, ті самі ордери та TP — але на ізольованому акаунті й історичних свічках.</p>
          </div>
          <Button icon={<CirclePlay size={17} />} onClick={() => setShowForm((value) => !value)}>
            {showForm ? "Закрити форму" : "New backtest"}
          </Button>
        </header>

        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.stats}>
          <Stat icon={<BarChart3 size={14} />} label="Total runs" value={runs.length} />
          <Stat icon={<CirclePlay size={14} />} label="Running" value={runs.filter((run) => ACTIVE.has(run.status)).length} />
          <Stat icon={<Database size={14} />} label="Datasets" value={datasets.length} />
          <Stat icon={<Bot size={14} />} label="Best return" value={Number.isFinite(best) ? fmtPctSigned(best) : "—"} />
        </section>

        {showForm && (
          <form className={`${styles.form} glass-strong`} onSubmit={start}>
            <div className={styles.formHead}>
              <div><span className="eyebrow">New run</span><h2>Налаштування тесту</h2></div>
              <p>Оригінальний бот та його звичайний emulator account не змінюються.</p>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.wide}><span>Bot</span><select value={form.bot_id} onChange={(e) => chooseBot(e.target.value)} required>
                {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name} · {bot.symbol}</option>)}
              </select></label>
              <label><span>Dataset interval</span><select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}>
                {botDatasets.map((item) => <option key={`${item.exchange}-${item.interval}`} value={item.interval}>{item.symbol} · {item.interval} · {item.candles.toLocaleString()} candles</option>)}
              </select></label>
              <label><span>Starting balance</span><input type="number" min="1" step="100" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} /></label>
              <label><span>From</span><input type="date" value={form.from} min={selectedDataset ? toDateInput(selectedDataset.from_time) : undefined} max={selectedDataset ? toDateInput(selectedDataset.to_time) : undefined} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
              <label><span>To</span><input type="date" value={form.to} min={selectedDataset ? toDateInput(selectedDataset.from_time) : undefined} max={selectedDataset ? toDateInput(selectedDataset.to_time) : undefined} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
              <label><span>Execution path</span><select value={form.path_mode} onChange={(e) => setForm({ ...form, path_mode: e.target.value })}>
                <option value="conservative">Conservative · O→H→L→C</option><option value="ohlc">Open → High → Low → Close</option><option value="olhc">Open → Low → High → Close</option><option value="close">Close only</option>
              </select></label>
              <label><span>End of test</span><select value={form.end_behavior} onChange={(e) => setForm({ ...form, end_behavior: e.target.value })}>
                <option value="keep_open">Keep open position</option><option value="force_close">Force-close at final price</option>
              </select></label>
              <label><span>Fee rate</span><input type="number" min="0" max="0.1" step="0.00001" value={form.fee_rate} onChange={(e) => setForm({ ...form, fee_rate: e.target.value })} /></label>
              <label><span>Market slippage %</span><input type="number" min="0" max="10" step="0.01" value={form.slippage_percent} onChange={(e) => setForm({ ...form, slippage_percent: e.target.value })} /></label>
              <label className={styles.wide}><span>Run name (optional)</span><input value={form.name} placeholder={selectedBot ? `${selectedBot.name} · historical test` : "Backtest name"} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            </div>
            {selectedBot && <div className={styles.snapshot}>
              <span>{selectedBot.symbol}</span><span>{selectedBot.order_qty} qty</span><span>{selectedBot.grid_orders_count} grid levels</span><span>{selectedBot.grid_step_percent}% step</span><span>{selectedBot.settings?.take_profit_percent ?? 1.5}% TP</span>
            </div>}
            {selectedBot && botDatasets.length === 0 && <div className={styles.datasetWarning}>Для {selectedBot.symbol} ще немає історичних даних. <Link to="/emulator">Відкрий Emulator → Historical</Link>, завантаж свічки з Bybit або імпортуй CSV.</div>}
            <div className={styles.formActions}><Button type="submit" loading={busy} disabled={!bots.length || !selectedDataset}>Start backtest</Button></div>
          </form>
        )}

        <section className={styles.listSection}>
          <div className={styles.sectionTitle}><div><span className="eyebrow">Runs</span><h2>Історія тестів</h2></div>{selectedRuns.length >= 2 && <Button variant="ghost" icon={<GitCompareArrows size={16}/>} onClick={() => navigate(`/backtests/compare?ids=${selectedRuns.join(",")}`)}>Compare {selectedRuns.length}</Button>}</div>
          {loading ? <div className={styles.loading}><LoaderCircle className={styles.spin} /> Завантаження…</div> : runs.length === 0 ? (
            <div className={styles.empty}>Ще немає backtest-запусків. Обери існуючого бота й історичний dataset.</div>
          ) : (
            <div className={styles.tableWrap}><table className={styles.table}><thead><tr>
              <th className={styles.selectCell}></th><th>Run</th><th>Period</th><th>Status</th><th>Progress</th><th>Net PnL</th><th>Return</th><th>Drawdown</th><th>Actions</th>
            </tr></thead><tbody>{runs.map((run) => (
              <tr key={run.id}>
                <td className={styles.selectCell}><input type="checkbox" aria-label={`Select ${run.name}`} disabled={run.status !== "completed"} checked={selectedRuns.includes(run.id)} onChange={() => toggleSelected(run.id)} /></td>
                <td><Link className={styles.runName} to={`/backtests/${run.id}`}>{run.name}</Link><small>{run.bot_name} · {run.symbol} · {run.interval}</small></td>
                <td><span className={styles.date}><CalendarRange size={13} />{new Date(run.start_time).toLocaleDateString("uk-UA")} — {new Date(run.end_time).toLocaleDateString("uk-UA")}</span><small>{fmtDateTime(run.created_at)}</small></td>
                <td><StatusBadge status={run.status} />{run.error && <small className={styles.failed}>{run.error}</small>}</td>
                <td><div className={styles.progress}><i style={{ width: `${run.progress || 0}%` }} /></div><small>{Number(run.progress || 0).toFixed(1)}% · {run.processed_candles}/{run.total_candles}</small></td>
                <td><PnlValue value={run.metrics?.net_total_pnl}>{run.metrics?.net_total_pnl == null ? "—" : fmtMoneySigned(run.metrics.net_total_pnl)}</PnlValue></td>
                <td><PnlValue value={run.metrics?.return_percent}>{run.metrics?.return_percent == null ? "—" : fmtPctSigned(run.metrics.return_percent)}</PnlValue></td>
                <td><span className={styles.negative}>{run.metrics?.maximum_drawdown_percent == null ? "—" : fmtPctSigned(run.metrics.maximum_drawdown_percent)}</span></td>
                <td><div className={styles.actions}><Link to={`/backtests/${run.id}`}>Open</Link><button onClick={() => duplicate(run)} title="Duplicate"><Copy size={16} /></button>{ACTIVE.has(run.status) ? <button onClick={() => cancel(run)} title="Cancel"><XCircle size={16} /></button> : <button onClick={() => remove(run)} title="Delete"><Trash2 size={16} /></button>}</div></td>
              </tr>
            ))}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
}
