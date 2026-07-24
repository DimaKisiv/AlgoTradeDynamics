import { useBacktest } from '../../hooks/useBacktest';
import ControlPanel from '../../components/dashboard/ControlPanel/ControlPanel';
import ResultsView from '../../components/dashboard/ResultsView/ResultsView';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { form, run, loading, error, updateField, submit, reset } = useBacktest();

  return (
    <main className={styles.dashboard}>
      <div className="container">
        <header className={styles.dashboardHead}>
          <span className="eyebrow">Backtest Engine</span>
          <h1 className="display-2">
            Налаштуйте параметри — <span className="italic-accent">отримайте результати</span>.
          </h1>
          <p className="lead">
            Усі обчислення виконуються на бекенді. Equity curve і журнал угод оновлюються
            автоматично після завершення симуляції.
          </p>
        </header>

        <div className={styles.dashboardGrid}>
          <ControlPanel
            form={form}
            onChange={updateField}
            onSubmit={submit}
            onReset={reset}
            loading={loading}
            error={error}
          />

          <div className={styles.dashboardResults}>
            {run ? (
              <ResultsView run={run} />
            ) : (
              <div className={`${styles.dashboardPlaceholder} glass`}>
                <div className={styles.dashboardPlaceholderInner}>
                  <span className={styles.dashboardPlaceholderOrb} />
                  <h3>Очікую на запуск…</h3>
                  <p className="text-secondary">
                    Натисніть «Запустити backtest» — і тут з’являться метрики, equity curve та
                    журнал угод.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
