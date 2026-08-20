import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { backtestsApi } from "../../api/backtests";
import { PnlValue, StatusBadge } from "../../components/trading/TradingBadges/TradingBadges";
import { fmtMoney, fmtMoneySigned, fmtNumber, fmtPctSigned } from "../../lib/format";
import { useLanguage } from "../../context/LanguageContext";
import styles from "./BacktestComparePage.module.css";

const COLORS = ["#25c78b", "#4d9dff", "#b98cff", "#ffc24b", "#f05b63"];
const METRICS = [
  ["Чистий загальний PnL", "Net total PnL", "net_total_pnl", fmtMoneySigned],
  ["Дохідність", "Return", "return_percent", fmtPctSigned],
  ["Максимальна просадка", "Maximum drawdown", "maximum_drawdown_percent", fmtPctSigned],
  ["Найгірший відкритий збиток", "Worst open loss", "maximum_unrealized_loss", fmtMoneySigned],
  ["Закриті цикли", "Closed cycles", "closed_cycles", (v) => fmtNumber(v, 0)],
  ["Win rate", "Win rate", "win_rate_percent", fmtPctSigned],
  ["Макс. вартість позиції", "Max position value", "maximum_position_value", fmtMoney],
  ["Час у позиції", "Time in position", "time_in_position_percent", (v) => `${fmtNumber(v, 1)}%`],
  ["Час у відкритому збитку", "Time in open loss", "time_in_loss_percent", (v) => `${fmtNumber(v, 1)}%`],
  ["Найдовша просадка", "Longest drawdown", "longest_drawdown_seconds", null],
  ["Відновлення після max DD", "Recovery after max DD", "maximum_drawdown_recovery_seconds", null],
  ["Макс. заповнених grid entries", "Max grid entries filled", "maximum_grid_levels_filled", (v) => fmtNumber(v, 0)],
  ["Загальні комісії", "Total fees", "total_fees", fmtMoney],
];

function strategyLabel(strategyType, tr) {
  if (strategyType === "momentum") return tr("Конфігурація Momentum", "Momentum configuration");
  if (strategyType === "dca") return tr("Конфігурація DCA", "DCA configuration");
  if (strategyType === "pattern_scalper") return tr("Конфігурація Scalper", "Scalper configuration");
  return tr("Конфігурація Grid", "Grid configuration");
}

function strategySummary(run, tr) {
  const snapshot = run?.bot_snapshot || {};
  const settings = snapshot.settings || {};
  if (snapshot.strategy_type === "momentum") {
    return [
      `${settings.timeframe || run.interval || "15"} ${tr("таймфрейм", "timeframe")}`,
      `${String(settings.position_side || "both").toUpperCase()} ${tr("режим", "mode")}`,
      `${settings.minimum_signal_score ?? 70}/100 ${tr("score", "score")}`,
      `${settings.atr_take_profit_multiplier ?? 3} ATR TP`,
    ].join(" · ");
  }
  if (snapshot.strategy_type === "dca") {
    return [
      `${snapshot.grid_orders_count} ${tr("страхувальних", "safety orders")}`,
      `${snapshot.grid_step_percent}% ${tr("перший крок", "first step")}`,
      `${settings.take_profit_percent ?? 1.5}% TP`,
    ].join(" · ");
  }
  if (snapshot.strategy_type === "pattern_scalper") {
    return [
      `${settings.timeframe || run.interval || "15"} ${tr("таймфрейм", "timeframe")}`,
      `${settings.risk_per_trade_percent ?? 0.5}% ${tr("ризик", "risk")}`,
      `${settings.take_profit_atr ?? 1.5} ATR TP`,
    ].join(" · ");
  }
  return [
    `${snapshot.grid_orders_count} ${tr("рівнів", "levels")}`,
    `${snapshot.grid_step_percent}% ${tr("крок", "step")}`,
    `${settings.take_profit_percent ?? 1.5}% TP`,
  ].join(" · ");
}

export default function BacktestComparePage() {
  const { tr, language, locale } = useLanguage();
  const duration = (seconds) => {
    const value = Math.max(Number(seconds || 0), 0);
    const days = Math.floor(value / 86400);
    const hours = Math.floor((value % 86400) / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    if (language === 'uk') return days ? `${days}д ${hours}г` : hours ? `${hours}г ${minutes}хв` : `${minutes}хв`;
    return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  };
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
      <Link to="/backtests" className={styles.back}><ArrowLeft size={15}/> {tr('Бектести', 'Backtests')}</Link>
      <header className={styles.hero}><span className="eyebrow">{tr('Порівняння', 'Comparison')}</span><h1>{tr('Порівняти backtests', 'Compare backtests')}</h1><p>{tr('Однакові метрики, конфігурація та equity curves у відсотках від стартового балансу.', 'The same metrics, configuration, and equity curves shown as percentages of starting balance.')}</p></header>
      {error && <div className={styles.error}>{error}</div>}
      {ids.length < 2 && <div className={styles.empty}>{tr('Обери щонайменше два завершені backtests у списку.', 'Select at least two completed backtests from the list.')}</div>}
      {runs.length >= 2 && <>
        <section className={styles.runCards}>{runs.map((run, index) => <article key={run.id} style={{ "--series-color": COLORS[index] }}><div><i/><StatusBadge status={run.status}/></div><Link to={`/backtests/${run.id}`}>{run.name}</Link><span>{run.bot_name} · {run.symbol}</span><strong><PnlValue value={run.metrics?.return_percent}>{fmtPctSigned(run.metrics?.return_percent)}</PnlValue></strong></article>)}</section>
        <section className={styles.chart}><h2>{tr('Дохідність equity', 'Equity return')}</h2><ResponsiveContainer width="100%" height={360}><LineChart data={chartData}><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="progress" tickFormatter={(v) => `${v}%`} stroke="#68718a"/><YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} stroke="#68718a"/><Tooltip labelFormatter={(v) => `${v}% ${tr('періоду', 'of period')}`} formatter={(v, name) => [`${Number(v).toFixed(2)}%`, runs.find((r) => `run_${r.id}` === name)?.name || name]}/>{runs.map((run, index) => <Line key={run.id} type="monotone" dataKey={`run_${run.id}`} stroke={COLORS[index]} dot={false} connectNulls strokeWidth={2} isAnimationActive={false}/>)}</LineChart></ResponsiveContainer></section>
        <section className={styles.tableWrap}><table><thead><tr><th>{tr('Метрика', 'Metric')}</th>{runs.map((run) => <th key={run.id}>{run.name}</th>)}</tr></thead><tbody>
          <tr><td>{runs.every((run) => run?.bot_snapshot?.strategy_type === runs[0]?.bot_snapshot?.strategy_type) ? strategyLabel(runs[0]?.bot_snapshot?.strategy_type, tr) : tr('Конфігурація стратегії', 'Strategy configuration')}</td>{runs.map((run) => <td key={run.id}>{strategySummary(run, tr)}</td>)}</tr>
          <tr><td>{tr('Період', 'Period')}</td>{runs.map((run) => <td key={run.id}>{new Date(run.start_time).toLocaleDateString(locale)} — {new Date(run.end_time).toLocaleDateString(locale)}</td>)}</tr>
          {METRICS.map(([ukLabel, enLabel, key, format]) => <tr key={key}><td>{tr(ukLabel, enLabel)}</td>{runs.map((run) => <td key={run.id}><PnlValue value={key.includes("pnl") || key.includes("drawdown") || key.includes("loss") ? run.metrics?.[key] : undefined}>{run.metrics?.[key] == null ? "—" : (format || duration)(run.metrics[key])}</PnlValue></td>)}</tr>)}
        </tbody></table></section>
      </>}
    </div></main>
  );
}
