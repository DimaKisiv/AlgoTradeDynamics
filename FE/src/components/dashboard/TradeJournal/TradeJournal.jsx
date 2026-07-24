import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { fmtMoney, fmtPctSigned, fmtMoneySigned } from '../../../lib/format';
import styles from './TradeJournal.module.css';

export default function TradeJournal({ trades }) {
  if (!trades?.length) {
    return (
      <div className={styles.journalEmpty}>
        <p>За цей backtest не було жодної угоди.</p>
        <p className="text-tertiary">Спробуйте інші параметри стратегії або період.</p>
      </div>
    );
  }

  return (
    <div className={styles.journal}>
      <div className={styles.journalHead}>
        <div>#</div>
        <div>Вхід</div>
        <div>Вихід</div>
        <div>Ціна входу</div>
        <div>Ціна виходу</div>
        <div>PnL</div>
        <div>%</div>
        <div>Причина</div>
      </div>
      <div className={styles.journalBody}>
        {trades.map((t, i) => {
          const positive = t.pnl >= 0;
          return (
            <div key={t.id ?? i} className={`${styles.journalRow} ${positive ? styles.isUp : styles.isDown}`}>
              <div className={`${styles.journalCell} mono ${styles.journalIndex}`}>{i + 1}</div>
              <div className={`${styles.journalCell} mono`}>{t.entry_date}</div>
              <div className={`${styles.journalCell} mono`}>{t.exit_date}</div>
              <div className={`${styles.journalCell} mono`}>{fmtMoney(t.entry_price)}</div>
              <div className={`${styles.journalCell} mono`}>{fmtMoney(t.exit_price)}</div>
              <div className={`${styles.journalCell} mono ${styles.journalPnl}`}>
                {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {fmtMoneySigned(t.pnl)}
              </div>
              <div className={`${styles.journalCell} mono`}>{fmtPctSigned(t.pnl_percent)}</div>
              <div className={`${styles.journalCell} ${styles.journalReason}`}>{t.reason}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
