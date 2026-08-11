import { useScrollReveal } from '../../../hooks/useScrollReveal';
import {
  BarChart3,
  Cpu,
  GanttChartSquare,
  LineChart,
  ShieldAlert,
  Workflow,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './Features.module.css';

const FEATURE_ICONS = [
  <Cpu size={22} key="cpu" />,
  <ShieldAlert size={22} key="shield" />,
  <LineChart size={22} key="line" />,
  <BarChart3 size={22} key="bar" />,
  <Workflow size={22} key="workflow" />,
  <GanttChartSquare size={22} key="gantt" />,
];

export default function Features() {
  const { t } = useLanguage();
  const items = t('features.items');
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal({ threshold: 0.1 });

  return (
    <section id="features" className={styles.features}>
      <div className="container">
        <div ref={headerRef} className="section-header reveal">
          <span className="eyebrow">{t('features.eyebrow')}</span>
          <h2 className="display-2">
            {t('features.titleStart')} <span className="italic-accent">{t('features.titleAccent')}</span>.
            <br />{t('features.titleEnd')}
          </h2>
          <p className="lead">
            {t('features.lead')}
          </p>
        </div>

        <div ref={gridRef} className={`${styles.featuresGrid} reveal stagger`}>
          {items.map((feature, i) => (
            <article key={feature.title} className={`${styles.feature} glass`} style={{ '--i': i }}>
              <div className={styles.featureIcon}>{FEATURE_ICONS[i]}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureText}>{feature.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
