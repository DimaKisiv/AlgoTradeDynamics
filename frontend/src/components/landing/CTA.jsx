import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../../hooks/useScrollReveal';
import './CTA.css';

export default function CTA() {
  const ref = useScrollReveal();
  return (
    <section className="cta">
      <div className="container">
        <div ref={ref} className="cta__card glass-strong reveal">
          <div className="cta__glow" aria-hidden />
          <div className="cta__content">
            <span className="eyebrow">Готові спробувати?</span>
            <h2 className="display-2">
              Запустіть перший backtest <br />
              <span className="italic-accent">за 30 секунд.</span>
            </h2>
            <p className="lead">
              Без реєстрації, без зайвих кроків. Параметри за замовчуванням уже налаштовано —
              просто натисніть кнопку.
            </p>
            <Link to="/app" className="cta__btn">
              <span>Перейти до backtest engine</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
