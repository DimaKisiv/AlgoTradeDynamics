import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { fmtMoney, fmtPctSigned, fmtMoneySigned } from '../../lib/format';
import './TradeJournal.css';

export default function TradeJournal({ trades }) {
  if (!trades?.length) {
    return (
      <div className="journal-empty">
        <p>За цей backtest не було жодної угоди.</p>
        <p className="text-tertiary">Спробуйте інші параметри стратегії або період.</p>
      </div>
    );
  }

  return (
    <div className="journal">
      <div className="journal__head">
        <div>#</div>
        <div>Вхід</div>
        <div>Вихід</div>
        <div>Ціна входу</div>
        <div>Ціна виходу</div>
        <div>PnL</div>
        <div>%</div>
        <div>Причина</div>
      </div>
      <div className="journal__body">
        {trades.map((t, i) => {
          const positive = t.pnl >= 0;
          return (
            <div key={t.id ?? i} className={`journal__row ${positive ? 'is-up' : 'is-down'}`}>
              <div className="journal__cell mono journal__index">{i + 1}</div>
              <div className="journal__cell mono">{t.entry_date}</div>
              <div className="journal__cell mono">{t.exit_date}</div>
              <div className="journal__cell mono">{fmtMoney(t.entry_price)}</div>
              <div className="journal__cell mono">{fmtMoney(t.exit_price)}</div>
              <div className="journal__cell mono journal__pnl">
                {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {fmtMoneySigned(t.pnl)}
              </div>
              <div className="journal__cell mono">{fmtPctSigned(t.pnl_percent)}</div>
              <div className="journal__cell journal__reason">{t.reason}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
