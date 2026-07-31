import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area, AreaChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowLeft, CirclePause, CirclePlay, Copy, Crosshair, LoaderCircle, OctagonX } from "lucide-react";

import { backtestsApi } from "../../api/backtests";
import Button from "../../components/ui/Button/Button";
import {
  EventBadge, OrderTypeBadge, PnlValue, RoleBadge, SideBadge, StatusBadge,
} from "../../components/trading/TradingBadges/TradingBadges";
import { fmtDateTime, fmtMoney, fmtMoneySigned, fmtNumber, fmtPctSigned } from "../../lib/format";
import styles from "./BacktestDetailPage.module.css";

const ACTIVE = new Set(["queued", "running", "paused"]);
const TABS = ["Summary", "Chart", "Cycles", "Orders", "Executions", "Positions", "Events", "Configuration"];
const asNumber = (value) => Number(value || 0);
const asMs = (value) => {
  if (typeof value === "number") return value;
  const numeric = Number(value);
  if (String(value ?? "").trim() && Number.isFinite(numeric)) return numeric;
  return new Date(value).getTime();
};

const DAY_MS = 86400000;
const WINDOW_MS = { "1d": DAY_MS, "1w": 7 * DAY_MS, "1m": 30 * DAY_MS };
const CHART_SYNC_ID = "backtest-detail";

function chartSpan(data) {
  if (!data?.length) return 0;
  return Math.max(asMs(data[data.length - 1].timestamp) - asMs(data[0].timestamp), 0);
}

function formatChartTime(value, spanMs) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  if (spanMs <= 2 * DAY_MS) {
    return date.toLocaleString("uk-UA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  if (spanMs <= 45 * DAY_MS) return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "short" });
  if (spanMs <= 370 * DAY_MS) return date.toLocaleDateString("uk-UA", { day: "2-digit", month: "short" });
  return date.toLocaleDateString("uk-UA", { month: "short", year: "numeric" });
}

function buildTimeTicks(start, end, targetCount = 7) {
  const min = Number(start);
  const max = Number(end);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];

  const span = max - min;
  const count = Math.max(2, targetCount);
  if (span <= 45 * DAY_MS) {
    return Array.from({ length: count }, (_, index) => min + ((span * index) / (count - 1)));
  }

  const startDate = new Date(min);
  const endDate = new Date(max);
  const monthCount = Math.max(
    1,
    ((endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12)
      + endDate.getUTCMonth() - startDate.getUTCMonth() + 1,
  );
  const monthStep = Math.max(1, Math.ceil(monthCount / (count - 1)));
  const ticks = [min];
  let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + monthStep, 1));
  while (cursor.getTime() < max) {
    ticks.push(cursor.getTime());
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + monthStep, 1));
  }
  ticks.push(max);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

function formatPeriodTime(value, spanMs) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return spanMs <= 2 * DAY_MS
    ? date.toLocaleString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("uk-UA", { day: "2-digit", month: "short", year: "numeric" });
}

function paddedDomain(values, paddingRatio = 0.08) {
  const finite = values.map(Number).filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  const spread = Math.max(max - min, Math.max(Math.abs(max), Math.abs(min), 1) * 0.01);
  return [min - spread * paddingRatio, max + spread * paddingRatio];
}

function formatAxisMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const compact = Math.abs(number).toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 });
  return `${number < 0 ? "-" : ""}$${compact}`;
}

function formatAxisPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  const number = Math.abs(numeric) < 0.005 ? 0 : numeric;
  return `${number.toFixed(Math.abs(number) < 1 ? 2 : 1)}%`;
}

function formatAxisQty(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function duration(seconds) {
  const value = Math.max(Number(seconds || 0), 0);
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (days) return `${days}д ${hours}г ${minutes}хв`;
  if (hours) return `${hours}г ${minutes}хв`;
  return `${minutes}хв`;
}

function Metric({ label, value, tone = "", hint }) {
  return <div className={`${styles.metric} ${tone ? styles[tone] : ""}`}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
}

function Empty({ children = "Немає даних" }) { return <div className={styles.empty}>{children}</div>; }

function PriceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const candlePayload = payload.find((item) => item.dataKey === "close")?.payload;
  const markerPayload = payload.find((item) => item.dataKey === "price")?.payload;
  const row = candlePayload || markerPayload || payload[0]?.payload || {};
  const timestamp = asMs(row.timestamp);
  return <div className={styles.tooltip}>
    <strong>{new Date(timestamp).toLocaleString("uk-UA")}</strong>
    {row.open != null && <>
      <span>Open {fmtMoney(row.open)} · High {fmtMoney(row.high)}</span>
      <span>Low {fmtMoney(row.low)} · Close {fmtMoney(row.close)}</span>
    </>}
    {markerPayload && <>
      <span className={styles.tooltipAction}>{markerPayload.label} · {markerPayload.status}</span>
      <span>{fmtMoney(markerPayload.price)} · {fmtNumber(markerPayload.qty, 6)}</span>
    </>}
  </div>;
}

function MetricTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return <div className={styles.tooltip}>
    <strong>{new Date(asMs(label)).toLocaleString("uk-UA")}</strong>
    <span>{formatter(value)}</span>
  </div>;
}

function OrderMarker({ cx, cy, payload }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const isTp = payload.role?.includes("take_profit") || payload.role?.includes("tp");
  const compact = Boolean(payload.compact);
  const radius = compact ? 4.2 : 6;
  const fill = payload.kind === "cancelled" ? "#929bb0" : isTp ? "#b98cff" : "#25c78b";
  const title = `${payload.label} · ${fmtMoney(payload.price)} · ${fmtNumber(payload.qty, 6)} · ${new Date(payload.timestamp).toLocaleString("uk-UA")}`;
  if (payload.kind === "cancelled") {
    const size = compact ? 3.5 : 5;
    return <g transform={`translate(${cx},${cy})`} className={styles.orderMarker}><title>{title}</title><path d={`M-${size} -${size} L${size} ${size} M${size} -${size} L-${size} ${size}`} stroke={fill} strokeWidth={compact ? 1.7 : 2.3}/></g>;
  }
  return <g transform={`translate(${cx},${cy})`} className={styles.orderMarker}>
    <title>{title}</title>
    <circle r={radius} fill={fill} stroke="#090b12" strokeWidth={compact ? 1.4 : 2}/>
    <path d={isTp ? "M-3 2 L0 -2 L3 2" : "M-3 -2 L0 2 L3 -2"} fill="none" stroke="#fff" strokeWidth={compact ? 1 : 1.3}/>
  </g>;
}

function ChartToggle({ checked, onChange, label, color, type = "dot" }) {
  return <label className={styles.chartToggle}>
    <input type="checkbox" checked={checked} onChange={onChange}/>
    <i className={type === "band" ? styles.legendBand : styles.legendDot} style={{ "--legend-color": color }}/>
    <span>{label}</span>
  </label>;
}

function MiniChart({ title, value, data, dataKey, stroke, fill, domain, timeDomain, timeTicks, yFormatter, tooltipFormatter, spanMs, type = "monotone", referenceValue = null, referenceLabel = "" }) {
  return <div className={styles.miniChart}>
    <div className={styles.miniChartHeader}><h3>{title}</h3><strong>{value}</strong></div>
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} syncId={CHART_SYNC_ID} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,.045)" vertical={false}/>
        <XAxis dataKey="timestamp" type="number" scale="time" domain={timeDomain} ticks={timeTicks} allowDataOverflow height={28} tickFormatter={(v) => formatChartTime(v, spanMs)} stroke="#68718a" tick={{ fontSize: 10 }}/>
        <YAxis domain={domain} width={72} stroke="#68718a" tickFormatter={yFormatter} tick={{ fontSize: 10 }}/>
        <Tooltip content={<MetricTooltip formatter={tooltipFormatter}/>} cursor={{ stroke: "rgba(255,255,255,.18)", strokeDasharray: "3 3" }}/>
        {referenceValue != null && <ReferenceLine y={referenceValue} stroke="rgba(255,255,255,.25)" strokeDasharray="4 4" label={referenceLabel ? { value: referenceLabel, position: "insideTopRight", fill: "#7f879c", fontSize: 10 } : undefined}/>}
        <Area type={type} dataKey={dataKey} stroke={stroke} strokeWidth={1.7} fill={fill} isAnimationActive={false} activeDot={{ r: 3 }}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}


export default function BacktestDetailPage() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [points, setPoints] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [events, setEvents] = useState([]);
  const [tab, setTab] = useState("Summary");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({ entries: true, tp: true, cancelled: false, position: true, loss: true });
  const [cycleFilter, setCycleFilter] = useState("all");
  const [orderFilter, setOrderFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("important");
  const [windowSize, setWindowSize] = useState("all");
  const [focusTime, setFocusTime] = useState(null);

  const loadRun = useCallback(async () => {
    try { setRun(await backtestsApi.get(id)); setError(""); }
    catch (e) { setError(e.detail || e.message); }
  }, [id]);

  const loadDetails = useCallback(async () => {
    try {
      const [pointData, cycleData, orderData, executionData, eventData] = await Promise.all([
        backtestsApi.points(id), backtestsApi.cycles(id), backtestsApi.orders(id),
        backtestsApi.executions(id), backtestsApi.events(id),
      ]);
      setPoints(pointData); setCycles(cycleData); setOrders(orderData);
      setExecutions(executionData); setEvents(eventData);
    } catch (e) { setError(e.detail || e.message); }
  }, [id]);

  useEffect(() => { loadRun(); loadDetails(); }, [loadRun, loadDetails]);
  useEffect(() => {
    if (!run || !ACTIVE.has(run.status)) return undefined;
    const timer = window.setInterval(() => { loadRun(); loadDetails(); }, 1200);
    return () => window.clearInterval(timer);
  }, [run, loadRun, loadDetails]);

  const control = async (action) => {
    try { setBusy(true); setRun(await action()); await loadDetails(); }
    catch (e) { setError(e.detail || e.message); }
    finally { setBusy(false); }
  };

  const metrics = run?.metrics || {};
  const normalizedPoints = useMemo(() => points
    .map((point) => ({ ...point, timestamp: asMs(point.timestamp) }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp), [points]);

  const filteredPoints = useMemo(() => {
    let data = normalizedPoints;
    if (cycleFilter !== "all") {
      const cycle = cycles.find((item) => String(item.cycle_number) === cycleFilter);
      if (cycle) {
        const cycleEnd = cycle.closed_at_ms || asMs(run?.end_time);
        data = data.filter((point) => point.timestamp >= asMs(cycle.started_at_ms) && point.timestamp <= cycleEnd);
      }
    }
    if (focusTime && windowSize !== "all") {
      const span = WINDOW_MS[windowSize] || WINDOW_MS["1d"];
      data = data.filter((point) => point.timestamp >= focusTime - span / 2 && point.timestamp <= focusTime + span / 2);
    } else if (windowSize !== "all" && data.length) {
      const end = data[data.length - 1].timestamp;
      data = data.filter((point) => point.timestamp >= end - WINDOW_MS[windowSize]);
    }
    return data;
  }, [normalizedPoints, cycles, cycleFilter, windowSize, focusTime, run?.end_time]);

  const orderByExchangeId = useMemo(() => new Map(orders.map((order) => [String(order.exchange_order_id), order])), [orders]);

  const markers = useMemo(() => {
    const result = [];
    executions.forEach((execution) => {
      const order = orderByExchangeId.get(String(execution.orderId));
      const role = order?.order_role || (String(execution.side).toLowerCase() === "sell" ? "position_take_profit" : "grid_entry");
      const isTp = role.includes("take_profit") || role.includes("tp");
      if (isTp && !filters.tp) return;
      if (!isTp && !filters.entries) return;
      const level = String(order?.order_link_id || "").match(/entry-(\d+)/)?.[1];
      result.push({
        id: `execution-${execution.execId || `${execution.execTime}-${execution.execSeq}`}`,
        timestamp: asMs(execution.execTime),
        sequence: asNumber(execution.execSeq),
        price: asNumber(execution.execPrice),
        qty: asNumber(execution.execQty),
        role,
        label: isTp ? "Take profit filled" : `Grid #${level || "?"} filled`,
        status: "Filled",
        kind: "filled",
      });
    });
    if (filters.cancelled) {
      orders.forEach((order) => {
        const status = String(order.status || "");
        if (!status.toLowerCase().includes("cancel")) return;
        const role = order.order_role || "";
        const isTp = role.includes("take_profit") || role.includes("tp");
        const level = String(order.order_link_id || "").match(/entry-(\d+)/)?.[1];
        result.push({
          id: `cancelled-${order.id || order.exchange_order_id}`,
          timestamp: asMs(order.updated_at),
          sequence: Number.MAX_SAFE_INTEGER,
          price: asNumber(order.price),
          qty: asNumber(order.qty),
          role,
          label: isTp ? "Take profit cancelled" : `Grid #${level || "?"} cancelled`,
          status: "Cancelled",
          kind: "cancelled",
        });
      });
    }
    return result
      .filter((marker) => Number.isFinite(marker.timestamp) && marker.price > 0)
      .sort((a, b) => (a.timestamp - b.timestamp) || (a.sequence - b.sequence));
  }, [executions, orderByExchangeId, orders, filters.entries, filters.tp, filters.cancelled]);

  const chartSpanMs = useMemo(() => chartSpan(filteredPoints), [filteredPoints]);
  const compactMarkers = chartSpanMs > 90 * DAY_MS || filteredPoints.length > 700;

  const visibleMarkers = useMemo(() => {
    if (!filteredPoints.length) return [];
    const min = filteredPoints[0].timestamp;
    const max = filteredPoints[filteredPoints.length - 1].timestamp;
    return markers
      .filter((marker) => marker.timestamp >= min && marker.timestamp <= max)
      .map((marker) => ({ ...marker, compact: compactMarkers }));
  }, [markers, filteredPoints, compactMarkers]);

  const priceDomain = useMemo(() => {
    const values = filteredPoints.flatMap((point) => [point.low, point.high, point.close]);
    visibleMarkers.forEach((marker) => values.push(marker.price));
    return paddedDomain(values, 0.045);
  }, [filteredPoints, visibleMarkers]);

  const equityDomain = useMemo(() => paddedDomain(filteredPoints.map((point) => point.equity), 0.12), [filteredPoints]);
  const drawdownDomain = useMemo(() => {
    const values = filteredPoints.map((point) => asNumber(point.drawdown_percent));
    const minimum = Math.min(...values, -0.01);
    return [minimum * 1.08, 0];
  }, [filteredPoints]);
  const positionDomain = useMemo(() => {
    const maximum = Math.max(...filteredPoints.map((point) => asNumber(point.position_qty)), 0);
    return [0, maximum > 0 ? maximum * 1.12 : 1];
  }, [filteredPoints]);
  const balanceDomain = useMemo(() => paddedDomain(filteredPoints.map((point) => point.available_balance), 0.12), [filteredPoints]);
  const latestPoint = filteredPoints[filteredPoints.length - 1] || null;
  const periodStart = filteredPoints[0]?.timestamp;
  const periodEnd = latestPoint?.timestamp;
  const timeDomain = useMemo(() => [periodStart, periodEnd], [periodStart, periodEnd]);
  const mainTimeTicks = useMemo(() => buildTimeTicks(periodStart, periodEnd, 8), [periodStart, periodEnd]);
  const miniTimeTicks = useMemo(() => buildTimeTicks(periodStart, periodEnd, 5), [periodStart, periodEnd]);
  const priceBandSize = Math.max(priceDomain[1] - priceDomain[0], 1) * 0.012;
  const openCycle = cycles.find((cycle) => String(cycle.status).toLowerCase() === "open" || !cycle.closed_at_ms);
  const openCycleStart = openCycle ? asMs(openCycle.started_at_ms) : null;
  const showOpenCycleStart = openCycleStart != null && openCycleStart >= periodStart && openCycleStart <= periodEnd;

  const positionRanges = useMemo(() => {
    if (!filters.position || !filteredPoints.length) return [];
    const ranges = [];
    let start = null;
    filteredPoints.forEach((point, index) => {
      if (point.position_qty > 0 && start == null) start = point.timestamp;
      const ends = point.position_qty <= 0 || index === filteredPoints.length - 1;
      if (start != null && ends) { ranges.push([start, point.timestamp]); start = null; }
    });
    return ranges;
  }, [filteredPoints, filters.position]);

  const lossRanges = useMemo(() => {
    if (!filters.loss || !filteredPoints.length) return [];
    const ranges = [];
    let start = null;
    filteredPoints.forEach((point, index) => {
      const inLoss = point.position_qty > 0 && point.unrealized_pnl < 0;
      if (inLoss && start == null) start = point.timestamp;
      if (start != null && (!inLoss || index === filteredPoints.length - 1)) {
        ranges.push([start, point.timestamp]); start = null;
      }
    });
    return ranges;
  }, [filteredPoints, filters.loss]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const status = String(order.status || "").toLowerCase();
    if (orderFilter === "open") return ["new", "partiallyfilled", "partially filled"].includes(status);
    if (orderFilter === "filled") return status === "filled";
    if (orderFilter === "cancelled") return status.includes("cancel");
    if (orderFilter === "rejected") return status.includes("reject") || status.includes("error");
    return true;
  }), [orders, orderFilter]);

  const orderedExecutions = useMemo(() => [...executions].sort((a, b) => {
    const timeDifference = asMs(a.execTime) - asMs(b.execTime);
    if (timeDifference !== 0) return timeDifference;
    const sequenceDifference = asNumber(a.execSeq) - asNumber(b.execSeq);
    if (sequenceDifference !== 0) return sequenceDifference;
    return String(a.execId || "").localeCompare(String(b.execId || ""));
  }), [executions]);

  const positionTimeline = useMemo(() => {
    const byExchangeId = new Map(orders.map((order) => [String(order.exchange_order_id), order]));
    let qty = 0;
    let avg = 0;
    return orderedExecutions.map((item) => {
      const before = qty;
      const fillQty = asNumber(item.execQty);
      const price = asNumber(item.execPrice);
      const isBuy = String(item.side).toLowerCase() === "buy";
      if (isBuy) {
        qty += fillQty;
        avg = qty > 0 ? ((before * avg) + (fillQty * price)) / qty : 0;
      } else {
        qty = Math.max(qty - fillQty, 0);
        if (qty === 0) avg = 0;
      }
      const order = byExchangeId.get(String(item.orderId));
      return { ...item, before, after: qty, average: avg, role: order?.order_role || (isBuy ? "grid_entry" : "position_take_profit") };
    });
  }, [orderedExecutions, orders]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const type = String(event.event_type || "").toLowerCase();
    if (eventFilter === "all") return true;
    if (eventFilter === "errors") return /error|failed|reject/.test(type);
    if (eventFilter === "risk") return /risk|blocked|limit|warning/.test(type);
    return /filled|created|cancel|completed|started|stopped|risk|error|failed/.test(type);
  }), [events, eventFilter]);

  const jumpToChart = (timestamp) => { setFocusTime(asMs(timestamp)); setWindowSize("1d"); setTab("Chart"); };

  if (!run) return <main className={styles.page}><div className="container">{error ? <div className={styles.error}>{error}</div> : <div className={styles.loading}><LoaderCircle /> Завантаження…</div>}</div></main>;

  return (
    <main className={styles.page}>
      <div className="container">
        <Link to="/backtests" className={styles.back}><ArrowLeft size={15}/> Backtests</Link>
        <header className={styles.hero}>
          <div><div className={styles.titleLine}><StatusBadge status={run.status}/><span>{Number(run.progress || 0).toFixed(1)}%</span></div><h1>{run.name}</h1><p>{run.bot_name} · {run.symbol} · {run.interval} · {new Date(run.start_time).toLocaleDateString("uk-UA")} — {new Date(run.end_time).toLocaleDateString("uk-UA")}</p></div>
          <div className={styles.controls}>
            {!ACTIVE.has(run.status) && <Link className={styles.copyButton} to={`/backtests?duplicate=${run.id}`}><Copy size={16}/> Run again</Link>}
            {run.status === "running" && <Button variant="ghost" icon={<CirclePause size={16}/>} disabled={busy} onClick={() => control(() => backtestsApi.pause(id))}>Pause</Button>}
            {run.status === "paused" && <Button icon={<CirclePlay size={16}/>} disabled={busy} onClick={() => control(() => backtestsApi.resume(id))}>Resume</Button>}
            {ACTIVE.has(run.status) && <Button variant="danger" icon={<OctagonX size={16}/>} disabled={busy} onClick={() => control(() => backtestsApi.cancel(id))}>Cancel</Button>}
          </div>
        </header>
        {error && <div className={styles.error}>{error}</div>}
        {ACTIVE.has(run.status) && <div className={styles.liveBar}><div className={styles.progress}><i style={{width:`${run.progress}%`}}/></div><div><span>Simulated: {run.current_time ? new Date(run.current_time).toLocaleString("uk-UA") : "Preparing…"}</span><span>{run.processed_candles.toLocaleString()} / {run.total_candles.toLocaleString()} candles</span><span>{run.current_price ? fmtMoney(run.current_price) : "—"}</span></div></div>}
        {run.error && <div className={styles.error}>{run.error}</div>}

        <nav className={styles.tabs}>{TABS.map((item) => <button key={item} className={tab === item ? styles.activeTab : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

        {tab === "Summary" && <>
          <section className={styles.heroMetrics}>
            <Metric label="Net Total PnL" value={metrics.net_total_pnl == null ? "—" : fmtMoneySigned(metrics.net_total_pnl)} tone={asNumber(metrics.net_total_pnl)>=0?"positive":"negative"}/>
            <Metric label="Return" value={metrics.return_percent == null ? "—" : fmtPctSigned(metrics.return_percent)} tone={asNumber(metrics.return_percent)>=0?"positive":"negative"}/>
            <Metric label="Final Equity" value={metrics.final_equity == null ? "—" : fmtMoney(metrics.final_equity)}/>
            <Metric label="Maximum Drawdown" value={metrics.maximum_drawdown_percent == null ? "—" : fmtPctSigned(metrics.maximum_drawdown_percent)} tone="negative"/>
          </section>
          <div className={styles.summaryGrid}>
            <section className={styles.panel}><h2>Profitability</h2><div className={styles.metricGrid}>
              <Metric label="Gross realized" value={fmtMoneySigned(metrics.gross_realized_pnl)}/><Metric label="Net realized" value={fmtMoneySigned(metrics.net_realized_pnl)}/><Metric label="Open unrealized" value={fmtMoneySigned(metrics.unrealized_pnl)}/><Metric label="Total fees" value={fmtMoney(metrics.total_fees)}/><Metric label="Average cycle" value={fmtMoneySigned(metrics.average_cycle_pnl)}/><Metric label="Best cycle" value={fmtMoneySigned(metrics.best_cycle_pnl)}/><Metric label="Worst cycle" value={fmtMoneySigned(metrics.worst_cycle_pnl)}/><Metric label="Win rate" value={fmtPctSigned(metrics.win_rate_percent)}/>
            </div></section>
            <section className={styles.panel}><h2>Time & recovery</h2><div className={styles.metricGrid}>
              <Metric label="Time in position" value={duration(metrics.time_in_position_seconds)} hint={`${fmtNumber(metrics.time_in_position_percent,1)}% of test`}/><Metric label="Time in open loss" value={duration(metrics.time_in_loss_seconds)} hint={`${fmtNumber(metrics.time_in_loss_percent,1)}% of test`}/><Metric label="Longest negative period" value={duration(metrics.longest_negative_pnl_period_seconds)}/><Metric label="Longest drawdown" value={duration(metrics.longest_drawdown_seconds)}/><Metric label="Max DD recovery" value={metrics.maximum_drawdown_recovered ? duration(metrics.maximum_drawdown_recovery_seconds) : `Not recovered · ${duration(metrics.current_drawdown_recovery_seconds)}`}/><Metric label="Average cycle" value={duration(metrics.average_cycle_duration_seconds)}/><Metric label="Median cycle" value={duration(metrics.median_cycle_duration_seconds)}/><Metric label="Longest cycle" value={duration(metrics.longest_cycle_seconds)}/>
            </div></section>
            <section className={styles.panel}><h2>Risk & exposure</h2><div className={styles.metricGrid}>
              <Metric label="Worst open loss" value={fmtMoneySigned(metrics.maximum_unrealized_loss)} tone="negative"/><Metric label="Max position qty" value={fmtNumber(metrics.maximum_position_qty,6)}/><Metric label="Max position value" value={fmtMoney(metrics.maximum_position_value)}/><Metric label="Max used margin" value={fmtMoney(metrics.maximum_used_margin)}/><Metric label="Lowest available" value={fmtMoney(metrics.lowest_available_balance)}/><Metric label="Max entries filled" value={metrics.maximum_grid_levels_filled ?? 0}/><Metric label="Open at end" value={metrics.open_position_at_end?"Yes":"No"}/><Metric label="Open orders at end" value={metrics.open_orders_at_end ?? "—"}/>
            </div></section>
            <section className={styles.panel}><h2>Cycles</h2><div className={styles.metricGrid}>
              <Metric label="Closed cycles" value={metrics.closed_cycles ?? 0}/><Metric label="Winning" value={metrics.winning_cycles ?? 0}/><Metric label="Losing" value={metrics.losing_cycles ?? 0}/><Metric label="Executions" value={metrics.executions_count ?? 0}/><Metric label="Final position" value={fmtNumber(metrics.open_position_qty,6)}/><Metric label="Avg entry at end" value={metrics.open_avg_entry_price?fmtMoney(metrics.open_avg_entry_price):"—"}/>
            </div></section>
          </div>
        </>}

        {tab === "Chart" && <section className={styles.chartPanel}>
          <div className={styles.chartToolbar}>
            <div className={styles.checks}>
              <ChartToggle checked={filters.entries} onChange={(e) => setFilters({ ...filters, entries: e.target.checked })} label="Entry fills" color="#25c78b"/>
              <ChartToggle checked={filters.tp} onChange={(e) => setFilters({ ...filters, tp: e.target.checked })} label="Take-profit fills" color="#b98cff"/>
              <ChartToggle checked={filters.cancelled} onChange={(e) => setFilters({ ...filters, cancelled: e.target.checked })} label="Cancelled orders" color="#929bb0"/>
              <ChartToggle checked={filters.position} onChange={(e) => setFilters({ ...filters, position: e.target.checked })} label="Position open" color="#4d9dff" type="band"/>
              <ChartToggle checked={filters.loss} onChange={(e) => setFilters({ ...filters, loss: e.target.checked })} label="Open loss" color="#f05b63" type="band"/>
            </div>
            <div className={styles.chartSelects}>
              <select value={cycleFilter} onChange={(e) => { setCycleFilter(e.target.value); setFocusTime(null); }}>
                <option value="all">All cycles</option>
                {cycles.map((cycle) => <option key={cycle.id} value={cycle.cycle_number}>Cycle #{cycle.cycle_number}</option>)}
              </select>
              {["1d", "1w", "1m", "all"].map((item) => <button key={item} className={windowSize === item ? styles.activeWindow : ""} onClick={() => { setWindowSize(item); if (item === "all") setFocusTime(null); }}>{item.toUpperCase()}</button>)}
            </div>
          </div>
          {filteredPoints.length ? <>
            <div className={styles.chartSnapshot}>
              <div><span>Visible period</span><strong>{formatPeriodTime(periodStart, chartSpanMs)} — {formatPeriodTime(periodEnd, chartSpanMs)}</strong></div>
              <div><span>Last price</span><strong>{fmtMoney(latestPoint?.close)}</strong></div>
              <div><span>Equity</span><strong>{fmtMoney(latestPoint?.equity)}</strong></div>
              <div><span>Position</span><strong>{fmtNumber(latestPoint?.position_qty, 6)}</strong></div>
              <div><span>Drawdown</span><strong className={asNumber(latestPoint?.drawdown_percent) < 0 ? styles.snapshotNegative : ""}>{formatAxisPercent(latestPoint?.drawdown_percent)}</strong></div>
            </div>
            <div className={styles.chartHint}>The blue strip marks periods with an open position; the red strip marks periods when that position was in unrealized loss. The orange line marks the start of the still-open cycle. Markers show fills, not order creation.</div>
            <div className={styles.priceChart}>
              <ResponsiveContainer width="100%" height={470}>
                <ComposedChart data={filteredPoints} syncId={CHART_SYNC_ID} margin={{ top: 18, right: 18, left: 4, bottom: 14 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/>
                  <XAxis dataKey="timestamp" type="number" scale="time" domain={timeDomain} ticks={mainTimeTicks} allowDataOverflow height={38} tickMargin={10} tickFormatter={(v) => formatChartTime(v, chartSpanMs)} stroke="#68718a" tick={{ fontSize: 11 }}/>
                  <YAxis domain={priceDomain} width={82} tickFormatter={formatAxisMoney} stroke="#68718a" tick={{ fontSize: 11 }}/>
                  <Tooltip content={<PriceTooltip/>} cursor={{ stroke: "rgba(255,255,255,.22)", strokeDasharray: "3 3" }}/>
                  {positionRanges.map(([x1, x2], index) => <ReferenceArea key={`position-${index}`} x1={x1} x2={x2} y1={priceDomain[0]} y2={priceDomain[0] + priceBandSize} fill="#4d9dff" fillOpacity={0.75} strokeOpacity={0}/>)}
                  {lossRanges.map(([x1, x2], index) => <ReferenceArea key={`loss-${index}`} x1={x1} x2={x2} y1={priceDomain[0] + priceBandSize} y2={priceDomain[0] + (priceBandSize * 2)} fill="#f05b63" fillOpacity={0.75} strokeOpacity={0}/>)}
                  <Line type="monotone" dataKey="close" name="Close" stroke="#d8dde9" strokeWidth={1.7} dot={false} activeDot={{ r: 3 }} isAnimationActive={false}/>
                  {visibleMarkers.map((marker) => <ReferenceDot
                    key={marker.id}
                    x={marker.timestamp}
                    y={marker.price}
                    r={0}
                    ifOverflow="discard"
                    shape={(props) => <OrderMarker {...props} payload={marker}/>}
                  />)}
                  {showOpenCycleStart && <ReferenceLine x={openCycleStart} stroke="#ffc24b" strokeDasharray="5 4" label={{ value: `Open cycle #${openCycle.cycle_number}`, position: "insideTopRight", fill: "#ffc24b", fontSize: 10 }}/>}
                  {focusTime && <ReferenceLine x={focusTime} stroke="#4d9dff" strokeDasharray="4 4"/>}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.subCharts}>
              <MiniChart title="Equity" value={fmtMoney(latestPoint?.equity)} data={filteredPoints} dataKey="equity" stroke="#25c78b" fill="rgba(37,199,139,.12)" domain={equityDomain} timeDomain={timeDomain} timeTicks={miniTimeTicks} yFormatter={formatAxisMoney} tooltipFormatter={fmtMoney} spanMs={chartSpanMs} referenceValue={asNumber(run.initial_balance ?? normalizedPoints[0]?.equity)} referenceLabel="Start"/>
              <MiniChart title="Drawdown" value={formatAxisPercent(latestPoint?.drawdown_percent)} data={filteredPoints} dataKey="drawdown_percent" stroke="#f05b63" fill="rgba(240,91,99,.12)" domain={drawdownDomain} timeDomain={timeDomain} timeTicks={miniTimeTicks} yFormatter={formatAxisPercent} tooltipFormatter={formatAxisPercent} spanMs={chartSpanMs} referenceValue={0}/>
              <MiniChart title="Position size" value={fmtNumber(latestPoint?.position_qty, 6)} data={filteredPoints} dataKey="position_qty" stroke="#4d9dff" fill="rgba(77,157,255,.12)" domain={positionDomain} timeDomain={timeDomain} timeTicks={miniTimeTicks} yFormatter={formatAxisQty} tooltipFormatter={(v) => fmtNumber(v, 6)} spanMs={chartSpanMs} type="stepAfter" referenceValue={0}/>
              <MiniChart title="Available balance" value={fmtMoney(latestPoint?.available_balance)} data={filteredPoints} dataKey="available_balance" stroke="#ffc24b" fill="rgba(255,194,75,.12)" domain={balanceDomain} timeDomain={timeDomain} timeTicks={miniTimeTicks} yFormatter={formatAxisMoney} tooltipFormatter={fmtMoney} spanMs={chartSpanMs}/>
            </div>
          </> : <Empty>Графік з’явиться після перших оброблених свічок.</Empty>}
        </section>}

        {tab === "Cycles" && <TableWrap><table className={styles.table}><thead><tr><th>Cycle</th><th>Started</th><th>Closed</th><th>Duration</th><th>Time in loss</th><th>Entries</th><th>Max position</th><th>Worst open PnL</th><th>Net PnL</th><th></th></tr></thead><tbody>{cycles.map((cycle)=><tr key={cycle.id}><td><strong>#{cycle.cycle_number}</strong><StatusBadge status={cycle.status}/></td><td>{new Date(cycle.started_at_ms).toLocaleString("uk-UA")}</td><td>{cycle.closed_at_ms?new Date(cycle.closed_at_ms).toLocaleString("uk-UA"):"Open"}</td><td>{duration(cycle.duration_seconds)}</td><td>{duration(cycle.time_in_loss_seconds)}</td><td>{cycle.entries_filled}</td><td>{fmtNumber(cycle.max_position_qty,6)}<small>{fmtMoney(cycle.max_position_value)}</small></td><td><PnlValue value={cycle.max_unrealized_loss}>{fmtMoneySigned(cycle.max_unrealized_loss)}</PnlValue></td><td><PnlValue value={cycle.net_pnl}>{fmtMoneySigned(cycle.net_pnl)}</PnlValue></td><td><button className={styles.jump} onClick={()=>{setCycleFilter(String(cycle.cycle_number));setTab("Chart")}}><Crosshair size={14}/> Chart</button></td></tr>)}</tbody></table>{!cycles.length&&<Empty/>}</TableWrap>}

        {tab === "Orders" && <TableWrap><div className={styles.tableFilters}>{["all","open","filled","cancelled","rejected"].map((item)=><button key={item} className={orderFilter===item?styles.activeFilter:""} onClick={()=>setOrderFilter(item)}>{item}</button>)}</div><table className={styles.table}><thead><tr><th>Time</th><th>Side</th><th>Type</th><th>Role</th><th>Qty</th><th>Price</th><th>Status</th><th>Exchange ID</th><th></th></tr></thead><tbody>{filteredOrders.map((order)=><tr key={order.id}><td>{fmtDateTime(order.created_at)}</td><td><SideBadge side={order.side}/></td><td><OrderTypeBadge type={order.order_type} reduceOnly={order.raw_response?.reduceOnly}/></td><td><RoleBadge role={order.order_role} linkId={order.order_link_id}/></td><td>{fmtNumber(order.qty,6)}</td><td>{order.price?fmtMoney(order.price):"Market"}</td><td><StatusBadge status={order.status}/></td><td className={styles.mono} title={order.exchange_order_id}>{order.exchange_order_id?.slice(0,10)||"—"}</td><td><button className={styles.jump} onClick={()=>jumpToChart(order.updated_at)}><Crosshair size={14}/></button></td></tr>)}</tbody></table>{!filteredOrders.length&&<Empty/>}</TableWrap>}

        {tab === "Executions" && <TableWrap><table className={styles.table}><thead><tr><th>Time</th><th>Side</th><th>Price</th><th>Qty</th><th>Fee</th><th>Closed PnL</th><th>Execution ID</th><th></th></tr></thead><tbody>{orderedExecutions.map((item)=><tr key={item.execId}><td>{new Date(asMs(item.execTime)).toLocaleString("uk-UA")}</td><td><SideBadge side={item.side}/></td><td>{fmtMoney(asNumber(item.execPrice))}</td><td>{fmtNumber(asNumber(item.execQty),6)}</td><td>{fmtMoney(asNumber(item.execFee))}</td><td><PnlValue value={item.closedPnl}>{fmtMoneySigned(asNumber(item.closedPnl))}</PnlValue></td><td className={styles.mono}>{item.execId.slice(0,10)}</td><td><button className={styles.jump} onClick={()=>jumpToChart(item.execTime)}><Crosshair size={14}/></button></td></tr>)}</tbody></table>{!orderedExecutions.length&&<Empty/>}</TableWrap>}

        {tab === "Positions" && <TableWrap><table className={styles.table}><thead><tr><th>Time</th><th>Action</th><th>Qty before</th><th>Qty after</th><th>Fill price</th><th>Average entry after</th><th>Closed PnL</th><th></th></tr></thead><tbody>{positionTimeline.map((item)=><tr key={`position-${item.execId}`}><td>{new Date(asMs(item.execTime)).toLocaleString("uk-UA")}</td><td><SideBadge side={item.side}/><RoleBadge role={item.role}/></td><td>{fmtNumber(item.before,6)}</td><td>{fmtNumber(item.after,6)}</td><td>{fmtMoney(asNumber(item.execPrice))}</td><td>{item.average?fmtMoney(item.average):"—"}</td><td><PnlValue value={item.closedPnl}>{fmtMoneySigned(asNumber(item.closedPnl))}</PnlValue></td><td><button className={styles.jump} onClick={()=>jumpToChart(item.execTime)}><Crosshair size={14}/></button></td></tr>)}</tbody></table>{!positionTimeline.length&&<Empty/>}</TableWrap>}

        {tab === "Events" && <div><div className={styles.tableFilters}>{["important","all","risk","errors"].map((item)=><button key={item} className={eventFilter===item?styles.activeFilter:""} onClick={()=>setEventFilter(item)}>{item}</button>)}</div><div className={styles.eventList}>{filteredEvents.map((event)=><article key={event.id}><div><EventBadge type={event.event_type}/><strong>{event.message}</strong></div><time>{fmtDateTime(event.created_at)}</time>{event.payload&&<pre>{JSON.stringify(event.payload,null,2)}</pre>}</article>)}{!filteredEvents.length&&<Empty/>}</div></div>}

        {tab === "Configuration" && <div className={styles.configGrid}><section className={styles.panel}><h2>Bot snapshot</h2><Config data={run.bot_snapshot}/></section><section className={styles.panel}><h2>Backtest configuration</h2><Config data={run.configuration}/></section><section className={styles.panel}><h2>Technical</h2><Config data={{run_id:run.id,temp_bot_id:run.temp_bot_id,emulator_account_id:run.emulator_account_id,created_at:run.created_at,started_at:run.started_at,completed_at:run.completed_at,candles:run.total_candles}}/></section></div>}
      </div>
    </main>
  );
}

function TableWrap({ children }) { return <section className={styles.tableWrap}>{children}</section>; }
function Config({ data }) { return <dl className={styles.config}>{Object.entries(data||{}).map(([key,value])=><div key={key}><dt>{key.replaceAll("_"," ")}</dt><dd>{typeof value==="object"?<pre>{JSON.stringify(value,null,2)}</pre>:String(value??"—")}</dd></div>)}</dl>; }
