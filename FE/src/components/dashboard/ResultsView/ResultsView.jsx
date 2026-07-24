import { Link } from 'react-router-dom';
import { Activity, BarChart3, Percent, Target } from 'lucide-react';
import { motion } from 'framer-motion';

import { fmtMoney, fmtPctSigned, fmtPct, fmtMoneySigned } from '../../../lib/format';
import MetricCard from '../MetricCard/MetricCard';
import EquityChart from '../EquityChart/EquityChart';
import TradeJournal from '../TradeJournal/TradeJournal';
import styles from './ResultsView.module.css';

export default function ResultsView({ run }) {
  const isProfit = run.total_pnl >= 0;

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, delay: 0.08 * i, ease: [0.16, 1, 0.3, 1] },
    }),
  };

  return (
    <motion.div initial="hidden" animate="visible" className={styles.results}>
      <motion.header variants={fadeUp} custom={0} className={styles.resultsHead}>
        <div>
          <span className="eyebrow">Результат · run #{run.id}</span>
          <h2 className={styles.resultsTitle}>
            {run.strategy_name} · <span className="mono">{run.symbol}</span>
          </h2>
        </div>
        <Link to={`/runs/${run.id}`} className={styles.resultsLink}>
          Деталі запуску →
        </Link>
      </motion.header>

      <motion.div variants={fadeUp} custom={1} className={styles.resultsMetrics}>
        <MetricCard
          label="Total PnL"
          value={fmtMoneySigned(run.total_pnl)}
          sublabel={fmtPctSigned(run.total_pnl_percent)}
          tone={isProfit ? 'positive' : 'negative'}
        />
        <MetricCard
          label="Win Rate"
          value={fmtPct(run.win_rate_percent)}
          sublabel={`${run.trades_count} угод`}
          tone={run.win_rate_percent >= 50 ? 'positive' : 'neutral'}
          icon={<Target size={14} />}
        />
        <MetricCard
          label="Max Drawdown"
          value={`-${fmtPct(run.max_drawdown_percent)}`}
          sublabel="Найбільша просадка"
          tone={run.max_drawdown_percent > 20 ? 'negative' : 'neutral'}
          icon={<Percent size={14} />}
        />
        <MetricCard
          label="Final Balance"
          value={fmtMoney(run.final_balance, 0)}
          sublabel={`з ${fmtMoney(run.initial_balance, 0)}`}
          tone={isProfit ? 'positive' : 'negative'}
          icon={<BarChart3 size={14} />}
        />
      </motion.div>

      <motion.section variants={fadeUp} custom={2} className={`${styles.resultsChart} glass-strong`}>
        <header className={styles.resultsSectionHead}>
          <div>
            <span className="eyebrow">Equity Curve</span>
            <h3 className={styles.resultsSectionTitle}>Динаміка капіталу</h3>
          </div>
          <span className="pill">
            <Activity size={12} />
            {run.equity_points?.length ?? 0} точок
          </span>
        </header>
        <EquityChart points={run.equity_points} initialBalance={run.initial_balance} />
      </motion.section>

      <motion.section variants={fadeUp} custom={3} className={`${styles.resultsJournal} glass-strong`}>
        <header className={styles.resultsSectionHead}>
          <div>
            <span className="eyebrow">Trade Journal</span>
            <h3 className={styles.resultsSectionTitle}>Журнал угод</h3>
          </div>
          <span className="pill">
            <Activity size={12} />
            {run.trades?.length ?? 0} угод
          </span>
        </header>
        <TradeJournal trades={run.trades} />
      </motion.section>
    </motion.div>
  );
}
