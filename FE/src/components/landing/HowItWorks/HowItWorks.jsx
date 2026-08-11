import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './HowItWorks.module.css';

const STEP_NUMBERS = ['01', '02', '03', '04'];

export default function HowItWorks() {
  const { t } = useLanguage();
  const steps = t('howItWorks.steps');
  const headerRef = useScrollReveal();
  const stepsRef = useScrollReveal({ threshold: 0.05 });

  return (
    <section id="how-it-works" className={styles.hiw}>
      <div className="container">
        <div ref={headerRef} className="section-header reveal">
          <span className="eyebrow">{t('howItWorks.eyebrow')}</span>
          <h2 className="display-2">
            {t('howItWorks.titleStart')} <span className="italic-accent">{t('howItWorks.titleAccent')}</span>
          </h2>
          <p className="lead">
            {t('howItWorks.lead')}
          </p>
        </div>

        <div ref={stepsRef} className={`${styles.hiwSteps} reveal stagger`}>
          {steps.map((step, i) => (
            <div key={STEP_NUMBERS[i]} className={styles.hiwStep} style={{ '--i': i }}>
              <div className={styles.hiwStepNum}>
                <span>{STEP_NUMBERS[i]}</span>
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
