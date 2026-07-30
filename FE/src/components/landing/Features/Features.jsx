import { useScrollReveal } from '../../../hooks/useScrollReveal';
import {
  BarChart3,
  Cpu,
  GanttChartSquare,
  LineChart,
  ShieldAlert,
  Workflow,
} from 'lucide-react';
import styles from './Features.module.css';

const FEATURES = [
  {
    icon: <Cpu size={22} />,
    title: 'Той самий bot worker',
    text:
      'Backtest запускає snapshot вашого існуючого grid-бота через той самий order lifecycle, TP та reconciliation, що й emulator/live runtime.',
  },
  {
    icon: <ShieldAlert size={22} />,
    title: 'Risk-controlled execution',
    text:
      'Ізольований тестовий акаунт, баланс, leverage, fees, slippage та execution path не торкаються звичайної історії бота.',
  },
  {
    icon: <LineChart size={22} />,
    title: 'Equity curve у реальному часі',
    text:
      'Графік ціни показує grid fills, take profits, cancelled orders, equity, drawdown і position exposure.',
  },
  {
    icon: <BarChart3 size={22} />,
    title: 'Глибокі метрики',
    text:
      'PnL, fees, max drawdown, worst unrealized loss, time in position, time in loss, recovery та max exposure.',
  },
  {
    icon: <Workflow size={22} />,
    title: 'Журнал угод',
    text:
      'Orders, executions, position changes, cycles і worker events з переходом із таблиці до потрібного моменту графіка.',
  },
  {
    icon: <GanttChartSquare size={22} />,
    title: 'Історія запусків',
    text:
      'Кожен backtest зберігається в базі даних. Можна порівнювати конфігурації, відкривати минулі запуски та аналізувати тренди.',
  },
];

export default function Features() {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ threshold: 0.1 });

  return (
    <section id="features" className={styles.features}>
      <div className="container">
        <div ref={headerRef} className="section-header reveal">
          <span className="eyebrow">Що всередині</span>
          <h2 className="display-2">
            Усе для зрілого <span className="italic-accent">backtesting</span>.
            <br />Без зайвого шуму.
          </h2>
          <p className="lead">
            MVP сфокусований на одній задачі — дати трейдеру безпечне середовище для перевірки
            ідеї перед тим, як ризикувати реальним капіталом.
          </p>
        </div>

        <div ref={gridRef} className={`${styles.featuresGrid} reveal stagger`}>
          {FEATURES.map((feature, i) => (
            <article key={feature.title} className={`${styles.feature} glass`} style={{ '--i': i }}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureText}>{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
