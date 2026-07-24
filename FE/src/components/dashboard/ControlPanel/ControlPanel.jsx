import { Play, RotateCcw } from 'lucide-react';
import { fmtMoney } from '../../../lib/format';
import styles from './ControlPanel.module.css';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT'];

export default function ControlPanel({ form, onChange, onSubmit, onReset, loading, error }) {
  return (
    <form
      className={`${styles.panel} glass-strong`}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <header className={styles.panelHead}>
        <div>
          <span className="eyebrow">Конфігурація</span>
          <h2 className={styles.panelTitle}>Параметри backtest</h2>
        </div>
      </header>

      <fieldset className={styles.panelGroup}>
        <legend>Актив і капітал</legend>
        <div className={styles.panelRow}>
          <label className={styles.field}>
            <span>Торгова пара</span>
            <select
              value={form.symbol}
              onChange={(e) => onChange('symbol', e.target.value)}
              className={styles.fieldSelect}
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Початковий депозит</span>
            <div className={styles.fieldGroup}>
              <input
                type="number"
                min="100"
                step="100"
                value={form.initial_balance}
                onChange={(e) => onChange('initial_balance', Number(e.target.value))}
                className={styles.fieldInput}
              />
              <span className={styles.fieldSuffix}>USDT</span>
            </div>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.panelGroup}>
        <legend>Стратегія</legend>
        <div className={styles.panelStrategyTabs}>
          <button
            type="button"
            className={`${styles.tab} ${form.strategy === 'ma_crossover' ? styles.isActive : ''}`}
            onClick={() => onChange('strategy', 'ma_crossover')}
          >
            MA Crossover
          </button>
          <button
            type="button"
            className={`${styles.tab} ${form.strategy === 'rsi' ? styles.isActive : ''}`}
            onClick={() => onChange('strategy', 'rsi')}
          >
            RSI Mean Reversion
          </button>
        </div>

        {form.strategy === 'ma_crossover' ? (
          <div className={styles.panelRow}>
            <Slider
              label="Fast MA"
              value={form.ma_params.fast_window}
              min={2} max={50} step={1}
              onChange={(v) => onChange('ma_params.fast_window', v)}
            />
            <Slider
              label="Slow MA"
              value={form.ma_params.slow_window}
              min={5} max={120} step={1}
              onChange={(v) => onChange('ma_params.slow_window', v)}
            />
          </div>
        ) : (
          <div className={styles.panelRow}>
            <Slider
              label="RSI period"
              value={form.rsi_params.rsi_period}
              min={2} max={50} step={1}
              onChange={(v) => onChange('rsi_params.rsi_period', v)}
            />
            <Slider
              label="Oversold"
              value={form.rsi_params.oversold}
              min={5} max={45} step={1}
              onChange={(v) => onChange('rsi_params.oversold', v)}
            />
            <Slider
              label="Overbought"
              value={form.rsi_params.overbought}
              min={55} max={95} step={1}
              onChange={(v) => onChange('rsi_params.overbought', v)}
            />
          </div>
        )}
      </fieldset>

      <fieldset className={styles.panelGroup}>
        <legend>Ризик-менеджмент</legend>
        <div className={styles.panelRow}>
          <Slider
            label="Розмір позиції"
            value={form.risk.position_size_percent}
            min={5} max={100} step={5}
            unit="%"
            onChange={(v) => onChange('risk.position_size_percent', v)}
          />
          <Slider
            label="Stop-loss"
            value={form.risk.stop_loss_percent}
            min={1} max={20} step={0.5}
            unit="%"
            onChange={(v) => onChange('risk.stop_loss_percent', v)}
          />
          <Slider
            label="Max drawdown"
            value={form.risk.max_drawdown_percent}
            min={5} max={50} step={1}
            unit="%"
            onChange={(v) => onChange('risk.max_drawdown_percent', v)}
          />
        </div>
      </fieldset>

      {error && (
        <div className={styles.panelError} role="alert">
          ⚠ {error}
        </div>
      )}

      <div className={styles.panelActions}>
        <button type="submit" className={styles.panelSubmit} disabled={loading}>
          <Play size={16} />
          <span>{loading ? 'Виконується…' : 'Запустити backtest'}</span>
        </button>
        <button type="button" className={styles.panelReset} onClick={onReset} disabled={loading}>
          <RotateCcw size={14} />
          <span>Скинути</span>
        </button>
        <p className={styles.panelHint}>
          Симуляція ~ {fmtMoney(form.initial_balance, 0)} початкового капіталу
        </p>
      </div>
    </form>
  );
}

function Slider({ label, value, min, max, step, unit = '', onChange }) {
  return (
    <label className={styles.slider}>
      <div className={styles.sliderTop}>
        <span className={styles.sliderLabel}>{label}</span>
        <span className={`${styles.sliderValue} mono`}>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
