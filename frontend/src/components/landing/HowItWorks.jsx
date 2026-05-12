import { useScrollReveal } from '../../hooks/useScrollReveal';
import './HowItWorks.css';

const STEPS = [
  {
    n: '01',
    title: 'Оберіть актив і капітал',
    text:
      'Вкажіть пару (BTC/USDT або ETH/USDT) і початковий депозит — це базис, з якого стартує симуляція.',
  },
  {
    n: '02',
    title: 'Налаштуйте стратегію',
    text:
      'Виберіть алгоритм — Moving Average Crossover або RSI Mean Reversion — та параметри: розміри вікон, пороги перекупленості/перепроданості.',
  },
  {
    n: '03',
    title: 'Встановіть ризик-ліміти',
    text:
      'Розмір позиції у % від депозиту, стоп-лосс і максимально допустимий drawdown. Бот закриється автоматично, якщо ліміт буде перетнуто.',
  },
  {
    n: '04',
    title: 'Запустіть і аналізуйте',
    text:
      'Один клік — і ви отримуєте equity curve, метрики й журнал угод. Результат зберігається в історію для подальшого порівняння.',
  },
];

export default function HowItWorks() {
  const headerRef = useScrollReveal();
  const stepsRef = useScrollReveal({ threshold: 0.05 });

  return (
    <section id="how-it-works" className="hiw">
      <div className="container">
        <div ref={headerRef} className="section-header reveal">
          <span className="eyebrow">Як це працює</span>
          <h2 className="display-2">
            Чотири кроки. <span className="italic-accent">Жодного ризику.</span>
          </h2>
          <p className="lead">
            Симуляція використовує реальні історичні дані. Жодних реальних ордерів, жодних
            підключень до бірж у MVP — лише чисте навчальне середовище.
          </p>
        </div>

        <div ref={stepsRef} className="hiw__steps reveal stagger">
          {STEPS.map((step, i) => (
            <div key={step.n} className="hiw__step" style={{ '--i': i }}>
              <div className="hiw__step-num">
                <span>{step.n}</span>
              </div>
              <div className="hiw__step-body">
                <h3 className="hiw__step-title">{step.title}</h3>
                <p className="hiw__step-text">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
