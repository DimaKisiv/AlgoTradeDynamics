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
    title: 'Дві перевірені стратегії',
    text:
      'Moving Average Crossover і RSI Mean Reversion вбудовані з коробки. Архітектура дозволяє додавати власні стратегії як plug-in модулі.',
  },
  {
    icon: <ShieldAlert size={22} />,
    title: 'Risk-controlled execution',
    text:
      'Stop-loss, position sizing і автоматична зупинка при перевищенні максимального drawdown — параметри ризику ніколи не залишаються без контролю.',
  },
  {
    icon: <LineChart size={22} />,
    title: 'Equity curve у реальному часі',
    text:
      'Інтерактивний графік капіталу із позначками входів і виходів. Зрозуміло за один погляд, де стратегія заробила, а де зазнала збитків.',
  },
  {
    icon: <BarChart3 size={22} />,
    title: 'Глибокі метрики',
    text:
      'Total PnL, Win Rate, Max Drawdown, кількість угод. Кожна метрика клікабельна — деталізація до конкретних угод і дат.',
  },
  {
    icon: <Workflow size={22} />,
    title: 'Журнал угод',
    text:
      'Повний trade log: вхід, вихід, причина закриття (сигнал, стоп-лосс, ризик-ліміт). Експортується для подальшого аналізу.',
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
