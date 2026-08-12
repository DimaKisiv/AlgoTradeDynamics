import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Archive, DatabaseBackup, ExternalLink, FileKey2,
  Globe2, LoaderCircle, RefreshCw, Server, ShieldCheck,
} from 'lucide-react';

import { complianceApi } from '../../api/compliance';
import Button from '../../components/ui/Button/Button';
import { useLanguage } from '../../context/LanguageContext';
import styles from './CompliancePage.module.css';

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`${styles.pill} ${styles[tone] || ''}`}>{children}</span>;
}

export default function CompliancePage() {
  const { tr, formatDateTime } = useLanguage();
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [policy, logData, incidentData] = await Promise.all([
        complianceApi.overview(),
        complianceApi.operationLogs({ page: 1, page_size: 20 }),
        complianceApi.incidents({ page: 1, page_size: 20 }),
      ]);
      setOverview(policy);
      setLogs(logData.items || []);
      setIncidents(incidentData.items || []);
      setError('');
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося завантажити compliance дані', 'Failed to load compliance data'));
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => { load(); }, [load]);

  if (loading && !overview) {
    return <main className={styles.page}><div className="container"><div className={styles.loading}><LoaderCircle className={styles.spin}/>{tr('Завантаження…', 'Loading…')}</div></div></main>;
  }

  return <main className={styles.page}>
    <div className="container">
      <header className={styles.hero}>
        <div>
          <span className="eyebrow">Compliance</span>
          <h1 className="display-3">{tr('Юрисдикція, приватність та операційна стійкість', 'Jurisdiction, privacy & operational resilience')}</h1>
          <p>{tr(
            'Compliance-oriented контур дипломного MVP: політики, retention, GDPR controls, operations logs та incident register.',
            'Compliance-oriented diploma MVP controls: policy, retention, GDPR controls, operations logs, and the incident register.',
          )}</p>
        </div>
        <div className={styles.heroActions}>
          <Link className={styles.auditLink} to="/compliance/audit"><FileKey2 size={16}/>{tr('Audit Trail', 'Audit Trail')}</Link>
          <Button variant="ghost" icon={<RefreshCw size={16}/>} onClick={load}>{tr('Оновити', 'Refresh')}</Button>
        </div>
      </header>

      {error && <div className={styles.error}>{error}</div>}

      {overview && <>
        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}><Globe2 size={20}/><span>{tr('Reference jurisdiction', 'Reference jurisdiction')}</span><strong>{overview.reference_jurisdiction}</strong><small>{tr('ЄС — reference model для MVP', 'EU reference model for the MVP')}</small></article>
          <article className={styles.summaryCard}><Server size={20}/><span>{tr('Hosting target', 'Hosting target')}</span><strong>{overview.hosting_target_region}</strong><small>{overview.hosting_provider}</small></article>
          <article className={styles.summaryCard}><DatabaseBackup size={20}/><span>{tr('Recovery targets', 'Recovery targets')}</span><strong>RPO {overview.recovery_targets?.RPO_hours}h · RTO {overview.recovery_targets?.RTO_hours}h</strong><small>{overview.backup_policy?.frequency} backup policy</small></article>
          <article className={styles.summaryCard}><ShieldCheck size={20}/><span>{tr('Статус', 'Status')}</span><strong>{tr('Compliance-oriented MVP', 'Compliance-oriented MVP')}</strong><small>{tr('Не твердження про ліцензію CASP', 'Not a claim of CASP authorization')}</small></article>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className="eyebrow">Policy</span><h2>{tr('Регуляторна рамка', 'Regulatory reference framework')}</h2></div></div>
          <div className={styles.frameworks}>{overview.frameworks_considered.map((item) => <div key={item}><ShieldCheck size={16}/><span>{item}</span></div>)}</div>
          <p className={styles.note}>{overview.compliance_status}</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><span className="eyebrow">Retention</span><h2>{tr('Матриця зберігання даних', 'Data retention matrix')}</h2></div><Archive size={20}/></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{tr('Дані', 'Data')}</th><th>{tr('Строк', 'Retention')}</th><th>{tr('Підстава', 'Basis')}</th><th>{tr('Видалення', 'Deletion')}</th></tr></thead><tbody>
            {overview.retention_matrix.map((row) => <tr key={row.data_type}><td><strong>{row.data_type}</strong></td><td>{row.retention}</td><td>{row.basis}</td><td>{row.deletion_behavior}</td></tr>)}
          </tbody></table></div>
        </section>

        <section className={styles.twoCol}>
          <article className={styles.panel}>
            <div className={styles.panelHead}><div><span className="eyebrow">Hosting</span><h2>{tr('Розміщення та backup policy', 'Hosting & backup policy')}</h2></div><Server size={20}/></div>
            <dl className={styles.definitionList}>
              <div><dt>{tr('Регіон', 'Region')}</dt><dd>{overview.hosting_target_region}</dd></div>
              <div><dt>{tr('Data residency', 'Data residency')}</dt><dd>{overview.data_residency}</dd></div>
              <div><dt>{tr('Частота backup', 'Backup frequency')}</dt><dd>{overview.backup_policy?.frequency}</dd></div>
              <div><dt>{tr('Daily retention', 'Daily retention')}</dt><dd>{overview.backup_policy?.daily_retention_days} {tr('днів', 'days')}</dd></div>
              <div><dt>{tr('Monthly retention', 'Monthly retention')}</dt><dd>{overview.backup_policy?.monthly_retention_months} {tr('місяців', 'months')}</dd></div>
            </dl>
            <p className={styles.note}>{overview.backup_policy?.implementation}</p>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHead}><div><span className="eyebrow">Processors / Third parties</span><h2>{tr('Зовнішні сервіси', 'Third-party services')}</h2></div><ExternalLink size={20}/></div>
            <div className={styles.thirdParties}>{overview.third_parties.map((item) => <div key={item.name}><strong>{item.name}</strong><span>{item.purpose}</span><small>{item.data_shared}</small></div>)}</div>
          </article>
        </section>
      </>}

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span className="eyebrow">Operations</span><h2>{tr('Операційні логи', 'Operations logs')}</h2></div><Activity size={20}/></div>
        {logs.length === 0 ? <div className={styles.empty}>{tr('Operational logs ще відсутні.', 'No operational logs yet.')}</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{tr('Час', 'Time')}</th><th>Level</th><th>Request</th><th>Status</th><th>Latency</th><th>Request ID</th></tr></thead><tbody>
          {logs.map((item) => <tr key={item.id}><td>{formatDateTime(item.occurred_at)}</td><td><StatusPill tone={item.level === 'ERROR' ? 'danger' : item.level === 'WARN' ? 'warn' : 'good'}>{item.level}</StatusPill></td><td><strong>{item.method || item.service}</strong> {item.path || item.message}</td><td>{item.status_code ?? '—'}</td><td>{item.duration_ms != null ? `${item.duration_ms.toFixed(1)} ms` : '—'}</td><td><code>{item.request_id || '—'}</code></td></tr>)}
        </tbody></table></div>}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><span className="eyebrow">Incidents</span><h2>{tr('Incident register', 'Incident register')}</h2></div><AlertTriangle size={20}/></div>
        {incidents.length === 0 ? <div className={styles.empty}>{tr('Відкритих або історичних incidents ще немає.', 'There are no current or historical incidents yet.')}</div> : <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{tr('Відкрито', 'Opened')}</th><th>Severity</th><th>{tr('Тип', 'Type')}</th><th>Bot</th><th>Status</th><th>{tr('Автоматична дія', 'Automatic action')}</th><th>{tr('Закрито', 'Resolved')}</th></tr></thead><tbody>
          {incidents.map((item) => <tr key={item.id}><td>{formatDateTime(item.opened_at)}</td><td><StatusPill tone={item.severity === 'CRITICAL' ? 'danger' : 'warn'}>{item.severity}</StatusPill></td><td><strong>{item.incident_type}</strong><small>{item.description}</small></td><td>#{item.bot_id || '—'}</td><td><StatusPill tone={item.status === 'RESOLVED' ? 'good' : 'danger'}>{item.status}</StatusPill></td><td>{item.action_taken || '—'}</td><td>{item.resolved_at ? formatDateTime(item.resolved_at) : '—'}</td></tr>)}
        </tbody></table></div>}
      </section>
    </div>
  </main>;
}
