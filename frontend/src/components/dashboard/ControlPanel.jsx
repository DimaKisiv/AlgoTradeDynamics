import { Play, RotateCcw } from 'lucide-react';
import { fmtMoney } from '../../lib/format';
import './ControlPanel.css';

const SYMBOLS = ['BTC/USDT', 'ETH/USDT'];

export default function ControlPanel({ form, onChange, onSubmit, onReset, loading, error }) {
  return (
    <form
      className="panel glass-strong"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <header className="panel__head">
        <div>
          <span className="eyebrow">Конфігурація</span>
          <h2 className="panel__title">Параметри backtest</h2>
        </div>
      </header>

      <fieldset className="panel__group">
        <legend>Актив і капітал</legend>
        <div className="panel__row">
          <label className="field">
            <span>Торгова пара</span>
            <select
              value={form.symbol}
              onChange={(e) => onChange('symbol', e.target.value)}
              className="field__select"
            >
              {SYMBOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Початковий депозит</span>
            <div className="field__group">
              <input
                type="number"
                min="100"
                step="100"
                value={form.initial_balance}
                onChange={(e) => onChange('initial_balance', Number(e.target.value))}
                className="field__input"
              />
              <span className="field__suffix">USDT</span>
            </div>
          </label>
        </div>
      </fieldset>

      <fieldset className="panel__group">
        <legend>Стратегія</legend>
        <div className="panel__strategy-tabs">
          <button
            type="button"
            className={`tab ${form.strategy === 'ma_crossover' ? 'is-active' : ''}`}
            onClick={() => onChange('strategy', 'ma_crossover')}
          >
            MA Crossover
          </button>
          <button
            type="button"
            className={`tab ${form.strategy === 'rsi' ? 'is-active' : ''}`}
            onClick={() => onChange('strategy', 'rsi')}
          >
            RSI Mean Reversion
          </button>
        </div>

        {form.strategy === 'ma_crossover' ? (
          <div className="panel__row">
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
          <div className="panel__row">
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

      <fieldset className="panel__group">
        <legend>Ризик-менеджмент</legend>
        <div className="panel__row">
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
        <div className="panel__error" role="alert">
          ⚠ {error}
        </div>
      )}

      <div className="panel__actions">
        <button type="submit" className="panel__submit" disabled={loading}>
          <Play size={16} />
          <span>{loading ? 'Виконується…' : 'Запустити backtest'}</span>
        </button>
        <button type="button" className="panel__reset" onClick={onReset} disabled={loading}>
          <RotateCcw size={14} />
          <span>Скинути</span>
        </button>
        <p className="panel__hint">
          Симуляція ~ {fmtMoney(form.initial_balance, 0)} початкового капіталу
        </p>
      </div>
    </form>
  );
}

function Slider({ label, value, min, max, step, unit = '', onChange }) {
  return (
    <label className="slider">
      <div className="slider__top">
        <span className="slider__label">{label}</span>
        <span className="slider__value mono">{value}{unit}</span>
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
