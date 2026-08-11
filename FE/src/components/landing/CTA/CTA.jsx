import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './CTA.module.css';

export default function CTA() {
  const { t } = useLanguage();
  const ref = useScrollReveal();
  return (
    <section className={styles.cta}>
      <div className="container">
        <div ref={ref} className={`${styles.ctaCard} glass-strong reveal`}>
          <div className={styles.ctaGlow} aria-hidden />
          <div className={styles.ctaContent}>
            <span className="eyebrow">{t('cta.eyebrow')}</span>
            <h2 className="display-2">
              {t('cta.titleStart')} <br />
              <span className="italic-accent">{t('cta.titleAccent')}</span>
            </h2>
            <p className="lead">
              {t('cta.lead')}
            </p>
            <Link to="/backtests" className={styles.ctaBtn}>
              <span>{t('cta.button')}</span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
