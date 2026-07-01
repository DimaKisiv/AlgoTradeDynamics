import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getBacktest } from '../../api/backtests';
import ResultsView from '../../components/dashboard/ResultsView/ResultsView';
import styles from './RunDetailPage.module.css';

export default function RunDetailPage() {
  const { id } = useParams();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getBacktest(id);
        setRun(data);
      } catch (e) {
        setError(e.detail || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <main className={styles.runDetail}>
      <div className="container">
        <Link to="/runs" className={styles.runDetailBack}>
          <ArrowLeft size={16} /> Усі запуски
        </Link>

        {loading && <div className={styles.runDetailState}>Завантаження…</div>}
        {error && <div className={`${styles.runDetailState} ${styles.runDetailStateError}`}>⚠ {error}</div>}
        {run && (
          <>
            <header className={styles.runDetailHead}>
              <span className="eyebrow">Запуск #{run.id} · {run.created_at?.slice(0, 10)}</span>
              <h1 className="display-2">{run.strategy_name}</h1>
              <ParamsBlock run={run} />
            </header>
            <ResultsView run={run} />
          </>
        )}
      </div>
    </main>
  );
}

function ParamsBlock({ run }) {
  return (
    <div className={`${styles.runDetailParams} glass`}>
      <ParamGroup title="Стратегія" entries={run.strategy_params} />
      <ParamGroup title="Ризик" entries={run.risk_params} />
    </div>
  );
}

function ParamGroup({ title, entries }) {
  return (
    <div className={styles.paramGroup}>
      <p className={styles.paramGroupTitle}>{title}</p>
      <dl className={styles.paramGroupList}>
        {Object.entries(entries).map(([k, v]) => (
          <div key={k} className={styles.paramGroupItem}>
            <dt>{k}</dt>
            <dd className="mono">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
