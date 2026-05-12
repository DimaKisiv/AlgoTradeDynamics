import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import './MetricCard.css';

export default function MetricCard({ label, value, sublabel, tone = 'neutral', icon }) {
  const Icon = tone === 'positive' ? TrendingUp : tone === 'negative' ? TrendingDown : Minus;

  return (
    <div className={`metric glass metric--${tone}`}>
      <div className="metric__header">
        <span className="eyebrow">{label}</span>
        <span className="metric__icon">{icon || <Icon size={14} />}</span>
      </div>
      <p className="metric__value mono">{value}</p>
      {sublabel && <p className="metric__sub">{sublabel}</p>}
    </div>
  );
}
