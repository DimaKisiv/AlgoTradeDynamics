import { useCallback, useState } from 'react';
import { startBacktest } from '../api/backtests';

const DEFAULT_FORM = {
  symbol: 'BTC/USDT',
  initial_balance: 10000,
  strategy: 'ma_crossover',
  ma_params: { fast_window: 10, slow_window: 30 },
  rsi_params: { rsi_period: 14, oversold: 30, overbought: 70 },
  risk: {
    position_size_percent: 20,
    stop_loss_percent: 5,
    max_drawdown_percent: 25,
  },
};

export function useBacktest(initialForm = DEFAULT_FORM) {
  const [form, setForm] = useState(initialForm);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateField = useCallback((path, value) => {
    setForm((prev) => {
      const next = structuredClone(prev);
      const keys = path.split('.');
      let target = next;
      for (let i = 0; i < keys.length - 1; i += 1) target = target[keys[i]];
      target[keys.at(-1)] = value;
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const result = await startBacktest(form);
      setRun(result);
      return result;
    } catch (err) {
      setError(err.detail || err.message || 'Невідома помилка');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [form]);

  const reset = useCallback(() => {
    setForm(initialForm);
    setRun(null);
    setError('');
  }, [initialForm]);

  return { form, run, loading, error, updateField, submit, setRun, reset };
}

export { DEFAULT_FORM };
