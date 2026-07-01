import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtMoney } from '../../../lib/format';
import styles from './EquityChart.module.css';

export default function EquityChart({ points, initialBalance }) {
  if (!points || points.length === 0) {
    return (
      <div className={styles.chartEmpty}>
        <p>Немає даних для відображення</p>
      </div>
    );
  }

  const isProfit = points[points.length - 1].value >= initialBalance;
  const strokeColor = isProfit ? 'var(--accent)' : 'var(--danger)';
  const fillId = isProfit ? 'equityFillUp' : 'equityFillDown';

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={points} margin={{ top: 20, right: 16, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="equityFillUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00e08f" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#00e08f" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="equityFillDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff5d6c" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ff5d6c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: 'rgba(170,177,196,0.65)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            minTickGap={48}
          />
          <YAxis
            tick={{ fill: 'rgba(170,177,196,0.65)', fontSize: 11, fontFamily: 'JetBrains Mono' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => fmtMoney(v, 0)}
            width={80}
            domain={['dataMin - 200', 'dataMax + 200']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={2.5}
            fill={`url(#${fillId})`}
            isAnimationActive
            animationDuration={1100}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={`${styles.chartTooltip} glass`}>
      <p className={`${styles.chartTooltipDate} mono`}>{label}</p>
      <p className={`${styles.chartTooltipValue} mono`}>{fmtMoney(payload[0].value)}</p>
    </div>
  );
}
