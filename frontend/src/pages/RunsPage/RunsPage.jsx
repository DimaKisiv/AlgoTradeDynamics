import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ChevronRight } from 'lucide-react';
import { deleteBacktest, listBacktests } from '../../api/backtests';
import { fmtMoney, fmtPctSigned, fmtDateTime, fmtPct } from '../../lib/format';
import styles from './RunsPage.module.css';

export default function RunsPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const data = await listBacktests();
      setRuns(data);
    } catch (e) {
      setError(e.detail || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Видалити цей запуск?')) return;
    await deleteBacktest(id);
    load();
  };

  return (
    <main className={styles.runs}>
      <div className="container">
        <header className={styles.runsHead}>
          <span className="eyebrow">Історія запусків</span>
          <h1 className="display-2">
            Усі ваші <span className="italic-accent">backtest-сесії</span>.
          </h1>
          <p className="lead">
            Кожен запуск автоматично зберігається в базі. Відкрийте, порівняйте, видаліть — повний
            контроль над вашими симуляціями.
          </p>
        </header>

        {loading && <div className={styles.runsState}>Завантаження…</div>}
        {error && <div className={`${styles.runsState} ${styles.runsStateError}`}>⚠ {error}</div>}
        {!loading && !error && runs.length === 0 && (
          <div className={`${styles.runsEmpty} glass`}>
            <h3>Поки що немає жодного запуску</h3>
            <p className="text-secondary">
              Перейдіть до Backtest Engine і запустіть перший — він з’явиться тут.
            </p>
            <Link to="/app" className={styles.runsEmptyCta}>Перейти до Backtest →</Link>
          </div>
        )}

        {!loading && runs.length > 0 && (
          <div className={styles.runsList}>
            {runs.map((r) => {
              const profit = r.total_pnl >= 0;
              return (
                <Link to={`/runs/${r.id}`} key={r.id} className={`${styles.runRow} glass`}>
                  <div className={`${styles.runRowId} mono`}>#{r.id}</div>
                  <div className={styles.runRowMeta}>
                    <p className={styles.runRowStrategy}>{r.strategy_name}</p>
                    <p className={`${styles.runRowSymbol} mono`}>{r.symbol} · {fmtDateTime(r.created_at)}</p>
                  </div>
                  <div className={styles.runRowMetric}>
                    <span className={styles.runRowMetricLabel}>PnL</span>
                    <span className={`${styles.runRowMetricValue} mono ${profit ? 'text-positive' : 'text-danger'}`}>
                      {fmtPctSigned(r.total_pnl_percent)}
                    </span>
                  </div>
                  <div className={styles.runRowMetric}>
                    <span className={styles.runRowMetricLabel}>Win Rate</span>
                    <span className={`${styles.runRowMetricValue} mono`}>{fmtPct(r.win_rate_percent)}</span>
                  </div>
                  <div className={styles.runRowMetric}>
                    <span className={styles.runRowMetricLabel}>Trades</span>
                    <span className={`${styles.runRowMetricValue} mono`}>{r.trades_count}</span>
                  </div>
                  <div className={styles.runRowMetric}>
                    <span className={styles.runRowMetricLabel}>Balance</span>
                    <span className={`${styles.runRowMetricValue} mono`}>{fmtMoney(r.final_balance, 0)}</span>
                  </div>
                  <div className={styles.runRowActions}>
                    <button
                      type="button"
                      className={styles.runRowDelete}
                      onClick={(e) => { e.preventDefault(); handleDelete(r.id); }}
                      aria-label="Видалити запуск"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className={styles.runRowChevron} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
