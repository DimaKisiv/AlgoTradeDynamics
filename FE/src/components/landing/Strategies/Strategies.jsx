import { Hand, History, Route } from 'lucide-react';

import { useScrollReveal } from '../../../hooks/useScrollReveal';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './Strategies.module.css';

const CARD_META = [
  {
    icon: <Hand size={22} />,
    bg: 'linear-gradient(135deg,rgba(0,224,143,.18),rgba(0,224,143,.04))',
  },
  {
    icon: <Route size={22} />,
    bg: 'linear-gradient(135deg,rgba(102,166,255,.15),rgba(102,166,255,.03))',
  },
  {
    icon: <History size={22} />,
    bg: 'linear-gradient(135deg,rgba(185,140,255,.15),rgba(185,140,255,.03))',
  },
];

export default function Strategies() {
  const { t } = useLanguage();
  const cards = t('strategies.cards');
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  return (
    <section id="strategies" className={styles.strats}>
      <div className="container">
        <div ref={headerRef} className="section-header reveal">
          <span className="eyebrow">{t('strategies.eyebrow')}</span>
          <h2 className="display-2">
            {t('strategies.titleStart')} <span className="italic-accent">{t('strategies.titleAccent')}</span>
          </h2>
          <p className="lead">{t('strategies.lead')}</p>
        </div>

        <div ref={gridRef} className={`${styles.stratsGrid} reveal`}>
          {cards.map((item, index) => (
            <article
              key={item.name}
              className={`${styles.strat} glass-strong`}
              style={{ '--bg': CARD_META[index]?.bg }}
            >
              <div className={styles.stratIcon}>{CARD_META[index]?.icon}</div>
              <span className={styles.stratTag}>{item.tag}</span>
              <h3 className={styles.stratName}>{item.name}</h3>
              <p className={styles.stratDesc}>{item.desc}</p>
              <ul className={styles.stratParams}>
                {item.params.map((value) => (
                  <li key={value}>
                    <span className={styles.stratBullet} />
                    {value}
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
