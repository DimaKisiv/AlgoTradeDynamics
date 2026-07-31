import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area, AreaChart, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis,
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
  const row = payload[0]?.payload || {};
  return <div className={styles.tooltip}>
    <strong>{new Date(row.timestamp).toLocaleString("uk-UA")}</strong>
    {row.open != null && <><span>O {fmtNumber(row.open, 2)} · H {fmtNumber(row.high, 2)}</span><span>L {fmtNumber(row.low, 2)} · C {fmtNumber(row.close, 2)}</span></>}
    {row.label && <span>{row.label} · {row.status}</span>}
    {row.price != null && <span>Price {fmtNumber(row.price, 2)} · Qty {row.qty}</span>}
  </div>;
}

function OrderMarker({ cx, cy, payload }) {
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
  const isSell = payload.side === "Sell";
  const isTp = payload.role?.includes("take_profit") || payload.role?.includes("tp");
  const fill = payload.kind === "cancelled" ? "#929bb0"
    : payload.kind === "placed" ? (isTp ? "#b98cff" : "#4d9dff")
      : isSell ? "#f05b63" : "#25c78b";
  if (payload.kind === "cancelled") {
    return <g transform={`translate(${cx},${cy})`}><path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke={fill} strokeWidth="2.3"/></g>;
  }
  return <g transform={`translate(${cx},${cy})`}><circle r={payload.kind === "placed" ? 4.5 : 6} fill={fill} stroke="#090b12" strokeWidth="2"/><path d={isSell ? "M-3 2 L0 -2 L3 2" : "M-3 -2 L0 2 L3 -2"} fill="none" stroke="#fff" strokeWidth="1.3"/></g>;
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
  const filteredPoints = useMemo(() => {
    let data = points;
    if (cycleFilter !== "all") {
      const cycle = cycles.find((item) => String(item.cycle_number) === cycleFilter);
      if (cycle) data = data.filter((point) => point.timestamp >= cycle.started_at_ms && point.timestamp <= (cycle.closed_at_ms || run.end_time));
    }
    if (focusTime && windowSize !== "all") {
      const periods = { "1d": 86400000, "1w": 7 * 86400000, "1m": 30 * 86400000 };
      const span = periods[windowSize] || periods["1d"];
      data = data.filter((point) => point.timestamp >= focusTime - span / 2 && point.timestamp <= focusTime + span / 2);
    } else if (windowSize !== "all" && data.length) {
      const periods = { "1d": 86400000, "1w": 7 * 86400000, "1m": 30 * 86400000 };
      const end = data[data.length - 1].timestamp;
      data = data.filter((point) => point.timestamp >= end - periods[windowSize]);
    }
    return data;
  }, [points, cycles, cycleFilter, windowSize, focusTime, run]);

  const markers = useMemo(() => orders.flatMap((order) => {
    const role = order.order_role || "";
    const status = order.status || "";
    const isTp = role.includes("take_profit") || role.includes("tp");
    const cancelled = status.toLowerCase().includes("cancel");
    if (cancelled && !filters.cancelled) return [];
    if (!cancelled && role.includes("grid_entry") && !filters.entries) return [];
    if (!cancelled && isTp && !filters.tp) return [];
    const base = {
      price: asNumber(order.price), qty: order.qty, side: order.side, role,
      label: isTp ? "Position TP" : role.replaceAll("_", " "),
    };
    if (base.price <= 0) return [];
    const createdTime = asMs(order.created_at);
    const updatedTime = asMs(order.updated_at);
    const result = [{ ...base, timestamp: createdTime, status: "Placed", kind: "placed" }];
    if (status !== "New" && Math.abs(updatedTime - createdTime) > 1) {
      result.push({
        ...base, timestamp: updatedTime, status,
        kind: cancelled ? "cancelled" : status === "Filled" ? "filled" : "updated",
      });
    }
    return result;
  }), [orders, filters]);

  const visibleMarkers = useMemo(() => {
    if (!filteredPoints.length) return [];
    const min = filteredPoints[0].timestamp;
    const max = filteredPoints[filteredPoints.length - 1].timestamp;
    return markers.filter((marker) => marker.timestamp >= min && marker.timestamp <= max);
  }, [markers, filteredPoints]);

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
          <div className={styles.chartToolbar}><div className={styles.checks}>
            <label><input type="checkbox" checked={filters.entries} onChange={(e)=>setFilters({...filters,entries:e.target.checked})}/> Entries</label><label><input type="checkbox" checked={filters.tp} onChange={(e)=>setFilters({...filters,tp:e.target.checked})}/> Take profits</label><label><input type="checkbox" checked={filters.cancelled} onChange={(e)=>setFilters({...filters,cancelled:e.target.checked})}/> Cancelled</label><label><input type="checkbox" checked={filters.position} onChange={(e)=>setFilters({...filters,position:e.target.checked})}/> In position</label><label><input type="checkbox" checked={filters.loss} onChange={(e)=>setFilters({...filters,loss:e.target.checked})}/> Open loss</label>
          </div><div className={styles.chartSelects}><select value={cycleFilter} onChange={(e)=>{setCycleFilter(e.target.value);setFocusTime(null)}}><option value="all">All cycles</option>{cycles.map((cycle)=><option key={cycle.id} value={cycle.cycle_number}>Cycle #{cycle.cycle_number}</option>)}</select>{["1d","1w","1m","all"].map((item)=><button key={item} className={windowSize===item?styles.activeWindow:""} onClick={()=>setWindowSize(item)}>{item.toUpperCase()}</button>)}</div></div>
          {filteredPoints.length ? <>
            <div className={styles.priceChart}><ResponsiveContainer width="100%" height={430}><ComposedChart data={filteredPoints} margin={{top:20,right:22,left:8,bottom:10}}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin","dataMax"]} tickFormatter={(v)=>new Date(v).toLocaleDateString("uk-UA",{month:"short",day:"2-digit"})} stroke="#68718a"/><YAxis domain={["auto","auto"]} tickFormatter={(v)=>Number(v).toLocaleString("en-US",{notation:"compact"})} stroke="#68718a"/><Tooltip content={<PriceTooltip/>}/>{positionRanges.map(([x1,x2],index)=><ReferenceArea key={`position-${index}`} x1={x1} x2={x2} fill="#4d9dff" fillOpacity={0.045} strokeOpacity={0}/>) }{lossRanges.map(([x1,x2],index)=><ReferenceArea key={`loss-${index}`} x1={x1} x2={x2} fill="#f05b63" fillOpacity={0.09} strokeOpacity={0}/>) }<Line type="monotone" dataKey="close" stroke="#d8dde9" strokeWidth={1.5} dot={false} isAnimationActive={false}/><Scatter data={visibleMarkers} dataKey="price" shape={<OrderMarker/>} isAnimationActive={false}/>{focusTime&&<ReferenceLine x={focusTime} stroke="#ffc24b" strokeDasharray="4 4"/>}</ComposedChart></ResponsiveContainer></div>
            <div className={styles.subCharts}><div><h3>Equity</h3><ResponsiveContainer width="100%" height={190}><AreaChart data={filteredPoints}><CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false}/><XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin","dataMax"]} hide/><YAxis domain={["auto","auto"]} width={64} stroke="#68718a"/><Tooltip labelFormatter={(v)=>new Date(v).toLocaleString("uk-UA")} formatter={(v)=>fmtMoney(v)}/><Area dataKey="equity" stroke="#25c78b" fill="rgba(37,199,139,.12)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div><div><h3>Drawdown</h3><ResponsiveContainer width="100%" height={190}><AreaChart data={filteredPoints}><CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false}/><XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin","dataMax"]} hide/><YAxis width={64} stroke="#68718a" tickFormatter={(v)=>`${v.toFixed(0)}%`}/><Tooltip labelFormatter={(v)=>new Date(v).toLocaleString("uk-UA")} formatter={(v)=>`${Number(v).toFixed(2)}%`}/><Area dataKey="drawdown_percent" stroke="#f05b63" fill="rgba(240,91,99,.12)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div><div><h3>Position size</h3><ResponsiveContainer width="100%" height={190}><AreaChart data={filteredPoints}><CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false}/><XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin","dataMax"]} hide/><YAxis width={64} stroke="#68718a"/><Tooltip labelFormatter={(v)=>new Date(v).toLocaleString("uk-UA")} formatter={(v)=>fmtNumber(v,6)}/><Area dataKey="position_qty" stroke="#4d9dff" fill="rgba(77,157,255,.12)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div><div><h3>Available balance</h3><ResponsiveContainer width="100%" height={190}><AreaChart data={filteredPoints}><CartesianGrid stroke="rgba(255,255,255,.04)" vertical={false}/><XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin","dataMax"]} hide/><YAxis domain={["auto","auto"]} width={64} stroke="#68718a"/><Tooltip labelFormatter={(v)=>new Date(v).toLocaleString("uk-UA")} formatter={(v)=>fmtMoney(v)}/><Area dataKey="available_balance" stroke="#ffc24b" fill="rgba(255,194,75,.12)" isAnimationActive={false}/></AreaChart></ResponsiveContainer></div></div>
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
