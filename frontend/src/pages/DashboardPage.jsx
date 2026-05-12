import { useBacktest } from '../hooks/useBacktest';
import ControlPanel from '../components/dashboard/ControlPanel';
import ResultsView from '../components/dashboard/ResultsView';
import './DashboardPage.css';

export default function DashboardPage() {
  const { form, run, loading, error, updateField, submit, reset } = useBacktest();

  return (
    <main className="dashboard">
      <div className="container">
        <header className="dashboard__head">
          <span className="eyebrow">Backtest Engine</span>
          <h1 className="display-2">
            Налаштуйте параметри — <span className="italic-accent">отримайте результати</span>.
          </h1>
          <p className="lead">
            Усі обчислення виконуються на бекенді. Equity curve і журнал угод оновлюються
            автоматично після завершення симуляції.
          </p>
        </header>

        <div className="dashboard__grid">
          <ControlPanel
            form={form}
            onChange={updateField}
            onSubmit={submit}
            onReset={reset}
            loading={loading}
            error={error}
          />

          <div className="dashboard__results">
            {run ? (
              <ResultsView run={run} />
            ) : (
              <div className="dashboard__placeholder glass">
                <div className="dashboard__placeholder-inner">
                  <span className="dashboard__placeholder-orb" />
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
