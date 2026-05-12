import { useScrollReveal } from '../../hooks/useScrollReveal';
import { TrendingUp, GitCompare } from 'lucide-react';
import './Strategies.css';

const STRATS = [
  {
    icon: <GitCompare size={22} />,
    tag: 'Trend Following',
    name: 'Moving Average Crossover',
    desc:
      'Класична трендова стратегія. Buy — коли швидка ковзна перетинає повільну знизу вгору; Sell — навпаки. Чудово працює на трендових ринках, погано — на бічняку.',
    params: ['Fast MA window', 'Slow MA window'],
    bg: 'linear-gradient(135deg, rgba(0,224,143,0.18), rgba(0,224,143,0.04))',
  },
  {
    icon: <TrendingUp size={22} />,
    tag: 'Mean Reversion',
    name: 'RSI Mean Reversion',
    desc:
      'Контр-трендова стратегія. Buy — при виході з зони перепроданості (RSI ↑ через 30), Sell — при вході у перекупленість (RSI ↑ через 70). Працює на ринках з вираженими відкатами.',
    params: ['RSI period', 'Oversold threshold', 'Overbought threshold'],
    bg: 'linear-gradient(135deg, rgba(102,166,255,0.15), rgba(102,166,255,0.03))',
  },
];

export default function Strategies() {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  return (
    <section id="strategies" className="strats">
      <div className="container">
        <div ref={headerRef} className="section-header reveal">
          <span className="eyebrow">Стратегії</span>
          <h2 className="display-2">
            Дві перевірені <span className="italic-accent">класики</span> з коробки.
          </h2>
          <p className="lead">
            Обидві реалізовані з нуля на Python, без чорних скриньок. Архітектура побудована
            навколо абстракції <code>Strategy</code> — додати власну займає 30 рядків коду.
          </p>
        </div>

        <div ref={gridRef} className="strats__grid reveal">
          {STRATS.map((s) => (
            <article key={s.name} className="strat glass-strong" style={{ '--bg': s.bg }}>
              <div className="strat__icon">{s.icon}</div>
              <span className="strat__tag">{s.tag}</span>
              <h3 className="strat__name">{s.name}</h3>
              <p className="strat__desc">{s.desc}</p>
              <ul className="strat__params">
                {s.params.map((p) => (
                  <li key={p}>
                    <span className="strat__bullet" /> {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
