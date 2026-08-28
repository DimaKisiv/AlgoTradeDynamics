import { useLanguage } from '../../../context/LanguageContext';
import logo from '../../../assets/logo.png';
import styles from './Footer.module.css';

// Lucide 1.x no longer ships brand marks, so the outline GitHub icon is kept
// inline. Path data copied from lucide-react 0.460.0 (ISC licence), which is
// what the footer used before the upgrade — the rendered markup is unchanged.
function GithubIcon({ size = 16 }) {
  return (
    <svg
      className="lucide lucide-github"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export default function Footer() {
  const { t } = useLanguage();

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <img className="logo" src={logo} alt="" aria-hidden="true" />
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
        <a className={styles.footerGithub} href="https://github.com/DimaKisiv/AlgoTradeDynamics" target={"_blank"} aria-label={t('footer.githubAria')}>
          <GithubIcon size={16} />
        </a>
      </div>
    </footer>
  );
}
