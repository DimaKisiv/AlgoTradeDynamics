import { Github } from 'lucide-react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <span className="footer__logo">A</span>
          <div>
            <p className="footer__name">AlgoTradeDynamics</p>
            <p className="footer__caption">
              Дипломний MVP · Neoversity MSc Computer Science · 2025
            </p>
          </div>
        </div>

        <div className="footer__cols">
          <div>
            <p className="footer__title">Продукт</p>
            <ul>
              <li><a href="/app">Backtest engine</a></li>
              <li><a href="/runs">Історія запусків</a></li>
              <li><a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">API · Swagger</a></li>
            </ul>
          </div>
          <div>
            <p className="footer__title">Команда</p>
            <ul>
              <li>Дмитро Кісів</li>
              <li>Ілля Артюшенко</li>
              <li>Олег Соломко</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer__base container">
        <p className="footer__legal">
          Цей MVP не виконує реальних торгових операцій і не є фінансовою порадою. Призначений лише
          для навчального backtesting.
        </p>
        <a className="footer__github" href="#" aria-label="GitHub">
          <Github size={16} />
        </a>
      </div>
    </footer>
  );
}
