import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { backtestsApi } from "../../api/backtests";
import { PnlValue, StatusBadge } from "../../components/trading/TradingBadges/TradingBadges";
import { fmtMoney, fmtMoneySigned, fmtNumber, fmtPctSigned } from "../../lib/format";
import styles from "./BacktestComparePage.module.css";

const COLORS = ["#25c78b", "#4d9dff", "#b98cff", "#ffc24b", "#f05b63"];
const METRICS = [
  ["Net total PnL", "net_total_pnl", fmtMoneySigned],
  ["Return", "return_percent", fmtPctSigned],
  ["Maximum drawdown", "maximum_drawdown_percent", fmtPctSigned],
  ["Worst open loss", "maximum_unrealized_loss", fmtMoneySigned],
  ["Closed cycles", "closed_cycles", (v) => fmtNumber(v, 0)],
  ["Win rate", "win_rate_percent", fmtPctSigned],
  ["Max position value", "maximum_position_value", fmtMoney],
  ["Time in position", "time_in_position_percent", (v) => `${fmtNumber(v, 1)}%`],
  ["Time in open loss", "time_in_loss_percent", (v) => `${fmtNumber(v, 1)}%`],
  ["Longest drawdown", "longest_drawdown_seconds", duration],
  ["Recovery after max DD", "maximum_drawdown_recovery_seconds", duration],
  ["Max grid entries filled", "maximum_grid_levels_filled", (v) => fmtNumber(v, 0)],
  ["Total fees", "total_fees", fmtMoney],
];

function duration(seconds) {
  const value = Math.max(Number(seconds || 0), 0);
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return days ? `${days}д ${hours}г` : hours ? `${hours}г ${minutes}хв` : `${minutes}хв`;
}

export default function BacktestComparePage() {
  const [searchParams] = useSearchParams();
  const ids = useMemo(
    () => [...new Set((searchParams.get("ids") || "").split(",").map(Number).filter(Boolean))].slice(0, 5),
    [searchParams],
  );
  const [runs, setRuns] = useState([]);
  const [series, setSeries] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all(ids.map(async (id) => {
      const [run, points] = await Promise.all([backtestsApi.get(id), backtestsApi.points(id)]);
      return { run, points };
    })).then((items) => {
      if (!active) return;
      setRuns(items.map((item) => item.run));
      setSeries(items);
    }).catch((e) => active && setError(e.detail || e.message));
    return () => { active = false; };
  }, [ids]);

  const chartData = useMemo(() => {
    const rows = new Map();
    series.forEach(({ run, points }) => {
      points.forEach((point) => {
        const progress = run.end_time === run.start_time
          ? 0
          : ((point.timestamp - run.start_time) / (run.end_time - run.start_time)) * 100;
        const key = Number(progress.toFixed(2));
        const row = rows.get(key) || { progress: key };
        row[`run_${run.id}`] = ((point.equity - run.initial_balance) / run.initial_balance) * 100;
        rows.set(key, row);
      });
    });
    return [...rows.values()].sort((a, b) => a.progress - b.progress);
  }, [series]);

  return (
    <main className={styles.page}><div className="container">
      <Link to="/backtests" className={styles.back}><ArrowLeft size={15}/> Backtests</Link>
      <header className={styles.hero}><span className="eyebrow">Comparison</span><h1>Compare backtests</h1><p>Однакові метрики, конфігурація та equity curves у відсотках від стартового балансу.</p></header>
      {error && <div className={styles.error}>{error}</div>}
      {ids.length < 2 && <div className={styles.empty}>Обери щонайменше два завершені backtests у списку.</div>}
      {runs.length >= 2 && <>
        <section className={styles.runCards}>{runs.map((run, index) => <article key={run.id} style={{ "--series-color": COLORS[index] }}><div><i/><StatusBadge status={run.status}/></div><Link to={`/backtests/${run.id}`}>{run.name}</Link><span>{run.bot_name} · {run.symbol}</span><strong><PnlValue value={run.metrics?.return_percent}>{fmtPctSigned(run.metrics?.return_percent)}</PnlValue></strong></article>)}</section>
        <section className={styles.chart}><h2>Equity return</h2><ResponsiveContainer width="100%" height={360}><LineChart data={chartData}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="progress" tickFormatter={(v) => `${v}%`} stroke="#68718a"/><YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} stroke="#68718a"/><Tooltip labelFormatter={(v) => `${v}% of period`} formatter={(v, name) => [`${Number(v).toFixed(2)}%`, runs.find((r) => `run_${r.id}` === name)?.name || name]}/>{runs.map((run, index) => <Line key={run.id} type="monotone" dataKey={`run_${run.id}`} stroke={COLORS[index]} dot={false} connectNulls strokeWidth={2} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></section>
        <section className={styles.tableWrap}><table><thead><tr><th>Metric</th>{runs.map((run) => <th key={run.id}>{run.name}</th>)}</tr></thead><tbody>
          <tr><td>Grid configuration</td>{runs.map((run) => <td key={run.id}>{run.bot_snapshot.grid_orders_count} levels · {run.bot_snapshot.grid_step_percent}% step · {run.bot_snapshot.settings?.take_profit_percent ?? 1.5}% TP</td>)}</tr>
          <tr><td>Period</td>{runs.map((run) => <td key={run.id}>{new Date(run.start_time).toLocaleDateString("uk-UA")} — {new Date(run.end_time).toLocaleDateString("uk-UA")}</td>)}</tr>
          {METRICS.map(([label, key, format]) => <tr key={key}><td>{label}</td>{runs.map((run) => <td key={run.id}><PnlValue value={key.includes("pnl") || key.includes("drawdown") || key.includes("loss") ? run.metrics?.[key] : undefined}>{run.metrics?.[key] == null ? "—" : format(run.metrics[key])}</PnlValue></td>)}</tr>)}
        </tbody></table></section>
      </>}
    </div></main>
  );
}
