import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './MetricCard.module.css';

export default function MetricCard({ label, value, sublabel, tone = 'neutral', icon }) {
  const Icon = tone === 'positive' ? TrendingUp : tone === 'negative' ? TrendingDown : Minus;
  const TONE = { positive: styles.metricPositive, negative: styles.metricNegative };

  return (
    <div className={`${styles.metric} glass ${TONE[tone] || ''}`}>
      <div className={styles.metricHeader}>
        <span className="eyebrow">{label}</span>
        <span className={styles.metricIcon}>{icon || <Icon size={14} />}</span>
      </div>
      <p className={`${styles.metricValue} mono`}>{value}</p>
      {sublabel && <p className={styles.metricSub}>{sublabel}</p>}
    </div>
  );
}
