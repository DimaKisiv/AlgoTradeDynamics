import { Github } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import styles from './Footer.module.css';

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <span className={styles.footerLogo}>A</span>
          <div>
            <p className={styles.footerName}>AlgoTradeDynamics</p>
            <p className={styles.footerCaption}>
              {t('footer.caption')}
            </p>
          </div>
        </div>

        <div className={styles.footerCols}>
          <div>
            <p className={styles.footerTitle}>{t('footer.product')}</p>
            <ul>
              <li><a href="/backtests">{t('footer.backtestEngine')}</a></li>
              <li><a href="/bots">{t('footer.tradingBots')}</a></li>
              <li><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">API · Swagger</a></li>
            </ul>
          </div>
          <div>
            <p className={styles.footerTitle}>{t('footer.team')}</p>
            <ul>
              <li>Дмитро Кісів</li>
              <li>Ілля Артюшенко</li>
              <li>Олег Соломко</li>
            </ul>
          </div>
        </div>
      </div>

      <div className={`${styles.footerBase} container`}>
        <p className={styles.footerLegal}>
          {t('footer.legal')}
        </p>
        <a className={styles.footerGithub} href="#" aria-label={t('footer.githubAria')}>
          <Github size={16} />
        </a>
      </div>
    </footer>
  );
}
