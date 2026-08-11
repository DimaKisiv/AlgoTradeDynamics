import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './Hero.module.css';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: 0.12 * i, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function Hero() {
  const { t } = useLanguage();

  return (
    <section className={styles.hero}>
      <div className={`container ${styles.heroInner}`}>
        <motion.div initial="hidden" animate="visible" className={styles.heroContent}>
          <motion.div variants={fadeUp} custom={0} className="pill">
            <span className="dot" />
            <span>{t('hero.pill')}</span>
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className={`display-1 ${styles.heroTitle}`}>
            {t('hero.titleStart')}{' '}
            <span className="italic-accent">{t('hero.titleAccent')}</span> {t('hero.titleEnd')}
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="lead">
            {t('hero.lead')}
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className={styles.heroActions}>
            <Link to="/backtests" className={styles.heroPrimary}>
              <span>{t('hero.startBacktest')}</span>
              <ArrowRight size={18} />
            </Link>
            <a href="#how-it-works" className={styles.heroSecondary}>
              {t('hero.howItWorks')}
            </a>
          </motion.div>

          <motion.div variants={fadeUp} custom={4} className={styles.heroBadges}>
            <span><Sparkles size={14} /> {t('hero.badgeLogic')}</span>
            <span><ShieldCheck size={14} /> {t('hero.badgeRisk')}</span>
            <span><TrendingUp size={14} /> {t('hero.badgeData')}</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={styles.heroVisual}
        >
          <div className={`${styles.heroWindow} glass-strong`}>
            <div className={styles.heroWindowBar}>
              <span /><span /><span />
              <p>BTCUSDT · Grid Bot · Historical</p>
            </div>
            <div className={styles.heroWindowBody}>
              <div className={styles.heroWindowStat}>
                <p className="eyebrow">P&L</p>
                <h3 className="display-3">+18.4%</h3>
                <p className="text-tertiary">{t('hero.periodLabel')}</p>
              </div>
              <div className={`${styles.heroWindowStat} ${styles.heroWindowStatRight}`}>
                <p className="eyebrow">Win Rate</p>
                <h3 className="display-3">58.6%</h3>
                <p className="text-tertiary">{t('hero.winRateLabel')}</p>
              </div>
              <svg viewBox="0 0 540 200" className={styles.heroSparkline} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(0,224,143,0.5)" />
                    <stop offset="100%" stopColor="rgba(0,224,143,0)" />
                  </linearGradient>
                  <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00e08f" />
                    <stop offset="100%" stopColor="#66f0c4" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,160 C40,150 80,170 120,155 C160,140 200,130 240,115 C280,100 320,95 360,80 C400,65 440,75 480,55 C520,35 540,40 540,40 L540,200 L0,200 Z"
                  fill="url(#sparkFill)"
                />
                <path
                  d="M0,160 C40,150 80,170 120,155 C160,140 200,130 240,115 C280,100 320,95 360,80 C400,65 440,75 480,55 C520,35 540,40 540,40"
                  stroke="url(#sparkStroke)"
                  strokeWidth="2.5"
                  fill="none"
                />
                <circle cx="540" cy="40" r="5" fill="#00e08f">
                  <animate
                    attributeName="r"
                    values="5;10;5"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="1;0.4;1"
                    dur="2.4s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </div>
          </div>

          <div className={`${styles.heroChip} ${styles.heroChip1} glass`}>
            <ShieldCheck size={14} />
            <div>
              <p className={styles.heroChipLabel}>{t('hero.chipGrid')}</p>
              <p className={styles.heroChipValue}>2</p>
            </div>
          </div>
          <div className={`${styles.heroChip} ${styles.heroChip2} glass`}>
            <TrendingUp size={14} />
            <div>
              <p className={styles.heroChipLabel}>{t('hero.chipDd')}</p>
              <p className={styles.heroChipValue}>20%</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
