import { useScrollReveal } from '../../../hooks/useScrollReveal';
import styles from './HowItWorks.module.css';

const STEPS = [
  {
    n: '01',
    title: 'Оберіть існуючого бота',
    text:
      'Backtest зберігає snapshot його grid, TP, order quantity та risk settings, не змінюючи оригінал.',
  },
  {
    n: '02',
    title: 'Оберіть історичний dataset',
    text:
      'Вкажіть interval, період, execution path, початковий баланс, fees і slippage.',
  },
  {
    n: '03',
    title: 'Запустіть ізольований прогін',
    text:
      'Система створить тимчасовий emulator account і програє свічки через реальні orders, fills, positions та TP.',
  },
  {
    n: '04',
    title: 'Запустіть і аналізуйте',
    text:
      'Дивіться ордери на графіку, цикли, equity, drawdown, час у позиції та просадці, executions і конфігурацію запуску.',
  },
];

export default function HowItWorks() {
  const headerRef = useScrollReveal();
  const stepsRef = useScrollReveal({ threshold: 0.05 });

  return (
    <section id="how-it-works" className={styles.hiw}>
      <div className="container">
        <div ref={headerRef} className="section-header reveal">
          <span className="eyebrow">Як це працює</span>
          <h2 className="display-2">
            Чотири кроки. <span className="italic-accent">Жодного ризику.</span>
          </h2>
          <p className="lead">
            Симуляція використовує реальні історичні дані. Жодних реальних ордерів: окремий exchange emulator відтворює Bybit API та зберігає повний стан тестового акаунта.
          </p>
        </div>

        <div ref={stepsRef} className={`${styles.hiwSteps} reveal stagger`}>
          {STEPS.map((step, i) => (
            <div key={step.n} className={styles.hiwStep} style={{ '--i': i }}>
              <div className={styles.hiwStepNum}>
                <span>{step.n}</span>
              </div>
              <div className={styles.hiwStepBody}>
                <h3 className={styles.hiwStepTitle}>{step.title}</h3>
                <p className={styles.hiwStepText}>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
