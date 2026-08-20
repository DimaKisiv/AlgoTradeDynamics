import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import ConnectionStatus from "../../components/ui/ConnectionStatus/ConnectionStatus";
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
import { useLanguage } from "../../context/LanguageContext";
import { useConfirmModal } from "../../context/ConfirmModalContext";
import { useAuthenticatedWebSocket } from "../../websocket/useAuthenticatedWebSocket";
import styles from "./EmulatorPage.module.css";

const TABS = ["manual", "scenario", "historical", "accounts", "activity"];

const toLocalInput = (timestamp) => {
  if (!timestamp) {return "";}
  const date = new Date(Number(timestamp));
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInput = (value) => new Date(value).getTime();
const INTERVAL_LABELS = {
  en: { "1": "1 minute", "3": "3 minutes", "5": "5 minutes", "15": "15 minutes", "30": "30 minutes", "60": "1 hour", "120": "2 hours", "240": "4 hours", "360": "6 hours", "720": "12 hours", D: "1 day", W: "1 week" },
  uk: { "1": "1 хвилина", "3": "3 хвилини", "5": "5 хвилин", "15": "15 хвилин", "30": "30 хвилин", "60": "1 година", "120": "2 години", "240": "4 години", "360": "6 годин", "720": "12 годин", D: "1 день", W: "1 тиждень" },
};

function Metric({ label, value, suffix = "", tone = "neutral" }) {
  return (
    <div className={`${styles.metric} ${styles[`metric${capitalize(tone)}`] || ""}`}>
      <span>{label}</span>
      <strong>{value}{suffix}</strong>
    </div>
  );
}

function DataTable({ columns, rows, empty, rowClassName }) {
  const { tr } = useLanguage();
  const emptyText = empty || tr('Немає даних', 'No data');
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className={styles.emptyCell}>{emptyText}</td></tr>
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
  const { tr, language, locale } = useLanguage();
  const { confirm } = useConfirmModal();
  const fmt = (value, digits = 2) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toLocaleString(locale, { maximumFractionDigits: digits }) : '—';
  };
  const intervalLabel = (interval) => INTERVAL_LABELS[language]?.[String(interval)] || String(interval);
  const tabLabel = (value) => ({
    manual: tr('Ручний', 'Manual'), scenario: tr('Сценарій', 'Scenario'), historical: tr('Історичний', 'Historical'),
    accounts: tr('Акаунти', 'Accounts'), activity: tr('Активність', 'Activity'),
  }[value] || value);
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
  const [streamSources, setStreamSources] = useState({ public: "reconnecting", private: "reconnecting" });
  const liveRefreshTimerRef = useRef(null);

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
  const [historySymbol, setHistorySymbol] = useState("BTCUSDT");
  const [historyName, setHistoryName] = useState("");
  const [selectedDatasetId, setSelectedDatasetId] = useState("");
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
      setError(e.message || tr('Помилка emulator API', 'Emulator API error'));
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
      setError(e.message || tr('Не вдалося підключитися до emulator service', 'Failed to connect to emulator service'));
    }
  }, [selectedAccountId, tr]);

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
      setError(e.message || tr('Не вдалося оновити стан біржі', 'Failed to refresh exchange state'));
    }
  }, [selectedAccountId, symbol, tr]);

  const socketStatus = useAuthenticatedWebSocket(
    `/ws/emulator?account_id=${selectedAccountId}&symbol=${encodeURIComponent(symbol)}`,
    {
      enabled: Boolean(selectedAccountId && symbol),
      onMessage: (event) => {
        if (event.type === "emulator.stream_status") {
          setStreamSources((current) => ({ ...current, [event.source]: event.status }));
          return;
        }
        if (event.type === "emulator.error") {
          setError(event.message || tr('WebSocket emulator недоступний.', 'Emulator WebSocket is unavailable.'));
          return;
        }
        if (event.type !== "emulator.event" || !event.data) return;

        const streamEvent = event.data;
        if (streamEvent.topic === `tickers.${symbol}` && streamEvent.data) {
          const lastPrice = Number(streamEvent.data.lastPrice);
          const markPrice = Number(streamEvent.data.markPrice);
          setDashboard((current) => current ? {
            ...current,
            market: {
              ...current.market,
              last_price: Number.isFinite(lastPrice) ? lastPrice : current.market?.last_price,
              mark_price: Number.isFinite(markPrice) ? markPrice : current.market?.mark_price,
            },
          } : current);
          setMarkets((items) => items.map((item) => item.symbol === symbol ? {
            ...item,
            last_price: Number.isFinite(lastPrice) ? lastPrice : item.last_price,
            mark_price: Number.isFinite(markPrice) ? markPrice : item.mark_price,
          } : item));
        }

        if (!liveRefreshTimerRef.current) {
          liveRefreshTimerRef.current = window.setTimeout(() => {
            liveRefreshTimerRef.current = null;
            loadLive();
          }, 150);
        }
      },
    },
  );

  const connectionStatus = socketStatus === "offline"
    ? "offline"
    : socketStatus === "live" && streamSources.public === "live" && streamSources.private === "live"
      ? "live"
      : "reconnecting";

  useEffect(() => { loadStatic(); }, [loadStatic]);
  useEffect(() => { loadLive(); }, [loadLive]);
  useEffect(() => {
    setStreamSources({ public: "reconnecting", private: "reconnecting" });
  }, [selectedAccountId, symbol]);
  useEffect(() => () => {
    if (liveRefreshTimerRef.current) window.clearTimeout(liveRefreshTimerRef.current);
  }, []);

  const chartData = useMemo(() => {
    const priceEvents = [...events]
      .filter((item) => item.event_type === "market_price" && item.payload?.price)
      .reverse()
      .slice(-80)
      .map((item) => ({
        time: new Date(item.created_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        price: Number(item.payload.price),
      }));
    if (currentMarket) {
      priceEvents.push({ time: tr('Зараз', 'Now'), price: Number(currentMarket.last_price) });
    }
    return priceEvents;
  }, [events, currentMarket, locale, tr]);

  const setPercent = (percent) => {
    const current = Number(currentMarket?.last_price || manualPrice || 0);
    if (current <= 0) {return;}
    runAction(
      () => emulatorApi.setPrice(symbol, current * (1 + percent / 100)),
      `${tr('Ціну змінено на', 'Price changed by')} ${percent > 0 ? '+' : ''}${percent}%`,
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
    tr('Сценарій збережено.', 'Scenario saved.'),
  );

  const downloadHistory = async () => {
    const result = await runAction(
      () => emulatorApi.downloadHistorical({
        name: historyName.trim() || null,
        symbol: historySymbol.trim().toUpperCase(),
        category: "linear",
        interval: historyInterval,
        start_time: fromLocalInput(historyFrom),
        end_time: fromLocalInput(historyTo),
      }),
      (value) => `${tr('Створено dataset', 'Dataset created')} “${value?.dataset?.name || 'Historical dataset'}”: ${value?.inserted || 0} ${tr('свічок', 'candles')}.`,
    );
    if (result?.dataset?.id) {
      setSelectedDatasetId(String(result.dataset.id));
      setHistorySymbol(result.dataset.symbol);
      setSymbol(result.dataset.symbol);
    }
  };

  const importHistory = async () => {
    if (!csvFile) return;
    const result = await runAction(
      () => emulatorApi.importHistorical(historySymbol.trim().toUpperCase(), historyInterval, csvFile, historyName),
      (value) => `CSV dataset “${value?.dataset?.name || csvFile.name}” ${tr('імпортовано', 'imported')}: ${value?.inserted || 0} ${tr('свічок', 'candles')}.`,
    );
    if (result?.dataset?.id) {
      setSelectedDatasetId(String(result.dataset.id));
      setHistorySymbol(result.dataset.symbol);
      setSymbol(result.dataset.symbol);
    }
  };

  const startReplay = () => runAction(
    () => emulatorApi.startReplay(selectedDataset?.symbol || historySymbol.trim().toUpperCase(), {
      dataset_id: Number(selectedDatasetId),
      start_time: fromLocalInput(historyFrom),
      end_time: fromLocalInput(historyTo),
      speed: Number(replaySpeed),
      path_mode: pathMode,
    }),
    tr('Historical replay запущено.', 'Historical replay started.'),
  );

  const filteredScenarios = scenarios.filter((item) => item.symbol === symbol);
  const normalizedHistorySymbol = historySymbol.trim().toUpperCase();
  const filteredDatasets = useMemo(
    () => datasets.filter((item) => item.symbol === normalizedHistorySymbol),
    [datasets, normalizedHistorySymbol],
  );
  const selectedDataset = filteredDatasets.find((item) => item.id === Number(selectedDatasetId)) || null;

  useEffect(() => {
    if (filteredDatasets.some((item) => item.id === Number(selectedDatasetId))) return;
    const first = filteredDatasets[0];
    setSelectedDatasetId(first ? String(first.id) : "");
  }, [filteredDatasets, selectedDatasetId]);

  const useDataset = (item) => {
    setSelectedDatasetId(String(item.id));
    setHistorySymbol(item.symbol);
    setSymbol(item.symbol);
    setHistoryInterval(item.interval);
    setHistoryFrom(toLocalInput(item.from_time));
    setHistoryTo(toLocalInput(item.to_time));
  };
  const activeOrders = orders.filter((order) => isOpenOrderStatus(order.orderStatus));
  const historicalOrders = orders.filter((order) => !isOpenOrderStatus(order.orderStatus));
  const totalOpenPnl = positions.reduce((sum, item) => sum + numberValue(item.unrealisedPnl), 0);
  const totalClosedPnl = executions.reduce((sum, item) => sum + numberValue(item.closedPnl), 0);

  return (
    <main className={styles.page}>
      <div className="container">
        <header className={styles.hero}>
          <div>
            <span className="eyebrow">{tr('Локальна біржова лабораторія', 'Local Exchange Lab')}</span>
            <h1 className="display-2">{tr('Біржовий', 'Exchange')} <span className="italic-accent">Emulator</span></h1>
            <p className="lead">{tr('Керуйте тестовим ринком, запускайте сценарії та програвайте реальні історичні свічки.', 'Control the test market, run scenarios, and replay real historical candles.')}</p>
          </div>
          <div className={styles.selectorGroup}>
            <label>
              <span>{tr('Акаунт', 'Account')}</span>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(Number(e.target.value))}>
                {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>{tr('Символ', 'Symbol')}</span>
              <select value={symbol} onChange={(e) => {
                const nextSymbol = e.target.value;
                setSymbol(nextSymbol);
                setHistorySymbol(nextSymbol);
                const nextMarket = markets.find((item) => item.symbol === nextSymbol);
                if (nextMarket) {
                  setManualPrice(String(nextMarket.last_price));
                  setMoveTarget(String(nextMarket.last_price));
                }
              }}>
                {markets.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol}</option>)}
              </select>
            </label>
            <ConnectionStatus status={connectionStatus} tr={tr} />
            <Button variant="ghost" icon={<RefreshCw size={16} />} onClick={() => { loadStatic(); loadLive(); }} disabled={busy}>{tr('Оновити', 'Refresh')}</Button>
          </div>
        </header>

        {error && <div className={`${styles.notice} ${styles.error}`}>{error}</div>}
        {message && <div className={styles.notice}>{message}</div>}

        <section className={styles.metrics}>
          <Metric label={tr('Ціна ринку', 'Market price')} value={`$${fmt(currentMarket?.last_price)}`} />
          <Metric label={tr('Баланс гаманця', 'Wallet balance')} value={`$${fmt(dashboard?.account?.balance)}`} />
          <Metric label={tr('Equity', 'Equity')} value={`$${fmt(dashboard?.account?.equity)}`} />
          <Metric
            label={tr('Відкритий PnL', 'Open PnL')}
            value={`$${fmt(dashboard?.account?.unrealized_pnl)}`}
            tone={numberValue(dashboard?.account?.unrealized_pnl) > 0 ? "positive" : numberValue(dashboard?.account?.unrealized_pnl) < 0 ? "negative" : "neutral"}
          />
          <Metric label={tr('Відкриті ордери', 'Open orders')} value={dashboard?.open_orders || 0} tone={(dashboard?.open_orders || 0) > 0 ? "open" : "neutral"} />
          <Metric label={tr('Режим', 'Mode')} value={`${currentMarket?.mode || "—"} / ${currentMarket?.status || "—"}`} />
        </section>

        <Card className={styles.chartCard}>
          <CardHeader eyebrow={symbol} title={tr('Рух ринку', 'Market movement')} action={<span className="pill"><span className="dot" /> {currentMarket?.mode || "manual"}</span>} />
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
            ) : <div className={styles.chartEmpty}>{tr('Змініть ціну або запустіть replay — тут з’явиться рух ринку.', 'Change the price or start replay — market movement will appear here.')}</div>}
          </div>
        </Card>

        <div className={styles.tabs}>
          {TABS.map((value) => (
            <button key={value} type="button" className={tab === value ? styles.activeTab : ""} onClick={() => setTab(value)}>{tabLabel(value)}</button>
          ))}
        </div>

        {tab === "manual" && (
          <section className={styles.twoColumns}>
            <Card>
              <CardHeader eyebrow={tr('Негайно', 'Immediate')} title={tr('Встановити ціну', 'Set price')} />
              <div className={styles.formStack}>
                <label><span>{tr('Нова ціна', 'New price')}</span><input type="number" min="0.01" step="0.01" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} /></label>
                <Button icon={<Gauge size={16} />} disabled={busy} onClick={() => runAction(() => emulatorApi.setPrice(symbol, Number(manualPrice)), tr('Ціну встановлено.', 'Price set.'))}>{tr('Встановити ціну', 'Set price')}</Button>
                <div className={styles.quickButtons}>
                  {[-5, -1, 1, 5].map((value) => <button key={value} type="button" onClick={() => setPercent(value)}>{value > 0 ? "+" : ""}{value}%</button>)}
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow={tr('Плавний рух', 'Smooth move')} title={tr('Плавний рух', 'Smooth move')} />
              <div className={styles.formStack}>
                <label><span>{tr('Цільова ціна', 'Target price')}</span><input type="number" min="0.01" step="0.01" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)} /></label>
                <label><span>{tr('Тривалість, секунди', 'Duration, seconds')}</span><input type="number" min="0" step="1" value={moveDuration} onChange={(e) => setMoveDuration(e.target.value)} /></label>
                <div className={styles.actionRow}>
                  <Button icon={<Play size={16} />} disabled={busy} onClick={() => runAction(() => emulatorApi.movePrice(symbol, Number(moveTarget), Number(moveDuration)), tr('Рух ціни запущено.', 'Price move started.'))}>{tr('Рух', 'Move')}</Button>
                  <Button variant="ghost" icon={<Pause size={16} />} onClick={() => runAction(() => emulatorApi.pauseMarket(symbol), tr('Поставлено на паузу.', 'Paused.'))}>{tr('Пауза', 'Pause')}</Button>
                  <Button variant="ghost" icon={<Square size={16} />} onClick={() => runAction(() => emulatorApi.stopMarket(symbol), tr('Рух зупинено.', 'Price move stopped.'))}>{tr('Стоп', 'Stop')}</Button>
                </div>
              </div>
            </Card>
          </section>
        )}

        {tab === "scenario" && (
          <section className={styles.twoColumns}>
            <Card>
              <CardHeader eyebrow={tr('Конструктор', 'Builder')} title={tr('Створити сценарій', 'Create scenario')} />
              <div className={styles.formStack}>
                <label><span>{tr('Назва', 'Name')}</span><input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} /></label>
                <div className={styles.steps}>
                  {scenarioSteps.map((step, index) => (
                    <div className={styles.stepRow} key={index}>
                      <span>#{index + 1}</span>
                      <input type="number" min="0.01" step="0.01" placeholder={tr('Ціна', 'Price')} value={step.price} onChange={(e) => setScenarioSteps((items) => items.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} />
                      <input type="number" min="0" step="1" placeholder={tr('Секунди', 'Seconds')} value={step.duration_seconds} onChange={(e) => setScenarioSteps((items) => items.map((item, i) => i === index ? { ...item, duration_seconds: e.target.value } : item))} />
                      <button type="button" onClick={() => setScenarioSteps((items) => items.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <div className={styles.actionRow}>
                  <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setScenarioSteps((items) => [...items, { price: String(currentMarket?.last_price || 0), duration_seconds: "5" }])}>{tr('Крок', 'Step')}</Button>
                  <Button icon={<Save size={16} />} disabled={busy || scenarioSteps.length === 0} onClick={createScenario}>{tr('Зберегти сценарій', 'Save scenario')}</Button>
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow={symbol} title={tr('Збережені сценарії', 'Saved scenarios')} />
              <div className={styles.scenarioList}>
                {filteredScenarios.length === 0 && <p className="text-secondary">{tr('Для цього активу сценаріїв ще немає.', 'There are no scenarios for this asset yet.')}</p>}
                {filteredScenarios.map((scenario) => (
                  <div key={scenario.id} className={styles.scenarioItem}>
                    <div><strong>{scenario.name}</strong><span>{scenario.steps.length} {tr('кроків', 'steps')}</span></div>
                    <div className={styles.actionRow}>
                      <Button icon={<Play size={15} />} onClick={() => runAction(() => emulatorApi.startScenario(scenario.id), tr('Сценарій запущено.', 'Scenario started.'))}>{tr('Старт', 'Start')}</Button>
                      <Button variant="ghost" icon={<SkipForward size={15} />} onClick={() => runAction(() => emulatorApi.stepScenario(symbol), tr('Виконано один крок.', 'One step executed.'))}>{tr('Крок', 'Step')}</Button>
                      <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => runAction(() => emulatorApi.restartScenario(scenario.id), tr('Сценарій перезапущено.', 'Scenario restarted.'))}>{tr('Перезапустити', 'Restart')}</Button>
                      <button type="button" className={styles.iconDanger} onClick={() => runAction(() => emulatorApi.deleteScenario(scenario.id), tr('Сценарій видалено.', 'Scenario deleted.'))}><Trash2 size={16} /></button>
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
              <CardHeader eyebrow={tr('Ринкові дані', 'Market data')} title={tr('Створити historical dataset', 'Create historical dataset')} />
              <div className={styles.formStack}>
                <label><span>{tr('Символ', 'Symbol')}</span><input value={historySymbol} placeholder="BTCUSDT" onChange={(e) => setHistorySymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label>
                <label><span>{tr('Назва dataset (необов’язково)', 'Dataset name (optional)')}</span><input value={historyName} placeholder={`${historySymbol || "SYMBOL"} custom period`} onChange={(e) => setHistoryName(e.target.value)} /></label>
                <div className={styles.fieldGrid}>
                  <label><span>{tr('Від', 'From')}</span><input type="datetime-local" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} /></label>
                  <label><span>{tr('До', 'To')}</span><input type="datetime-local" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} /></label>
                </div>
                <label><span>{tr('Інтервал свічок', 'Candle interval')}</span><select value={historyInterval} onChange={(e) => setHistoryInterval(e.target.value)}>
                  {Object.entries(INTERVAL_LABELS[language]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
                <Button icon={<Download size={16} />} disabled={busy || !historySymbol.trim() || !historyFrom || !historyTo} onClick={downloadHistory}>{tr('Завантажити новий dataset з Bybit', 'Download new dataset from Bybit')}</Button>
                <div className={styles.importRow}>
                  <input type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                  <Button variant="ghost" icon={<Upload size={16} />} disabled={!csvFile || !historySymbol.trim() || busy} onClick={importHistory}>{tr('Імпортувати як окремий CSV dataset', 'Import as separate CSV dataset')}</Button>
                </div>
                <p className="text-secondary">{tr('Кожне завантаження створює окремий dataset. Набори з однаковим символом та interval не змішуються.', 'Each download creates a separate dataset. Sets with the same symbol and interval are not merged.')}</p>
                <div className={styles.datasetList}>
                  {filteredDatasets.length === 0 && <p className="text-secondary">{tr('Для', 'There are no datasets for')} {historySymbol || tr('цього символу', 'this symbol')} {tr('datasets ще немає.', 'yet.')}</p>}
                  {filteredDatasets.map((item) => (
                    <div key={item.id} className={Number(selectedDatasetId) === item.id ? styles.selectedDataset : ""}>
                      <Database size={15} />
                      <div className={styles.datasetInfo}>
                        <strong>{item.name}</strong>
                        <span>{item.exchange} · {intervalLabel(item.interval)} · {fmt(item.candles, 0)} {tr('свічок', 'candles')}</span>
                        <small>{new Date(item.from_time).toLocaleString(locale)} — {new Date(item.to_time).toLocaleString(locale)}</small>
                        <small className={item.missing_candles ? styles.qualityBad : styles.qualityGood}>
                          {item.missing_candles ? `${item.missing_candles} ${tr('пропущених свічок', 'missing candles')}` : tr('Повна послідовність', 'Complete sequence')}
                          {item.quality?.has_volume ? ` · ${tr('volume доступний', 'volume available')}` : ` · ${tr('без volume', 'no volume')}`}
                        </small>
                      </div>
                      <div className={styles.datasetActions}>
                        <button type="button" onClick={() => useDataset(item)}>{tr('Використати', 'Use')}</button>
                        <button type="button" className={styles.iconDanger} onClick={async () => {
                          const confirmed = await confirm({
                            title: tr('Видалити dataset?', 'Delete dataset?'),
                            message: `${tr('Видалити dataset', 'Delete dataset')} "${item.name}"?`,
                            confirmLabel: tr('Видалити', 'Delete'),
                            cancelLabel: tr('Скасувати', 'Cancel'),
                            isDanger: true,
                          });
                          if (confirmed) {
                            runAction(() => emulatorApi.deleteHistorical(item.id), tr('Dataset видалено.', 'Dataset deleted.'));
                          }
                        }}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow={tr('Replay', 'Replay')} title={tr('Програти конкретний dataset', 'Replay a specific dataset')} />
              <div className={styles.formStack}>
                <label><span>{tr('Dataset', 'Dataset')}</span><select value={selectedDatasetId} onChange={(e) => {
                  const item = filteredDatasets.find((dataset) => dataset.id === Number(e.target.value));
                  if (item) useDataset(item);
                }}>
                  {filteredDatasets.map((item) => <option key={item.id} value={item.id}>{item.name} · {intervalLabel(item.interval)}</option>)}
                </select></label>
                {selectedDataset && <div className={styles.datasetSummary}>
                  <strong>{selectedDataset.symbol} · {intervalLabel(selectedDataset.interval)}</strong>
                  <span>{fmt(selectedDataset.candles, 0)} {tr('свічок', 'candles')} · {selectedDataset.exchange}</span>
                  <span>{selectedDataset.missing_candles ? `${tr('Попередження:', 'Warning:')} ${selectedDataset.missing_candles} ${tr('пропущено', 'missing')}` : tr('Послідовність dataset повна', 'Dataset sequence is complete')}</span>
                </div>}
                <label><span>{tr('Швидкість, свічок/сек', 'Speed, candles/sec')}</span><select value={replaySpeed} onChange={(e) => setReplaySpeed(e.target.value)}><option value="1">1x</option><option value="10">10x</option><option value="100">100x</option><option value="1000">{tr('Максимум', 'Maximum')}</option></select></label>
                <label><span>{tr('Intrabar шлях', 'Intrabar path')}</span><select value={pathMode} onChange={(e) => setPathMode(e.target.value)}><option value="ohlc">{tr('Відкриття → Максимум → Мінімум → Закриття', 'Open → High → Low → Close')}</option><option value="olhc">{tr('Відкриття → Мінімум → Максимум → Закриття', 'Open → Low → High → Close')}</option><option value="close">{tr('Тільки Close', 'Close only')}</option></select></label>
                <div className={styles.actionRow}>
                  <Button icon={<Play size={16} />} disabled={busy || !selectedDatasetId} onClick={startReplay}>{tr('Старт', 'Start')}</Button>
                  <Button variant="ghost" icon={<Pause size={16} />} onClick={() => runAction(() => emulatorApi.pauseMarket(symbol), tr('Replay на паузі.', 'Replay paused.'))}>{tr('Пауза', 'Pause')}</Button>
                  <Button variant="ghost" icon={<Play size={16} />} onClick={() => runAction(() => emulatorApi.resumeMarket(symbol), tr('Replay продовжено.', 'Replay resumed.'))}>{tr('Продовжити', 'Resume')}</Button>
                  <Button variant="ghost" icon={<SkipForward size={16} />} onClick={() => runAction(() => emulatorApi.stepReplay(symbol), tr('Одна свічка програна.', 'One candle replayed.'))}>{tr('Наступна свічка', 'Next candle')}</Button>
                  <Button variant="ghost" icon={<Square size={16} />} onClick={() => runAction(() => emulatorApi.stopMarket(symbol), tr('Replay зупинено.', 'Replay stopped.'))}>{tr('Стоп', 'Stop')}</Button>
                </div>
                {currentMarket?.mode === "historical" && (
                  <div className={styles.progressBox}>
                    <span>{tr('Прогрес', 'Progress')}</span>
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
              <CardHeader eyebrow={tr('Новий акаунт', 'New account')} title={tr('Створити тестовий акаунт', 'Create test account')} />
              <div className={styles.formStack}>
                <label><span>{tr('Назва', 'Name')}</span><input value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} /></label>
                <label><span>{tr('Початковий баланс USDT', 'Initial USDT balance')}</span><input type="number" min="0.01" step="0.01" value={newAccountBalance} onChange={(e) => setNewAccountBalance(e.target.value)} /></label>
                <Button icon={<Plus size={16} />} onClick={() => runAction(() => emulatorApi.createAccount({ name: newAccountName, initial_balance: Number(newAccountBalance) }), tr('Акаунт створено.', 'Account created.'))}>{tr('Створити акаунт', 'Create account')}</Button>
              </div>
            </Card>
            <Card>
              <CardHeader eyebrow={tr('Вибраний акаунт', 'Selected account')} title={selectedAccount?.name || "—"} />
              {selectedAccount && (
                <div className={styles.formStack}>
                  <div className={styles.credential}><span>API key</span><code>{selectedAccount.api_key}</code></div>
                  <label><span>{tr('Додати/зняти кошти', 'Add/remove funds')}</span><input type="number" step="0.01" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} /></label>
                  <div className={styles.actionRow}>
                    <Button icon={<Banknote size={16} />} onClick={() => runAction(() => emulatorApi.fundAccount(selectedAccount.id, Number(fundAmount)), tr('Баланс змінено.', 'Balance updated.'))}>{tr('Застосувати', 'Apply')}</Button>
                    <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => runAction(() => emulatorApi.resetAccount(selectedAccount.id), tr('Акаунт очищено та скинуто.', 'Account cleared and reset.'))}>{tr('Скинути акаунт', 'Reset account')}</Button>
                  </div>
                  <p className="text-secondary">{tr('У формі бота виберіть Environment = Emulator і цей акаунт. API key збережеться в settings бота.', 'In the bot form, choose Environment = Emulator and this account. The API key will be stored in the bot settings.')}</p>
                </div>
              )}
            </Card>
          </section>
        )}

        {tab === "activity" && (
          <section className={styles.activityGrid}>
            <div className={styles.activityOverview}>
              <Metric label={tr('Активні ордери', 'Active orders')} value={activeOrders.length} tone={activeOrders.length > 0 ? "open" : "neutral"} />
              <Metric label={tr('Історія ордерів', 'Order history')} value={historicalOrders.length} />
              <Metric label={tr('Відкриті позиції', 'Open positions')} value={positions.length} tone={positions.length > 0 ? "positive" : "neutral"} />
              <Metric
                label={tr('Відкритий PnL', 'Open PnL')}
                value={`$${fmt(totalOpenPnl)}`}
                tone={totalOpenPnl > 0 ? "positive" : totalOpenPnl < 0 ? "negative" : "neutral"}
              />
              <Metric
                label={tr('Закритий PnL', 'Closed PnL')}
                value={`$${fmt(totalClosedPnl)}`}
                tone={totalClosedPnl > 0 ? "positive" : totalClosedPnl < 0 ? "negative" : "neutral"}
              />
            </div>

            <div className={styles.activityPrimary}>
              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow={tr('Акаунт', 'Account')}
                  title={tr('Відкриті позиції', 'Open positions')}
                  action={<span className={styles.sectionCount}>{positions.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "symbol", label: tr('Символ', 'Symbol'), render: (row) => <strong className="mono">{row.symbol}</strong> },
                    { key: "side", label: tr('Сторона', 'Side'), render: (row) => <SideBadge side={row.side || "Buy"} /> },
                    { key: "size", label: tr('Розмір', 'Size'), render: (row) => <span className="mono">{fmt(row.size, 6)}</span> },
                    { key: "avgPrice", label: tr('Сер. вхід', 'Avg entry'), render: (row) => <span className="mono">${fmt(row.avgPrice, 4)}</span> },
                    { key: "markPrice", label: tr('Mark', 'Mark'), render: (row) => <span className="mono">${fmt(row.markPrice, 4)}</span> },
                    { key: "unrealisedPnl", label: tr('Відкритий PnL', 'Open PnL'), render: (row) => <PnlValue value={row.unrealisedPnl}>${fmt(row.unrealisedPnl)}</PnlValue> },
                    { key: "leverage", label: tr('Плече', 'Lev.'), render: (row) => <span className="mono">{fmt(row.leverage)}x</span> },
                  ]}
                  rows={positions}
                  empty={tr('Немає відкритої позиції', 'No open position')}
                  rowClassName={(row) => numberValue(row.unrealisedPnl) >= 0 ? styles.positiveRow : styles.negativeRow}
                />
              </Card>

              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow={tr('Біржа', 'Exchange')}
                  title={tr('Активні ордери', 'Active orders')}
                  action={<span className={styles.sectionCount}>{activeOrders.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "side", label: tr('Сторона', 'Side'), render: (row) => <SideBadge side={row.side} /> },
                    { key: "role", label: tr('Роль', 'Role'), render: (row) => <RoleBadge linkId={row.orderLinkId} /> },
                    { key: "orderType", label: tr('Тип', 'Type'), render: (row) => <OrderTypeBadge type={row.orderType} reduceOnly={row.reduceOnly} /> },
                    { key: "price", label: tr('Ціна', 'Price'), render: (row) => <span className="mono">${fmt(row.price, 4)}</span> },
                    { key: "qty", label: tr('Кількість', 'Qty'), render: (row) => <span className="mono">{fmt(row.qty, 6)}</span> },
                    { key: "cumExecQty", label: tr('Виконано', 'Filled'), render: (row) => <span className="mono">{fmt(row.cumExecQty, 6)}</span> },
                    { key: "orderStatus", label: tr('Статус', 'Status'), render: (row) => <StatusBadge status={row.orderStatus} /> },
                    { key: "orderLinkId", label: tr('Link ID', 'Link ID'), render: (row) => <span className={styles.compactId} title={row.orderLinkId}>{shortId(row.orderLinkId)}</span> },
                  ]}
                  rows={activeOrders}
                  empty={tr('Немає активних ордерів', 'No active orders')}
                  rowClassName={(row) => row.side === "Buy" ? styles.buyRow : styles.sellRow}
                />
              </Card>
            </div>

            <Card className={styles.activityCard}>
              <CardHeader
                eyebrow={tr('Ордери', 'Orders')}
                title={tr('Історія ордерів', 'Order history')}
                action={<span className={styles.sectionCount}>{historicalOrders.length}</span>}
              />
              <DataTable
                columns={[
                  { key: "createdTime", label: tr('Створено', 'Created'), render: (row) => <span className={styles.dateText}>{new Date(Number(row.createdTime)).toLocaleString(locale)}</span> },
                  { key: "side", label: tr('Сторона', 'Side'), render: (row) => <SideBadge side={row.side} /> },
                  { key: "role", label: tr('Роль', 'Role'), render: (row) => <RoleBadge linkId={row.orderLinkId} /> },
                  { key: "orderType", label: tr('Тип', 'Type'), render: (row) => <OrderTypeBadge type={row.orderType} reduceOnly={row.reduceOnly} /> },
                  { key: "price", label: tr('Ціна', 'Price'), render: (row) => <span className="mono">${fmt(row.price, 4)}</span> },
                  { key: "qty", label: tr('Кількість', 'Qty'), render: (row) => <span className="mono">{fmt(row.qty, 6)}</span> },
                  { key: "orderStatus", label: tr('Статус', 'Status'), render: (row) => <StatusBadge status={row.orderStatus} /> },
                  { key: "orderLinkId", label: tr('Link ID', 'Link ID'), render: (row) => <span className={styles.compactId} title={row.orderLinkId}>{shortId(row.orderLinkId)}</span> },
                ]}
                rows={historicalOrders}
                empty={tr('Немає завершених або скасованих ордерів', 'No completed or cancelled orders')}
                rowClassName={(row) => row.side === "Buy" ? styles.buyRow : styles.sellRow}
              />
            </Card>

            <div className={styles.activitySecondary}>
              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow={tr('Виконання', 'Fills')}
                  title={tr('Виконання', 'Executions')}
                  action={<span className={styles.sectionCount}>{executions.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "execTime", label: tr('Час', 'Time'), render: (row) => <span className={styles.dateText}>{new Date(row.execTime).toLocaleString(locale)}</span> },
                    { key: "side", label: tr('Сторона', 'Side'), render: (row) => <SideBadge side={row.side} /> },
                    { key: "execPrice", label: tr('Ціна', 'Price'), render: (row) => <span className="mono">${fmt(row.execPrice, 4)}</span> },
                    { key: "execQty", label: tr('Кількість', 'Qty'), render: (row) => <span className="mono">{fmt(row.execQty, 6)}</span> },
                    { key: "execFee", label: tr('Комісія', 'Fee'), render: (row) => <span className={styles.mutedNumber}>${fmt(row.execFee, 6)}</span> },
                    { key: "closedPnl", label: tr('Закритий PnL', 'Closed PnL'), render: (row) => <PnlValue value={row.closedPnl}>${fmt(row.closedPnl)}</PnlValue> },
                  ]}
                  rows={executions}
                />
              </Card>

              <Card className={styles.activityCard}>
                <CardHeader
                  eyebrow={tr('Runtime', 'Runtime')}
                  title={tr('Журнал подій', 'Event log')}
                  action={<span className={styles.sectionCount}>{events.length}</span>}
                />
                <DataTable
                  columns={[
                    { key: "created_at", label: tr('Час', 'Time'), render: (row) => <span className={styles.dateText}>{new Date(row.created_at).toLocaleTimeString(locale)}</span> },
                    { key: "event_type", label: tr('Тип', 'Type'), render: (row) => <EventBadge type={row.event_type} /> },
                    { key: "message", label: tr('Повідомлення', 'Message'), render: (row) => <span className={styles.eventMessage}>{row.message}</span> },
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
