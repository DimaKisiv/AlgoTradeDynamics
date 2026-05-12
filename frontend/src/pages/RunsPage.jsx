import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ChevronRight } from 'lucide-react';
import { deleteBacktest, listBacktests } from '../api/backtests';
import { fmtMoney, fmtPctSigned, fmtDateTime, fmtPct } from '../lib/format';
import './RunsPage.css';

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
    <main className="runs">
      <div className="container">
        <header className="runs__head">
          <span className="eyebrow">Історія запусків</span>
          <h1 className="display-2">
            Усі ваші <span className="italic-accent">backtest-сесії</span>.
          </h1>
          <p className="lead">
            Кожен запуск автоматично зберігається в базі. Відкрийте, порівняйте, видаліть — повний
            контроль над вашими симуляціями.
          </p>
        </header>

        {loading && <div className="runs__state">Завантаження…</div>}
        {error && <div className="runs__state runs__state--error">⚠ {error}</div>}
        {!loading && !error && runs.length === 0 && (
          <div className="runs__empty glass">
            <h3>Поки що немає жодного запуску</h3>
            <p className="text-secondary">
              Перейдіть до Backtest Engine і запустіть перший — він з’явиться тут.
            </p>
            <Link to="/app" className="runs__empty-cta">Перейти до Backtest →</Link>
          </div>
        )}

        {!loading && runs.length > 0 && (
          <div className="runs__list">
            {runs.map((r) => {
              const profit = r.total_pnl >= 0;
              return (
                <Link to={`/runs/${r.id}`} key={r.id} className="run-row glass">
                  <div className="run-row__id mono">#{r.id}</div>
                  <div className="run-row__meta">
                    <p className="run-row__strategy">{r.strategy_name}</p>
                    <p className="run-row__symbol mono">{r.symbol} · {fmtDateTime(r.created_at)}</p>
                  </div>
                  <div className="run-row__metric">
                    <span className="run-row__metric-label">PnL</span>
                    <span className={`run-row__metric-value mono ${profit ? 'text-positive' : 'text-danger'}`}>
                      {fmtPctSigned(r.total_pnl_percent)}
                    </span>
                  </div>
                  <div className="run-row__metric">
                    <span className="run-row__metric-label">Win Rate</span>
                    <span className="run-row__metric-value mono">{fmtPct(r.win_rate_percent)}</span>
                  </div>
                  <div className="run-row__metric">
                    <span className="run-row__metric-label">Trades</span>
                    <span className="run-row__metric-value mono">{r.trades_count}</span>
                  </div>
                  <div className="run-row__metric">
                    <span className="run-row__metric-label">Balance</span>
                    <span className="run-row__metric-value mono">{fmtMoney(r.final_balance, 0)}</span>
                  </div>
                  <div className="run-row__actions">
                    <button
                      type="button"
                      className="run-row__delete"
                      onClick={(e) => { e.preventDefault(); handleDelete(r.id); }}
                      aria-label="Видалити запуск"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="run-row__chevron" />
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
