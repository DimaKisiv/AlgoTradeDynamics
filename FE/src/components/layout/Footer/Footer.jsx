import { Github } from 'lucide-react';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <span className={styles.footerLogo}>A</span>
          <div>
            <p className={styles.footerName}>AlgoTradeDynamics</p>
            <p className={styles.footerCaption}>
              Дипломний MVP · Neoversity MSc Computer Science · 2026
            </p>
          </div>
        </div>

        <div className={styles.footerCols}>
          <div>
            <p className={styles.footerTitle}>Продукт</p>
            <ul>
              <li><a href="/backtests">Backtest engine</a></li>
              <li><a href="/bots">Trading bots</a></li>
              <li><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">API · Swagger</a></li>
            </ul>
          </div>
          <div>
            <p className={styles.footerTitle}>Команда</p>
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
          Цей MVP не виконує реальних торгових операцій і не є фінансовою порадою. Призначений лише
          для тестування алгоритмів на локальному exchange emulator.
        </p>
        <a className={styles.footerGithub} href="#" aria-label="GitHub">
          <Github size={16} />
        </a>
      </div>
    </footer>
  );
}
