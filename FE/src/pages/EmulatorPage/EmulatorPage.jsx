import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Database,
  Download,
  Gauge,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  SkipForward,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Button from "../../components/ui/Button/Button";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import {
  EventBadge,
  OrderTypeBadge,
  PnlValue,
  RoleBadge,
  SideBadge,
  StatusBadge,
} from "../../components/trading/TradingBadges/TradingBadges";
import { emulatorApi } from "../../api/emulator";
import styles from "./EmulatorPage.module.css";

const TABS = [
  ["manual", "Manual"],
  ["scenario", "Scenario"],
  ["historical", "Historical"],
  ["accounts", "Accounts"],
  ["activity", "Activity"],
];

const fmt = (value, digits = 2) => {
  const number = Number(value || 0);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US", { maximumFractionDigits: digits })
    : "—";
};

const toLocalInput = (timestamp) => {
  if (!timestamp) {return "";}
  const date = new Date(Number(timestamp));
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInput = (value) => new Date(value).getTime();

function Metric({ label, value, suffix = "", tone = "neutral" }) {
  return (
    <div className={`${styles.metric} ${styles[`metric${capitalize(tone)}`] || ""}`}>
      <span>{label}</span>
      <strong>{value}{suffix}</strong>
    </div>
  );
}

function DataTable({ columns, rows, empty = "Немає даних", rowClassName }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className={styles.emptyCell}>{empty}</td></tr>
          ) : rows.map((row, index) => (
            <tr
              key={row.id || row.orderId || row.execId || index}
              className={rowClassName ? rowClassName(row) : ""}
            >
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EmulatorPage() {
  const [tab, setTab] = useState("manual");
  const [accounts, setAccounts] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(1);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [positions, setPositions] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [events, setEvents] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [manualPrice, setManualPrice] = useState("65000");
  const [moveTarget, setMoveTarget] = useState("62000");
  const [moveDuration, setMoveDuration] = useState("10");

  const [scenarioName, setScenarioName] = useState("Custom price path");
  const [scenarioSteps, setScenarioSteps] = useState([
    { price: "65000", duration_seconds: "0" },
    { price: "60000", duration_seconds: "10" },
    { price: "68000", duration_seconds: "15" },
  ]);

  const now = Date.now();
  const [historyFrom, setHistoryFrom] = useState(toLocalInput(now - 7 * 86400000));
  const [historyTo, setHistoryTo] = useState(toLocalInput(now));
  const [historyInterval, setHistoryInterval] = useState("1");
  const [replaySpeed, setReplaySpeed] = useState("100");
  const [pathMode, setPathMode] = useState("ohlc");
  const [csvFile, setCsvFile] = useState(null);

  const [newAccountName, setNewAccountName] = useState("Grid Bot Test");
  const [newAccountBalance, setNewAccountBalance] = useState("10000");
  const [fundAmount, setFundAmount] = useState("1000");

  const selectedAccount = accounts.find((item) => item.id === Number(selectedAccountId));
  const currentMarket = dashboard?.market;

  const runAction = async (action, success) => {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      const result = await action();
      if (success) {setMessage(typeof success === "function" ? success(result) : success);}
      await loadStatic();
      await loadLive();
      return result;
    } catch (e) {
      setError(e.message || "Помилка emulator API");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const loadStatic = useCallback(async () => {
    try {
      const [accountData, marketData, scenarioData, datasetData] = await Promise.all([
        emulatorApi.accounts(),
        emulatorApi.markets(),
        emulatorApi.scenarios(),
        emulatorApi.datasets(),
      ]);
      setAccounts(accountData);
      setMarkets(marketData);
      setScenarios(scenarioData);
      setDatasets(datasetData);
      if (accountData.length && !accountData.some((item) => item.id === Number(selectedAccountId))) {
        setSelectedAccountId(accountData[0].id);
      }
    } catch (e) {
      setError(e.message || "Не вдалося підключитися до emulator service");
    }
  }, [selectedAccountId]);

  const loadLive = useCallback(async () => {
    if (!selectedAccountId || !symbol) {return;}
    try {
      const [dashboardData, ordersData, positionsData, executionsData, eventsData] = await Promise.all([
        emulatorApi.dashboard(selectedAccountId, symbol),
        emulatorApi.orders(selectedAccountId, symbol),
        emulatorApi.positions(selectedAccountId),
        emulatorApi.executions(selectedAccountId, symbol),
        emulatorApi.events(selectedAccountId, symbol),
      ]);
      setDashboard(dashboardData);
      setOrders(ordersData);
      setPositions(positionsData);
      setExecutions(executionsData);
      setEvents(eventsData);
    } catch (e) {
      setError(e.message || "Не вдалося оновити стан біржі");
    }
  }, [selectedAccountId, symbol]);

  useEffect(() => { loadStatic(); }, [loadStatic]);
  useEffect(() => {
    loadLive();
    const timer = window.setInterval(loadLive, 1000);
    return () => window.clearInterval(timer);
  }, [loadLive]);

  const chartData = useMemo(() => {
    const priceEvents = [...events]
      .filter((item) => item.event_type === "market_price" && item.payload?.price)
      .reverse()
      .slice(-80)
      .map((item) => ({
        time: new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        price: Number(item.payload.price),
      }));
    if (currentMarket) {
      priceEvents.push({ time: "Now", price: Number(currentMarket.last_price) });
    }
    return priceEvents;
  }, [events, currentMarket]);

  const setPercent = (percent) => {
    const current = Number(currentMarket?.last_price || manualPrice || 0);
    if (current <= 0) {return;}
    runAction(
      () => emulatorApi.setPrice(symbol, current * (1 + percent / 100)),
      `Ціну змінено на ${percent > 0 ? "+" : ""}${percent}%`,
    );
  };

  const createScenario = () => runAction(
    () => emulatorApi.createScenario({
      name: scenarioName,
      symbol,
      steps: scenarioSteps.map((step) => ({
        price: Number(step.price),
        duration_seconds: Number(step.duration_seconds),
      })),
    }),
    "Сценарій збережено.",
  );

  const downloadHistory = () => runAction(
    () => emulatorApi.downloadHistorical({
      symbol,
      category: "linear",
      interval: historyInterval,
      start_time: fromLocalInput(historyFrom),
      end_time: fromLocalInput(historyTo),
    }),
    (result) => `Завантажено свічок: ${result?.downloaded || 0}, нових: ${result?.inserted || 0}.`,
  );

  const startReplay = () => runAction(
    () => emulatorApi.startReplay(symbol, {
      interval: historyInterval,
      start_time: fromLocalInput(historyFrom),
      end_time: fromLocalInput(historyTo),
      speed: Number(replaySpeed),
      path_mode: pathMode,
    }),
    "Historical replay запущено.",
  );

  const filteredScenarios = scenarios.filter((item) => item.symbol === symbol);
  const filteredDatasets = datasets.filter((item) => item.symbol === symbol);
  const activeOrders = orders.filter((order) => isOpenOrderStatus(order.orderStatus));
  const historicalOrders = orders.filter((order) => !isOpenOrderStatus(order.orderStatus));
  const totalOpenPnl = positions.reduce((sum, item) => sum + numberValue(item.unrealisedPnl), 0);
  const totalClosedPnl = executions.reduce((sum, item) => sum + numberValue(item.closedPnl), 0);

  return (
    <main className={styles.page}>
      <div className="container">
        <header className={styles.hero}>
          <div>
            <span className="eyebrow">Local Exchange Lab</span>
            <h1 className="display-2">Exchange <span className="italic-accent">Emulator</span></h1>
            <p className="lead">Керуйте тестовим ринком, запускайте сценарії та програвайте реальні історичні свічки.</p>
          </div>
          <div className={styles.selectorGroup}>
            <label>
              <span>Account</span>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(Number(e.target.value))}>
                {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>Symbol</span>
              <select value={symbol} onChange={(e) => {
                const nextSymbol = e.target.value;
                setSymbol(nextSymbol);
                const nextMarket = markets.find((item) => item.symbol === nextSymbol);
                if (nextMarket) {
                  setManualPrice(String(nextMarket.last_price));
                  setMoveTarget(String(nextMarket.last_price));
                }
              }}>
                {markets.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}
              </select>
            </label>
            <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => { loadStatic(); loadLive(); }} disabled={busy}>Refresh</Button>
          </div>
        </header>

        {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
        {message && <div className={styles.notice}>{message}</div>}

        <section className={styles.metrics}>
          <Metric label="Market price" value={`$${fmt(currentMarket?.last_price)}`} />
          <Metric label="Wallet balance" value={`$${fmt(dashboard?.account?.balance)}`} />
          <Metric label="Equity" value={`$${fmt(dashboard?.account?.equity)}`} />
          <Metric
            label="Open PnL"
            value={`$${fmt(dashboard?.account?.unrealized_pnl)}`}
            tone={numberValue(dashboard?.account?.unrealized_pnl) > 0 ? "positive" : numberValue(dashboard?.account?.unrealized_pnl) < 0 ? "negative" : "neutral"}
          />
          <Metric label="Open orders" value={dashboard?.open_orders || 0} tone={(dashboard?.open_orders || 0) > 0 ? "open" : "neutral"} />
          <Metric label="Mode" value={`${currentMarket?.mode || "—"} / ${currentMarket?.status || "—"}`} />
        </section>

        <Card className={styles.chartCard}>
          <CardHeader eyebrow={symbol} title="Market movement" action={<span className="pill"><span className="dot" /> {currentMarket?.mode || "manual"}</span>} />
          <div className={styles.chart}>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" minTickGap={40} />
                  <YAxis domain={["auto", "auto"]} width={80} />
                  <Tooltip formatter={(value) => `$${fmt(value, 6)}`} />
                  <Line type="monotone" dataKey="price" stroke="var(--accent)" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className={styles.chartEmpty}>Змініть ціну або запустіть replay — тут з’явиться рух ринку.</div>}
          </div>
        </Card>

        <div className={styles.tabs}>
          {TABS.map(([value, label]) => (
            <button key={value} type="button" className={tab === value ? styles.activeTab : ""} onClick={() => setTab(value)}>{label}</button>
          ))}
        </div>

        {tab === "manual" && (
          <section className={styles.twoColumns}>
            <Card>
              <CardHeader eyebrow="Immediate" title="Встановити ціну" />
              <div className={styles.formStack}>
                <label><span>New price</span><input type="number" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} /></label>
                <Button icon={<Gauge size={16} />} disabled={busy} onClick={() => runAction(() => emulatorApi.setPrice(symbol, Number(manualPrice)), "Ціну встановлено.")}>Set price</Button>
                <div className={styles.quickButtons}>
                  {[-5, -1, 1, 5].map((value) => <button key={value} type="button" onClick={() => setPercent(value)}>{value > 0 ? "+" : ""}{value}%</button>)}
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow="Smooth move" title="Плавний рух" />
              <div className={styles.formStack}>
                <label><span>Target price</span><input type="number" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} /></label>
                <label><span>Duration, seconds</span><input type="number" min="0" value={moveDuration} onChange={(e) => setMoveDuration(e.target.value)} /></label>
                <div className={styles.actionRow}>
                  <Button icon={<Play size={16} />} disabled={busy} onClick={() => runAction(() => emulatorApi.movePrice(symbol, Number(moveTarget), Number(moveDuration)), "Рух ціни запущено.")}>Move</Button>
                  <Button variant="ghost" icon={<Pause size={16} />} onClick={() => runAction(() => emulatorApi.pauseMarket(symbol), "Поставлено на паузу.")}>Pause</Button>
                  <Button variant="ghost" icon={<Square size={16} />} onClick={() => runAction(() => emulatorApi.stopMarket(symbol), "Рух зупинено.")}>Stop</Button>
                </div>
              </div>
            </Card>
          </section>
        )}

        {tab === "scenario" && (
          <section className={styles.twoColumns}>
            <Card>
              <CardHeader eyebrow="Builder" title="Створити сценарій" />
              <div className={styles.formStack}>
                <label><span>Name</span><input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} /></label>
                <div className={styles.steps}>
                  {scenarioSteps.map((step, index) => (
                    <div className={styles.stepRow} key={index}>
                      <span>#{index + 1}</span>
                      <input type="number" placeholder="Price" value={step.price} onChange={(e) => setScenarioSteps((items) => items.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} />
                      <input type="number" min="0" placeholder="Seconds" value={step.duration_seconds} onChange={(e) => setScenarioSteps((items) => items.map((item, i) => i === index ? { ...item, duration_seconds: e.target.value } : item))} />
                      <button type="button" onClick={() => setScenarioSteps((items) => items.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <div className={styles.actionRow}>
                  <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setScenarioSteps((items) => [...items, { price: String(currentMarket?.last_price || 0), duration_seconds: "5" }])}>Step</Button>
                  <Button icon={<Save size={16} />} disabled={busy || scenarioSteps.length === 0} onClick={createScenario}>Save scenario</Button>
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow={symbol} title="Збережені сценарії" />
              <div className={styles.scenarioList}>
                {filteredScenarios.length === 0 && <p className="text-secondary">Для цього активу сценаріїв ще немає.</p>}
                {filteredScenarios.map((scenario) => (
                  <div key={scenario.id} className={styles.scenarioItem}>
                    <div><strong>{scenario.name}</strong><span>{scenario.steps.length} steps</span></div>
                    <div className={styles.actionRow}>
                      <Button icon={<Play size={15} />} onClick={() => runAction(() => emulatorApi.startScenario(scenario.id), "Сценарій запущено.")}>Start</Button>
                      <Button variant="ghost" icon={<SkipForward size={15} />} onClick={() => runAction(() => emulatorApi.stepScenario(symbol), "Виконано один крок.")}>Step</Button>
                      <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => runAction(() => emulatorApi.restartScenario(scenario.id), "Сценарій перезапущено.")}>Restart</Button>
                      <button type="button" className={styles.iconDanger} onClick={() => runAction(() => emulatorApi.deleteScenario(scenario.id), "Сценарій видалено.")}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {tab === "historical" && (
          <section className={styles.twoColumns}>
            <Card>
              <CardHeader eyebrow="Market data" title="Завантажити історію" />
              <div className={styles.formStack}>
                <div className={styles.fieldGrid}>
                  <label><span>From</span><input type="datetime-local" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} /></label>
                  <label><span>To</span><input type="datetime-local" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} /></label>
                </div>
                <label><span>Interval</span><select value={historyInterval} onChange={(e) => setHistoryInterval(e.target.value)}><option value="1">1 minute</option><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="60">1 hour</option><option value="D">1 day</option></select></label>
                <Button icon={<Download size={16} />} disabled={busy} onClick={downloadHistory}>Download from Bybit</Button>
                <div className={styles.importRow}>
                  <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                  <Button variant="ghost" icon={<Upload size={16} />} disabled={!csvFile || busy} onClick={() => runAction(() => emulatorApi.importHistorical(symbol, historyInterval, csvFile), "CSV імпортовано.")}>Import CSV</Button>
                </div>
                <div className={styles.datasetList}>
                  {filteredDatasets.map((item) => (
                    <div key={`${item.exchange}-${item.interval}`}>
                      <Database size={15} />
                      <span>{item.exchange} · {item.interval === "D" ? "1 day" : `${item.interval}m`} · {fmt(item.candles, 0)} candles</span>
                      <small>{new Date(item.from_time).toLocaleDateString()} — {new Date(item.to_time).toLocaleDateString()}</small>
                      <button type="button" onClick={() => {
                        setHistoryInterval(item.interval);
                        setHistoryFrom(toLocalInput(item.from_time));
                        setHistoryTo(toLocalInput(item.to_time));
                      }}>Use</button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow="Replay" title="Програти історію" />
              <div className={styles.formStack}>
                <label><span>Speed, candles/sec</span><select value={replaySpeed} onChange={(e) => setReplaySpeed(e.target.value)}><option value="1">1x</option><option value="10">10x</option><option value="100">100x</option><option value="1000">Maximum</option></select></label>
                <label><span>Intrabar path</span><select value={pathMode} onChange={(e) => setPathMode(e.target.value)}><option value="ohlc">Open → High → Low → Close</option><option value="olhc">Open → Low → High → Close</option><option value="close">Close only</option></select></label>
                <div className={styles.actionRow}>
                  <Button icon={<Play size={16} />} disabled={busy} onClick={startReplay}>Start</Button>
                  <Button variant="ghost" icon={<Pause size={16} />} onClick={() => runAction(() => emulatorApi.pauseMarket(symbol), "Replay paused.")}>Pause</Button>
                  <Button variant="ghost" icon={<Play size={16} />} onClick={() => runAction(() => emulatorApi.resumeMarket(symbol), "Replay resumed.")}>Resume</Button>
                  <Button variant="ghost" icon={<SkipForward size={16} />} onClick={() => runAction(() => emulatorApi.stepReplay(symbol), "Одна свічка програна.")}>Next candle</Button>
                  <Button variant="ghost" icon={<Square size={16} />} onClick={() => runAction(() => emulatorApi.stopMarket(symbol), "Replay stopped.")}>Stop</Button>
                </div>
                {currentMarket?.mode === "historical" && (
                  <div className={styles.progressBox}>
                    <span>Progress</span>
                    <strong>{currentMarket.runtime_state?.processed || 0} / {currentMarket.runtime_state?.total || 0}</strong>
                    <progress value={currentMarket.runtime_state?.processed || 0} max={currentMarket.runtime_state?.total || 1} />
                  </div>
                )}
              </div>
            </Card>
          </section>
        )}

        {tab === "accounts" && (
          <section className={styles.twoColumns}>
            <Card>
              <CardHeader eyebrow="New account" title="Створити тестовий акаунт" />
              <div className={styles.formStack}>
                <label><span>Name</span><input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} /></label>
                <label><span>Initial USDT balance</span><input type="number" value={newAccountBalance} onChange={(e) => setNewAccountBalance(e.target.value)} /></label>
                <Button icon={<Plus size={16} />} onClick={() => runAction(() => emulatorApi.createAccount({ name: newAccountName, initial_balance: Number(newAccountBalance) }), "Акаунт створено.")}>Create account</Button>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow="Selected account" title={selectedAccount?.name || "—"} />
              {selectedAccount && (
                <div className={styles.formStack}>
                  <div className={styles.credential}><span>API key</span><code>{selectedAccount.api_key}</code></div>
                  <label><span>Add/remove funds</span><input type="number" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} /></label>
                  <div className={styles.actionRow}>
                    <Button icon={<Banknote size={16} />} onClick={() => runAction(() => emulatorApi.fundAccount(selectedAccount.id, Number(fundAmount)), "Баланс змінено.")}>Apply</Button>
                    <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => runAction(() => emulatorApi.resetAccount(selectedAccount.id), "Акаунт очищено та скинуто.")}>Reset account</Button>
                  </div>
                  <p className="text-secondary">У формі бота виберіть Environment = Emulator і цей акаунт. API key збережеться в settings бота.</p>
                </div>
              )}
            </Card>
          </section>
        )}

        {tab === "activity" && (
          <section className={styles.activityGrid}>
            <div className={styles.activityOverview}>
              <Metric label="Active orders" value={activeOrders.length} tone={activeOrders.length > 0 ? "open" : "neutral"} />
              <Metric label="Order history" value={historicalOrders.length} />
              <Metric label="Open positions" value={positions.length} tone={positions.length > 0 ? "positive" : "neutral"} />
              <Metric
                label="Open PnL"
                value={`$${fmt(totalOpenPnl)}`}
                tone={totalOpenPnl > 0 ? "positive" : totalOpenPnl < 0 ? "negative" : "neutral"}
              />
              <Metric
                label="Closed PnL"
                value={`$${fmt(totalClosedPnl)}`}
                tone={totalClosedPnl > 0 ? "positive" : totalClosedPnl < 0 ? "negative" : "neutral"}
              />
            </div>

            <div className={styles.activityPrimary}>
              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow="Account"
                  title="Open positions"
                  action={<span className={styles.sectionCount}>{positions.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "symbol", label: "Symbol", render: (row) => <strong className="mono">{row.symbol}</strong> },
                    { key: "side", label: "Side", render: (row) => <SideBadge side={row.side || "Buy"} /> },
                    { key: "size", label: "Size", render: (row) => <span className="mono">{fmt(row.size, 6)}</span> },
                    { key: "avgPrice", label: "Avg entry", render: (row) => <span className="mono">${fmt(row.avgPrice, 4)}</span> },
                    { key: "markPrice", label: "Mark", render: (row) => <span className="mono">${fmt(row.markPrice, 4)}</span> },
                    { key: "unrealisedPnl", label: "Open PnL", render: (row) => <PnlValue value={row.unrealisedPnl}>${fmt(row.unrealisedPnl)}</PnlValue> },
                    { key: "leverage", label: "Lev.", render: (row) => <span className="mono">{fmt(row.leverage)}x</span> },
                  ]}
                  rows={positions}
                  empty="No open position"
                  rowClassName={(row) => numberValue(row.unrealisedPnl) >= 0 ? styles.positiveRow : styles.negativeRow}
                />
              </Card>

              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow="Exchange"
                  title="Active orders"
                  action={<span className={styles.sectionCount}>{activeOrders.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "side", label: "Side", render: (row) => <SideBadge side={row.side} /> },
                    { key: "role", label: "Role", render: (row) => <RoleBadge linkId={row.orderLinkId} /> },
                    { key: "orderType", label: "Type", render: (row) => <OrderTypeBadge type={row.orderType} reduceOnly={row.reduceOnly} /> },
                    { key: "price", label: "Price", render: (row) => <span className="mono">${fmt(row.price, 4)}</span> },
                    { key: "qty", label: "Qty", render: (row) => <span className="mono">{fmt(row.qty, 6)}</span> },
                    { key: "cumExecQty", label: "Filled", render: (row) => <span className="mono">{fmt(row.cumExecQty, 6)}</span> },
                    { key: "orderStatus", label: "Status", render: (row) => <StatusBadge status={row.orderStatus} /> },
                    { key: "orderLinkId", label: "Link ID", render: (row) => <span className={styles.compactId} title={row.orderLinkId}>{shortId(row.orderLinkId)}</span> },
                  ]}
                  rows={activeOrders}
                  empty="No active orders"
                  rowClassName={(row) => row.side === "Buy" ? styles.buyRow : styles.sellRow}
                />
              </Card>
            </div>

            <Card className={styles.activityCard}>
              <CardHeader
                eyebrow="Orders"
                title="Order history"
                action={<span className={styles.sectionCount}>{historicalOrders.length}</span>}
              />
              <DataTable
                columns={[
                  { key: "createdTime", label: "Created", render: (row) => <span className={styles.dateText}>{new Date(Number(row.createdTime)).toLocaleString()}</span> },
                  { key: "side", label: "Side", render: (row) => <SideBadge side={row.side} /> },
                  { key: "role", label: "Role", render: (row) => <RoleBadge linkId={row.orderLinkId} /> },
                  { key: "orderType", label: "Type", render: (row) => <OrderTypeBadge type={row.orderType} reduceOnly={row.reduceOnly} /> },
                  { key: "price", label: "Price", render: (row) => <span className="mono">${fmt(row.price, 4)}</span> },
                  { key: "qty", label: "Qty", render: (row) => <span className="mono">{fmt(row.qty, 6)}</span> },
                  { key: "orderStatus", label: "Status", render: (row) => <StatusBadge status={row.orderStatus} /> },
                  { key: "orderLinkId", label: "Link ID", render: (row) => <span className={styles.compactId} title={row.orderLinkId}>{shortId(row.orderLinkId)}</span> },
                ]}
                rows={historicalOrders}
                empty="No completed or cancelled orders"
                rowClassName={(row) => row.side === "Buy" ? styles.buyRow : styles.sellRow}
              />
            </Card>

            <div className={styles.activitySecondary}>
              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow="Fills"
                  title="Executions"
                  action={<span className={styles.sectionCount}>{executions.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "execTime", label: "Time", render: (row) => <span className={styles.dateText}>{new Date(row.execTime).toLocaleString()}</span> },
                    { key: "side", label: "Side", render: (row) => <SideBadge side={row.side} /> },
                    { key: "execPrice", label: "Price", render: (row) => <span className="mono">${fmt(row.execPrice, 4)}</span> },
                    { key: "execQty", label: "Qty", render: (row) => <span className="mono">{fmt(row.execQty, 6)}</span> },
                    { key: "execFee", label: "Fee", render: (row) => <span className={styles.mutedNumber}>${fmt(row.execFee, 6)}</span> },
                    { key: "closedPnl", label: "Closed PnL", render: (row) => <PnlValue value={row.closedPnl}>${fmt(row.closedPnl)}</PnlValue> },
                  ]}
                  rows={executions}
                />
              </Card>

              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow="Runtime"
                  title="Event log"
                  action={<span className={styles.sectionCount}>{events.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "created_at", label: "Time", render: (row) => <span className={styles.dateText}>{new Date(row.created_at).toLocaleTimeString()}</span> },
                    { key: "event_type", label: "Type", render: (row) => <EventBadge type={row.event_type} /> },
                    { key: "message", label: "Message", render: (row) => <span className={styles.eventMessage}>{row.message}</span> },
                  ]}
                  rows={events.slice(0, 50)}
                />
              </Card>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}


function isOpenOrderStatus(status) {
  return ["new", "created", "partiallyfilled", "pendingnew", "untriggered"].includes(
    String(status || "").toLowerCase(),
  );
}

function numberValue(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function shortId(value) {
  if (!value) return "—";
  const text = String(value);
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-5)}` : text;
}

function capitalize(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}
