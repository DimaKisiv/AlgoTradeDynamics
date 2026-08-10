import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area, AreaChart, Brush, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowLeft, CirclePause, CirclePlay, Copy, Crosshair, LoaderCircle, Minus, MoveHorizontal,
  OctagonX, Plus, RotateCcw, X,
} from "lucide-react";

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
const HOUR_MS = 3600000;
const WINDOW_MS = {
  "1d": DAY_MS,
  "1w": 7 * DAY_MS,
  "1m": 30 * DAY_MS,
  "3m": 90 * DAY_MS,
  "6m": 180 * DAY_MS,
};
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

function clampRange(start, end, minimum, maximum) {
  if (![start, end, minimum, maximum].every(Number.isFinite) || maximum <= minimum) return [minimum, maximum];
  const fullSpan = maximum - minimum;
  const requestedSpan = Math.min(Math.max(end - start, 1), fullSpan);
  let nextStart = start;
  let nextEnd = end;
  if (nextStart < minimum) {
    nextStart = minimum;
    nextEnd = minimum + requestedSpan;
  }
  if (nextEnd > maximum) {
    nextEnd = maximum;
    nextStart = maximum - requestedSpan;
  }
  return [Math.max(nextStart, minimum), Math.min(nextEnd, maximum)];
}

function closestIndex(data, timestamp, direction = "start") {
  if (!data.length) return 0;
  let low = 0;
  let high = data.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (data[middle].timestamp < timestamp) low = middle + 1;
    else high = middle;
  }
  if (direction === "end" && data[low]?.timestamp > timestamp) return Math.max(0, low - 1);
  return low;
}

function medianSpacing(data) {
  if (data.length < 2) return HOUR_MS;
  const spacings = [];
  const step = Math.max(1, Math.floor((data.length - 1) / 250));
  for (let index = step; index < data.length; index += step) {
    const spacing = data[index].timestamp - data[index - step].timestamp;
    if (spacing > 0) spacings.push(spacing / step);
  }
  spacings.sort((a, b) => a - b);
  return spacings[Math.floor(spacings.length / 2)] || HOUR_MS;
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
      <span>Equity {fmtMoney(row.equity)} · Available {fmtMoney(row.available_balance)}</span>
      <span>Position {fmtNumber(row.position_qty, 6)} · Drawdown {formatAxisPercent(row.drawdown_percent)}</span>
      <span>Open PnL {fmtMoneySigned(row.unrealized_pnl)}</span>
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

function OrderMarker({ cx, cy, payload, onSelect }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const isTp = payload.role?.includes("take_profit") || payload.role?.includes("tp");
  const compact = Boolean(payload.compact);
  const clustered = Number(payload.count || 1) > 1;
  const radius = clustered ? (compact ? 8.5 : 10) : compact ? 4.2 : 6;
  const fill = payload.kind === "cancelled" ? "#929bb0" : isTp ? "#b98cff" : "#25c78b";
  const title = `${payload.label} · ${fmtMoney(payload.price)} · ${fmtNumber(payload.qty, 6)} · ${new Date(payload.timestamp).toLocaleString("uk-UA")}`;
  const commonProps = {
    "data-order-marker": true,
    onPointerDown: (event) => event.stopPropagation(),
    onClick: (event) => { event.stopPropagation(); onSelect?.(payload); },
  };
  if (payload.kind === "cancelled") {
    const size = compact ? 3.5 : 5;
    return <g transform={`translate(${cx},${cy})`} className={styles.orderMarker} {...commonProps}><title>{title}</title><path d={`M-${size} -${size} L${size} ${size} M${size} -${size} L-${size} ${size}`} stroke={fill} strokeWidth={compact ? 1.7 : 2.3}/></g>;
  }
  return <g transform={`translate(${cx},${cy})`} className={styles.orderMarker} {...commonProps}>
    <title>{title}</title>
    <circle r={radius} fill={fill} stroke="#090b12" strokeWidth={compact ? 1.4 : 2}/>
    {clustered
      ? <text textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={compact ? 8 : 9} fontWeight="800">{payload.count}</text>
      : <path d={isTp ? "M-3 2 L0 -2 L3 2" : "M-3 -2 L0 2 L3 -2"} fill="none" stroke="#fff" strokeWidth={compact ? 1 : 1.3}/>
    }
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
      <AreaChart data={data} syncId={CHART_SYNC_ID} syncMethod="value" margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
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
  const [viewRange, setViewRange] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const chartInteractionRef = useRef(null);
  const dragRef = useRef(null);
  const pendingRangeRef = useRef(null);
  const previousCycleFilterRef = useRef(cycleFilter);

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
  const isScalper = run?.bot_snapshot?.strategy_type === "pattern_scalper";

  const normalizedPoints = useMemo(() => points
    .map((point) => ({ ...point, timestamp: asMs(point.timestamp) }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp), [points]);

  const cycleBasePoints = useMemo(() => {
    if (cycleFilter === "all") return normalizedPoints;
    const cycle = cycles.find((item) => String(item.cycle_number) === cycleFilter);
    if (!cycle || !normalizedPoints.length) return normalizedPoints;
    const startedAt = asMs(cycle.started_at_ms);
    const closedAt = cycle.closed_at_ms ? asMs(cycle.closed_at_ms) : asMs(run?.end_time);
    const cycleSpan = Math.max(closedAt - startedAt, DAY_MS);
    const padding = Math.max(cycleSpan * 0.08, 6 * HOUR_MS);
    return normalizedPoints.filter((point) => point.timestamp >= startedAt - padding && point.timestamp <= closedAt + padding);
  }, [normalizedPoints, cycles, cycleFilter, run?.end_time]);

  const baseStart = cycleBasePoints[0]?.timestamp;
  const baseEnd = cycleBasePoints[cycleBasePoints.length - 1]?.timestamp;

  useEffect(() => {
    if (!Number.isFinite(baseStart) || !Number.isFinite(baseEnd)) return;
    const cycleChanged = previousCycleFilterRef.current !== cycleFilter;
    previousCycleFilterRef.current = cycleFilter;
    setViewRange((current) => {
      if (pendingRangeRef.current) {
        const pending = pendingRangeRef.current;
        pendingRangeRef.current = null;
        return clampRange(pending[0], pending[1], baseStart, baseEnd);
      }
      if (!current || cycleChanged) return [baseStart, baseEnd];
      return clampRange(current[0], current[1], baseStart, baseEnd);
    });
    if (cycleChanged) {
      if (!focusTime) setWindowSize("all");
      setSelectedMarker(null);
    }
  }, [baseStart, baseEnd, cycleFilter, focusTime]);

  const effectiveRange = viewRange && Number.isFinite(baseStart) && Number.isFinite(baseEnd)
    ? clampRange(viewRange[0], viewRange[1], baseStart, baseEnd)
    : [baseStart, baseEnd];

  const filteredPoints = useMemo(() => {
    if (!cycleBasePoints.length || !effectiveRange.every(Number.isFinite)) return [];
    return cycleBasePoints.filter((point) => point.timestamp >= effectiveRange[0] && point.timestamp <= effectiveRange[1]);
  }, [cycleBasePoints, effectiveRange[0], effectiveRange[1]]);

  const orderByExchangeId = useMemo(() => new Map(orders.map((order) => [String(order.exchange_order_id), order])), [orders]);

  const markers = useMemo(() => {
    const result = [];
    executions.forEach((execution) => {
      const order = orderByExchangeId.get(String(execution.orderId));
      const role = order?.order_role || (String(execution.side).toLowerCase() === "sell" ? "position_take_profit" : "grid_entry");
      const isScalperEntry = role.startsWith("scalper_entry");
      const isScalperExit = role.startsWith("scalper_") && !isScalperEntry;
      const isTp = role.includes("take_profit") || role.includes("tp");
      const isExit = isTp || isScalperExit;
      if (isExit && !filters.tp) return;
      if (!isExit && !filters.entries) return;
      const level = String(order?.order_link_id || "").match(/entry-(\d+)/)?.[1];
      result.push({
        id: `execution-${execution.execId || `${execution.execTime}-${execution.execSeq}`}`,
        executionId: execution.execId,
        orderId: execution.orderId,
        timestamp: asMs(execution.execTime),
        sequence: asNumber(execution.execSeq),
        price: asNumber(execution.execPrice),
        qty: asNumber(execution.execQty),
        fee: asNumber(execution.execFee),
        closedPnl: asNumber(execution.closedPnl),
        side: execution.side,
        role,
        label: role.includes("stop_loss") ? "Stop loss filled"
          : role.includes("timeout") ? "Timeout exit filled"
          : role.includes("manual_close") ? "End-of-test exit filled"
          : isTp ? "Take profit filled"
          : isScalperEntry ? (role.includes("short") ? "SHORT entry filled" : "LONG entry filled")
          : `Grid #${level || "?"} filled`,
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
          orderId: order.exchange_order_id,
          timestamp: asMs(order.updated_at),
          sequence: Number.MAX_SAFE_INTEGER,
          price: asNumber(order.price),
          qty: asNumber(order.qty),
          side: order.side,
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

  const chartSpanMs = Number.isFinite(effectiveRange[0]) && Number.isFinite(effectiveRange[1])
    ? Math.max(effectiveRange[1] - effectiveRange[0], 0)
    : chartSpan(filteredPoints);
  const compactMarkers = chartSpanMs > 90 * DAY_MS || filteredPoints.length > 700;

  const visibleMarkers = useMemo(() => {
    if (!filteredPoints.length) return [];
    const min = filteredPoints[0].timestamp;
    const max = filteredPoints[filteredPoints.length - 1].timestamp;
    return markers
      .filter((marker) => marker.timestamp >= min && marker.timestamp <= max)
      .map((marker) => ({ ...marker, compact: compactMarkers }));
  }, [markers, filteredPoints, compactMarkers]);

  const displayMarkers = useMemo(() => {
    if (chartSpanMs <= 120 * DAY_MS || visibleMarkers.length <= 55) return visibleMarkers;
    const start = filteredPoints[0]?.timestamp || 0;
    const bucketSize = Math.max(chartSpanMs / 110, DAY_MS / 2);
    const groups = new Map();
    visibleMarkers.forEach((marker) => {
      const isTp = marker.role?.includes("take_profit") || marker.role?.includes("tp");
      const markerType = marker.kind === "cancelled" ? "cancelled" : isTp ? "tp" : "entry";
      const key = `${markerType}-${Math.floor((marker.timestamp - start) / bucketSize)}`;
      const group = groups.get(key) || [];
      group.push(marker);
      groups.set(key, group);
    });
    return [...groups.values()].map((group) => {
      if (group.length === 1) return group[0];
      const first = group[0];
      const totalQty = group.reduce((sum, item) => sum + item.qty, 0);
      const weightedPrice = totalQty > 0
        ? group.reduce((sum, item) => sum + (item.price * item.qty), 0) / totalQty
        : group.reduce((sum, item) => sum + item.price, 0) / group.length;
      const isTp = first.role?.includes("take_profit") || first.role?.includes("tp");
      return {
        ...first,
        id: `cluster-${first.id}`,
        timestamp: Math.round(group.reduce((sum, item) => sum + item.timestamp, 0) / group.length),
        price: weightedPrice,
        qty: totalQty,
        fee: group.reduce((sum, item) => sum + asNumber(item.fee), 0),
        closedPnl: group.reduce((sum, item) => sum + asNumber(item.closedPnl), 0),
        count: group.length,
        compact: true,
        clusterItems: group,
        label: `${group.length} ${first.kind === "cancelled" ? "cancelled orders" : isTp ? "take-profit fills" : "entry fills"}`,
      };
    });
  }, [visibleMarkers, filteredPoints, chartSpanMs]);

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
  const periodStart = effectiveRange[0] ?? filteredPoints[0]?.timestamp;
  const periodEnd = effectiveRange[1] ?? latestPoint?.timestamp;
  const timeDomain = useMemo(() => [periodStart, periodEnd], [periodStart, periodEnd]);
  const mainTimeTicks = useMemo(() => buildTimeTicks(periodStart, periodEnd, 8), [periodStart, periodEnd]);
  const miniTimeTicks = useMemo(() => buildTimeTicks(periodStart, periodEnd, 5), [periodStart, periodEnd]);
  const priceBandSize = Math.max(priceDomain[1] - priceDomain[0], 1) * 0.012;
  const openCycle = cycles.find((cycle) => String(cycle.status).toLowerCase() === "open" || !cycle.closed_at_ms);
  const selectedCycle = cycleFilter === "all"
    ? null
    : cycles.find((cycle) => String(cycle.cycle_number) === cycleFilter) || null;
  const openCycleStart = openCycle ? asMs(openCycle.started_at_ms) : null;
  const showOpenCycleStart = openCycleStart != null && openCycleStart >= periodStart && openCycleStart <= periodEnd;
  const minimumViewSpan = useMemo(
    () => Math.max(medianSpacing(cycleBasePoints) * 8, 6 * HOUR_MS),
    [cycleBasePoints],
  );
  const fullRangeSpan = Number.isFinite(baseStart) && Number.isFinite(baseEnd) ? baseEnd - baseStart : 0;
  const currentRangeSpan = Number.isFinite(periodStart) && Number.isFinite(periodEnd) ? periodEnd - periodStart : 0;
  const isFullRange = fullRangeSpan > 0 && Math.abs(currentRangeSpan - fullRangeSpan) <= Math.max(minimumViewSpan * 0.1, 1);
  const navigatorStartIndex = cycleBasePoints.length && Number.isFinite(periodStart)
    ? closestIndex(cycleBasePoints, periodStart, "start")
    : 0;
  const navigatorEndIndex = cycleBasePoints.length && Number.isFinite(periodEnd)
    ? closestIndex(cycleBasePoints, periodEnd, "end")
    : Math.max(cycleBasePoints.length - 1, 0);

  const setClampedViewRange = useCallback((start, end, mode = "custom") => {
    if (![baseStart, baseEnd, start, end].every(Number.isFinite)) return;
    let nextStart = start;
    let nextEnd = end;
    if (nextEnd - nextStart < minimumViewSpan) {
      const center = (nextStart + nextEnd) / 2;
      nextStart = center - (minimumViewSpan / 2);
      nextEnd = center + (minimumViewSpan / 2);
    }
    setViewRange(clampRange(nextStart, nextEnd, baseStart, baseEnd));
    setWindowSize(mode);
  }, [baseStart, baseEnd, minimumViewSpan]);

  const resetChartView = useCallback(() => {
    if (![baseStart, baseEnd].every(Number.isFinite)) return;
    setViewRange([baseStart, baseEnd]);
    setWindowSize("all");
    setFocusTime(null);
    setSelectedMarker(null);
  }, [baseStart, baseEnd]);

  const applyWindowPreset = useCallback((preset) => {
    if (![baseStart, baseEnd].every(Number.isFinite)) return;
    if (preset === "all") {
      resetChartView();
      return;
    }
    const span = Math.min(WINDOW_MS[preset] || fullRangeSpan, fullRangeSpan);
    const anchor = Number.isFinite(focusTime) ? focusTime : baseEnd;
    const start = Number.isFinite(focusTime) ? anchor - (span / 2) : anchor - span;
    const end = Number.isFinite(focusTime) ? anchor + (span / 2) : anchor;
    setClampedViewRange(start, end, preset);
  }, [baseStart, baseEnd, focusTime, fullRangeSpan, resetChartView, setClampedViewRange]);

  const zoomChart = useCallback((factor, anchorRatio = 0.5) => {
    if (![periodStart, periodEnd, baseStart, baseEnd].every(Number.isFinite)) return;
    const span = periodEnd - periodStart;
    const nextSpan = Math.min(Math.max(span * factor, minimumViewSpan), fullRangeSpan);
    const anchor = periodStart + (span * Math.min(Math.max(anchorRatio, 0), 1));
    const nextStart = anchor - (nextSpan * anchorRatio);
    const nextEnd = nextStart + nextSpan;
    setClampedViewRange(nextStart, nextEnd, nextSpan >= fullRangeSpan * 0.999 ? "all" : "custom");
  }, [periodStart, periodEnd, baseStart, baseEnd, minimumViewSpan, fullRangeSpan, setClampedViewRange]);

  const panChart = useCallback((shiftMs) => {
    if (![periodStart, periodEnd].every(Number.isFinite)) return;
    setClampedViewRange(periodStart + shiftMs, periodEnd + shiftMs, "custom");
  }, [periodStart, periodEnd, setClampedViewRange]);

  const handleChartWheel = useCallback((event) => {
    if (!chartInteractionRef.current || !currentRangeSpan) return;
    event.preventDefault();
    if (event.shiftKey) {
      panChart(event.deltaY * currentRangeSpan * 0.0015);
      return;
    }
    const bounds = chartInteractionRef.current.getBoundingClientRect();
    const anchorRatio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0.5;
    zoomChart(Math.exp(event.deltaY * 0.0014), anchorRatio);
  }, [currentRangeSpan, panChart, zoomChart]);

  const handleChartPointerDown = useCallback((event) => {
    if (event.button !== 0 || event.target.closest?.("[data-order-marker]")) return;
    const bounds = chartInteractionRef.current?.getBoundingClientRect();
    if (!bounds?.width) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRange: [periodStart, periodEnd],
      width: bounds.width,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsPanning(true);
  }, [periodStart, periodEnd]);

  const handleChartPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const span = drag.startRange[1] - drag.startRange[0];
    const shift = -((event.clientX - drag.startX) / drag.width) * span;
    if (Math.abs(event.clientX - drag.startX) > 2) setFocusTime(null);
    setClampedViewRange(drag.startRange[0] + shift, drag.startRange[1] + shift, "custom");
  }, [setClampedViewRange]);

  const finishChartPan = useCallback((event) => {
    if (!dragRef.current) return;
    event.currentTarget.releasePointerCapture?.(dragRef.current.pointerId);
    dragRef.current = null;
    setIsPanning(false);
  }, []);

  const handleBrushChange = useCallback((range) => {
    if (!range || !cycleBasePoints.length) return;
    const startPoint = cycleBasePoints[range.startIndex];
    const endPoint = cycleBasePoints[range.endIndex];
    if (!startPoint || !endPoint) return;
    setClampedViewRange(startPoint.timestamp, endPoint.timestamp, "custom");
    setFocusTime(null);
  }, [cycleBasePoints, setClampedViewRange]);

  useEffect(() => {
    if (tab !== "Chart") return undefined;
    const element = chartInteractionRef.current;
    if (!element) return undefined;
    const listener = (event) => handleChartWheel(event);
    element.addEventListener("wheel", listener, { passive: false });
    return () => element.removeEventListener("wheel", listener);
  }, [tab, handleChartWheel]);

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
      const order = byExchangeId.get(String(item.orderId));
      const role = order?.order_role || (isBuy ? "grid_entry" : "position_take_profit");
      if (role === "scalper_entry_long") {
        qty = fillQty;
        avg = price;
      } else if (role === "scalper_entry_short") {
        qty = -fillQty;
        avg = price;
      } else if (role.startsWith("scalper_") && !role.startsWith("scalper_entry")) {
        qty = 0;
        avg = 0;
      } else if (isBuy) {
        const absoluteBefore = Math.max(before, 0);
        qty += fillQty;
        avg = qty > 0 ? ((absoluteBefore * avg) + (fillQty * price)) / qty : 0;
      } else {
        qty = Math.max(qty - fillQty, 0);
        if (qty === 0) avg = 0;
      }
      return { ...item, before, after: qty, average: avg, role };
    });
  }, [orderedExecutions, orders]);

  const filteredEvents = useMemo(() => events.filter((event) => {
    const type = String(event.event_type || "").toLowerCase();
    if (eventFilter === "all") return true;
    if (eventFilter === "errors") return /error|failed|reject/.test(type);
    if (eventFilter === "risk") return /risk|blocked|limit|warning/.test(type);
    return /filled|created|entered|signal|cancel|completed|started|stopped|risk|error|failed/.test(type);
  }), [events, eventFilter]);

  const selectedMarkerCycle = useMemo(() => {
    if (!selectedMarker) return null;
    return cycles.find((cycle) => {
      const startedAt = asMs(cycle.started_at_ms);
      const closedAt = cycle.closed_at_ms ? asMs(cycle.closed_at_ms) : asMs(run?.end_time);
      return selectedMarker.timestamp >= startedAt && selectedMarker.timestamp <= closedAt;
    }) || null;
  }, [selectedMarker, cycles, run?.end_time]);

  const jumpToChart = (timestamp) => {
    const target = asMs(timestamp);
    if (!Number.isFinite(target)) return;
    pendingRangeRef.current = [target - (DAY_MS / 2), target + (DAY_MS / 2)];
    setCycleFilter("all");
    setFocusTime(target);
    setWindowSize("custom");
    setTab("Chart");
  };

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
              <Metric label="Closed cycles" value={metrics.closed_cycles ?? 0}/><Metric label="Winning" value={metrics.winning_cycles ?? 0}/><Metric label="Losing" value={metrics.losing_cycles ?? 0}/><Metric label="Executions" value={metrics.executions_count ?? 0}/>{isScalper && <Metric label="LONG trades" value={metrics.long_trades ?? 0}/>} {isScalper && <Metric label="SHORT trades" value={metrics.short_trades ?? 0}/>}<Metric label="Final position" value={fmtNumber(metrics.open_position_qty,6)}/><Metric label="Avg entry at end" value={metrics.open_avg_entry_price?fmtMoney(metrics.open_avg_entry_price):"—"}/>
            </div></section>
            {isScalper && <section className={styles.panel}><h2>Scalper exits</h2><div className={styles.metricGrid}>
              <Metric label="Take profit" value={metrics.take_profit_cycles ?? 0} hint={fmtMoneySigned(metrics.take_profit_net_pnl ?? 0)}/><Metric label="Stop loss" value={metrics.stop_loss_cycles ?? 0} hint={fmtMoneySigned(metrics.stop_loss_net_pnl ?? 0)}/><Metric label="Timeout" value={metrics.timeout_cycles ?? 0} hint={fmtMoneySigned(metrics.timeout_net_pnl ?? 0)}/><Metric label="Other exits" value={metrics.other_exit_cycles ?? 0} hint={fmtMoneySigned(metrics.other_exit_net_pnl ?? 0)}/><Metric label="Avg fee / cycle" value={fmtMoney(metrics.average_fee_per_cycle ?? 0)}/>
            </div></section>}
            {isScalper && Array.isArray(metrics.pattern_performance) && metrics.pattern_performance.length > 0 && <section className={styles.panel}><h2>Pattern performance</h2><div className={styles.metricGrid}>
              {metrics.pattern_performance.map((item) => <Metric key={item.pattern} label={String(item.pattern || "unknown").replaceAll("_", " ")} value={`${item.trades ?? 0} trades`} hint={`${fmtMoneySigned(item.net_pnl ?? 0)} · ${fmtNumber(item.win_rate_percent ?? 0, 1)}% wins`}/>)}
            </div></section>}
          </div>
        </>}

        {tab === "Chart" && <section className={styles.chartPanel}>
          <div className={styles.chartToolbar}>
            <div className={styles.checks}>
              <ChartToggle checked={filters.entries} onChange={(e) => setFilters({ ...filters, entries: e.target.checked })} label="Entry fills" color="#25c78b"/>
              <ChartToggle checked={filters.tp} onChange={(e) => setFilters({ ...filters, tp: e.target.checked })} label={isScalper ? "Exit fills" : "Take-profit fills"} color="#b98cff"/>
              <ChartToggle checked={filters.cancelled} onChange={(e) => setFilters({ ...filters, cancelled: e.target.checked })} label="Cancelled orders" color="#929bb0"/>
              <ChartToggle checked={filters.position} onChange={(e) => setFilters({ ...filters, position: e.target.checked })} label="Position open" color="#4d9dff" type="band"/>
              <ChartToggle checked={filters.loss} onChange={(e) => setFilters({ ...filters, loss: e.target.checked })} label="Open loss" color="#f05b63" type="band"/>
            </div>
            <div className={styles.chartSelects}>
              <select value={cycleFilter} onChange={(e) => { setCycleFilter(e.target.value); setFocusTime(null); setSelectedMarker(null); }}>
                <option value="all">All cycles</option>
                {cycles.map((cycle) => <option key={cycle.id} value={cycle.cycle_number}>Cycle #{cycle.cycle_number}</option>)}
              </select>
              {["1d", "1w", "1m", "3m", "6m", "all"].map((item) => <button key={item} className={windowSize === item ? styles.activeWindow : ""} onClick={() => applyWindowPreset(item)}>{item.toUpperCase()}</button>)}
              {windowSize === "custom" && <span className={styles.customWindow}>CUSTOM</span>}
              <span className={styles.toolbarDivider}/>
              <button className={styles.iconWindowButton} title="Zoom in" onClick={() => zoomChart(0.65)}><Plus size={14}/></button>
              <button className={styles.iconWindowButton} title="Zoom out" onClick={() => zoomChart(1.5)}><Minus size={14}/></button>
              <button className={styles.iconWindowButton} title="Reset chart" disabled={isFullRange && !focusTime} onClick={resetChartView}><RotateCcw size={14}/></button>
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
            <div className={styles.chartHint}><MoveHorizontal size={13}/> Scroll to zoom around the pointer · drag to pan · Shift + scroll to move horizontally · double-click to reset. The blue strip is position time, the red strip is open loss, and markers show fills.</div>
            {selectedMarker && <div className={styles.markerDetails}>
              <div className={styles.markerDetailsHeader}>
                <div><span>{selectedMarker.count > 1 ? "Fill cluster" : selectedMarker.kind === "cancelled" ? "Cancelled order" : "Execution"}</span><strong>{selectedMarker.label}</strong></div>
                <button onClick={() => setSelectedMarker(null)} title="Close details"><X size={16}/></button>
              </div>
              <div className={styles.markerDetailsGrid}>
                <div><span>Time</span><strong>{new Date(selectedMarker.timestamp).toLocaleString("uk-UA")}</strong></div>
                <div><span>Price</span><strong>{fmtMoney(selectedMarker.price)}</strong></div>
                <div><span>Quantity</span><strong>{fmtNumber(selectedMarker.qty, 6)}</strong></div>
                <div><span>Side</span><strong>{selectedMarker.side || (selectedMarker.role?.includes("take_profit") ? "Sell" : "Buy")}</strong></div>
                <div><span>Cycle</span><strong>{selectedMarker.count > 1 ? "Multiple" : selectedMarkerCycle ? `#${selectedMarkerCycle.cycle_number}` : "—"}</strong></div>
                {selectedMarker.kind === "filled" && <><div><span>Fee</span><strong>{fmtMoney(selectedMarker.fee)}</strong></div><div><span>Closed PnL</span><strong>{fmtMoneySigned(selectedMarker.closedPnl)}</strong></div></>}
              </div>
              {selectedMarker.clusterItems?.length > 1 && <div className={styles.clusterList}>{selectedMarker.clusterItems.slice(0, 8).map((item) => <button key={item.id} onClick={() => { setSelectedMarker(item); setFocusTime(item.timestamp); setClampedViewRange(item.timestamp - (DAY_MS / 2), item.timestamp + (DAY_MS / 2), "custom"); }}><span>{new Date(item.timestamp).toLocaleDateString("uk-UA")}</span><strong>{item.label}</strong><em>{fmtMoney(item.price)}</em></button>)}{selectedMarker.clusterItems.length > 8 && <small>+{selectedMarker.clusterItems.length - 8} more fills — zoom in to separate them</small>}</div>}
            </div>}
            <div
              ref={chartInteractionRef}
              className={`${styles.priceChart} ${isPanning ? styles.panning : ""}`}
              onPointerDown={handleChartPointerDown}
              onPointerMove={handleChartPointerMove}
              onPointerUp={finishChartPan}
              onPointerCancel={finishChartPan}
              onDoubleClick={resetChartView}
            >
              <ResponsiveContainer width="100%" height={470}>
                <ComposedChart data={filteredPoints} syncId={CHART_SYNC_ID} syncMethod="value" margin={{ top: 18, right: 18, left: 4, bottom: 14 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/>
                  <XAxis dataKey="timestamp" type="number" scale="time" domain={timeDomain} ticks={mainTimeTicks} allowDataOverflow height={38} tickMargin={10} tickFormatter={(v) => formatChartTime(v, chartSpanMs)} stroke="#68718a" tick={{ fontSize: 11 }}/>
                  <YAxis domain={priceDomain} width={82} tickFormatter={formatAxisMoney} stroke="#68718a" tick={{ fontSize: 11 }}/>
                  <Tooltip content={<PriceTooltip/>} cursor={{ stroke: "rgba(255,255,255,.22)", strokeDasharray: "3 3" }}/>
                  {openCycleStart != null && openCycleStart < periodEnd && <ReferenceArea x1={Math.max(openCycleStart, periodStart)} x2={periodEnd} y1={priceDomain[0]} y2={priceDomain[1]} fill="#ffc24b" fillOpacity={0.035} strokeOpacity={0}/>} 
                  {positionRanges.map(([x1, x2], index) => <ReferenceArea key={`position-${index}`} x1={x1} x2={x2} y1={priceDomain[0]} y2={priceDomain[0] + priceBandSize} fill="#4d9dff" fillOpacity={0.75} strokeOpacity={0}/>) }
                  {lossRanges.map(([x1, x2], index) => <ReferenceArea key={`loss-${index}`} x1={x1} x2={x2} y1={priceDomain[0] + priceBandSize} y2={priceDomain[0] + (priceBandSize * 2)} fill="#f05b63" fillOpacity={0.75} strokeOpacity={0}/>) }
                  <Line type="monotone" dataKey="close" name="Close" stroke="#d8dde9" strokeWidth={1.7} dot={false} activeDot={{ r: 3 }} isAnimationActive={false}/>
                  {displayMarkers.map((marker) => <ReferenceDot
                    key={marker.id}
                    x={marker.timestamp}
                    y={marker.price}
                    r={0}
                    ifOverflow="discard"
                    shape={(props) => <OrderMarker {...props} payload={marker} onSelect={(selected) => { setSelectedMarker(selected); setFocusTime(selected.timestamp); }}/>} 
                  />)}
                  {selectedCycle && selectedCycle !== openCycle && <ReferenceLine x={asMs(selectedCycle.started_at_ms)} stroke="#25c78b" strokeDasharray="3 4" label={{ value: `Cycle #${selectedCycle.cycle_number} entry`, position: "insideTopLeft", fill: "#25c78b", fontSize: 10 }}/>} 
                  {selectedCycle?.closed_at_ms && <ReferenceLine x={asMs(selectedCycle.closed_at_ms)} stroke="#b98cff" strokeDasharray="3 4" label={{ value: isScalper ? "Exit close" : "TP close", position: "insideTopRight", fill: "#b98cff", fontSize: 10 }}/>} 
                  {showOpenCycleStart && <ReferenceLine x={openCycleStart} stroke="#ffc24b" strokeDasharray="5 4" label={{ value: `Open cycle #${openCycle.cycle_number}`, position: "insideTopRight", fill: "#ffc24b", fontSize: 10 }}/>} 
                  {focusTime && focusTime >= periodStart && focusTime <= periodEnd && <ReferenceLine x={focusTime} stroke="#4d9dff" strokeDasharray="4 4"/>}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className={styles.navigatorChart}>
              <div className={styles.navigatorHeader}><span>Timeline navigator</span><strong>{formatPeriodTime(periodStart, chartSpanMs)} — {formatPeriodTime(periodEnd, chartSpanMs)}</strong></div>
              <ResponsiveContainer width="100%" height={82}>
                <AreaChart data={cycleBasePoints} margin={{ top: 4, right: 8, left: 8, bottom: 2 }}>
                  <XAxis dataKey="timestamp" type="number" scale="time" domain={[baseStart, baseEnd]} hide/>
                  <YAxis domain={paddedDomain(cycleBasePoints.map((point) => point.close), 0.04)} hide/>
                  <Area type="monotone" dataKey="close" stroke="#68718a" fill="rgba(104,113,138,.12)" strokeWidth={1.1} dot={false} isAnimationActive={false}/>
                  <Brush
                    dataKey="timestamp"
                    height={30}
                    travellerWidth={10}
                    startIndex={navigatorStartIndex}
                    endIndex={navigatorEndIndex}
                    onChange={handleBrushChange}
                    tickFormatter={(value) => formatChartTime(value, fullRangeSpan)}
                    stroke="#25c78b"
                    fill="#0a0d14"
                  />
                </AreaChart>
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
