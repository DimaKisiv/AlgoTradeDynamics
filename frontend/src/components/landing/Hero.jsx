import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import './Hero.css';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, delay: 0.12 * i, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero__inner">
        <motion.div initial="hidden" animate="visible" className="hero__content">
          <motion.div variants={fadeUp} custom={0} className="pill">
            <span className="dot" />
            <span>Дипломний MVP · Backtesting · Risk-Safe</span>
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} className="display-1 hero__title">
            Тестуйте торгового бота{' '}
            <span className="italic-accent">без ризику</span> для капіталу.
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} className="lead">
            AlgoTradeDynamics дає змогу запустити криптовалютну торгову стратегію на історичних
            даних, побачити equity curve, drawdown, win rate та повний журнал умовних угод — у
            єдиному преміальному інтерфейсі.
          </motion.p>

          <motion.div variants={fadeUp} custom={3} className="hero__actions">
            <Link to="/app" className="hero__primary">
              <span>Запустити Backtest</span>
              <ArrowRight size={18} />
            </Link>
            <a href="#how-it-works" className="hero__secondary">
              Як це працює
            </a>
          </motion.div>

          <motion.div variants={fadeUp} custom={4} className="hero__badges">
            <span><Sparkles size={14} /> 2 стратегії</span>
            <span><ShieldCheck size={14} /> Risk-controlled</span>
            <span><TrendingUp size={14} /> 366 днів історії</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="hero__visual"
        >
          <div className="hero__window glass-strong">
            <div className="hero__window-bar">
              <span /><span /><span />
              <p>BTC/USDT · MA Crossover · 2024</p>
            </div>
            <div className="hero__window-body">
              <div className="hero__window-stat">
                <p className="eyebrow">P&L</p>
                <h3 className="display-3">+18.4%</h3>
                <p className="text-tertiary">за 366 днів</p>
              </div>
              <div className="hero__window-stat hero__window-stat--right">
                <p className="eyebrow">Win Rate</p>
                <h3 className="display-3">62.5%</h3>
                <p className="text-tertiary">8 угод</p>
              </div>
              <svg viewBox="0 0 540 200" className="hero__sparkline" preserveAspectRatio="none">
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

          <div className="hero__chip hero__chip--1 glass">
            <ShieldCheck size={14} />
            <div>
              <p className="hero__chip-label">Stop-loss</p>
              <p className="hero__chip-value">5%</p>
            </div>
          </div>
          <div className="hero__chip hero__chip--2 glass">
            <TrendingUp size={14} />
            <div>
              <p className="hero__chip-label">Max DD</p>
              <p className="hero__chip-value">20%</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
