import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Download, FileClock, Filter,
  Hash, LoaderCircle, Search, ShieldCheck, X, XCircle,
} from "lucide-react";

import { auditApi } from "../../api/audit";
import Button from "../../components/ui/Button/Button";
import { useLanguage } from "../../context/LanguageContext";
import styles from "./AuditTrailPage.module.css";

const CATEGORIES = [
  "API_ACTION", "SECURITY", "BOT_CONFIGURATION", "BOT_LIFECYCLE", "STRATEGY",
  "RISK", "ORDER", "POSITION", "ERROR", "SYSTEM",
];

const shortHash = (value) => value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "—";

function Stat({ icon, label, value, tone = "" }) {
  return <div className={`${styles.stat} ${tone ? styles[tone] : ""}`}>
    <span>{icon}{label}</span><strong>{value}</strong>
  </div>;
}

function categoryLabel(category, tr) {
  const labels = {
    API_ACTION: tr("API дії", "API actions"), SECURITY: tr("Безпека", "Security"),
    BOT_CONFIGURATION: tr("Конфігурація", "Configuration"), BOT_LIFECYCLE: tr("Життєвий цикл", "Lifecycle"),
    STRATEGY: tr("Стратегія", "Strategy"), RISK: tr("Ризик", "Risk"), ORDER: tr("Ордери", "Orders"),
    POSITION: tr("Позиції", "Positions"), ERROR: tr("Помилки", "Errors"), SYSTEM: tr("Система", "System"),
  };
  return labels[category] || category;
}

export default function AuditTrailPage() {
  const { tr, formatDateTime } = useLanguage();
  const [data, setData] = useState({ items: [], page: 1, page_size: 50, total: 0, pages: 0 });
  const [integrity, setIntegrity] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ category: "", event_type: "", bot_id: "", symbol: "", correlation_id: "" });
  const [applied, setApplied] = useState({});
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [events, integrityResult] = await Promise.all([
        auditApi.list({ ...applied, page, page_size: 50 }), auditApi.integrity(),
      ]);
      setData(events);
      setIntegrity(integrityResult);
      setError("");
    } catch (e) {
      setError(e.detail || e.message || tr("Не вдалося завантажити audit trail", "Failed to load audit trail"));
    } finally {
      setLoading(false);
    }
  }, [applied, page, tr]);

  useEffect(() => { load(); }, [load]);

  const activeFilters = useMemo(() => Object.values(applied).filter(Boolean).length, [applied]);

  const apply = (event) => {
    event.preventDefault();
    setPage(1);
    setApplied(Object.fromEntries(Object.entries(filters).filter(([, value]) => String(value).trim() !== "")));
  };

  const clear = () => {
    const empty = { category: "", event_type: "", bot_id: "", symbol: "", correlation_id: "" };
    setFilters(empty); setApplied({}); setPage(1);
  };

  const doExport = async (format) => {
    try { await auditApi.export(format, applied); }
    catch (e) { setError(e.detail || e.message || tr("Не вдалося експортувати audit trail", "Failed to export audit trail")); }
  };

  return <main className={styles.page}>
    <div className="container">
      <div className={styles.hero}>
        <div>
          <span className="eyebrow">{tr("Комплаєнс", "Compliance")}</span>
          <h1>{tr("Regulatory Audit Trail", "Regulatory Audit Trail")}</h1>
          <p className="lead">{tr(
            "Незмінна історія фінансових, торгових, системних і користувацьких дій. Operational history можна очистити, цей ledger — ні.",
            "Immutable history of financial, trading, system, and user actions. Operational history can be cleared; this ledger cannot.",
          )}</p>
        </div>
        <div className={styles.exportActions}>
          <Button variant="ghost" icon={<Download size={16}/>} onClick={() => doExport("csv")}>CSV</Button>
          <Button variant="ghost" icon={<Download size={16}/>} onClick={() => doExport("json")}>JSON</Button>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.stats}>
        <Stat icon={<FileClock size={15}/>} label={tr("Записів", "Records")} value={data.total.toLocaleString()} />
        <Stat icon={<ShieldCheck size={15}/>} label={tr("Юрисдикція", "Jurisdiction")} value={data.items[0]?.jurisdiction || "EU"} />
        <Stat icon={<Hash size={15}/>} label={tr("Hash-chain", "Hash-chain")} value={integrity?.valid ? tr("Валідний", "Valid") : tr("Проблема", "Problem")} tone={integrity?.valid ? "good" : "bad"} />
        <Stat icon={<Filter size={15}/>} label={tr("Фільтрів", "Filters")} value={activeFilters} />
      </div>

      <form className={styles.filters} onSubmit={apply}>
        <label><span>{tr("Категорія", "Category")}</span><select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
          <option value="">{tr("Всі", "All")}</option>{CATEGORIES.map((item) => <option key={item} value={item}>{categoryLabel(item, tr)}</option>)}
        </select></label>
        <label><span>{tr("Тип події", "Event type")}</span><input value={filters.event_type} onChange={(e) => setFilters((f) => ({ ...f, event_type: e.target.value }))} placeholder="ORDER_FILLED" /></label>
        <label><span>Bot ID</span><input type="number" min="1" value={filters.bot_id} onChange={(e) => setFilters((f) => ({ ...f, bot_id: e.target.value }))} /></label>
        <label><span>{tr("Символ", "Symbol")}</span><input value={filters.symbol} onChange={(e) => setFilters((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))} placeholder="BTCUSDT" /></label>
        <label className={styles.wide}><span>Correlation ID</span><input value={filters.correlation_id} onChange={(e) => setFilters((f) => ({ ...f, correlation_id: e.target.value }))} placeholder="order:atd-..." /></label>
        <div className={styles.filterActions}>
          <Button type="submit" icon={<Search size={15}/>}>{tr("Застосувати", "Apply")}</Button>
          <Button type="button" variant="ghost" icon={<X size={15}/>} onClick={clear}>{tr("Очистити", "Clear")}</Button>
        </div>
      </form>

      <div className={styles.integrity}>
        {integrity?.valid ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}<div>
          <strong>{integrity?.valid ? tr("Цілісність підтверджена", "Integrity verified") : tr("Цілісність порушена", "Integrity problem detected")}</strong>
          <span>{tr("Перевірено", "Checked")} {integrity?.checked_events ?? 0} {tr("ваших audit-записів", "of your audit records")}{integrity?.first_invalid_event_id ? ` · #${integrity.first_invalid_event_id}` : ""}</span>
        </div>
      </div>

      {loading ? <div className={styles.loading}><LoaderCircle className={styles.spin}/>{tr("Завантаження…", "Loading…")}</div> : data.items.length === 0 ? <div className={styles.empty}>{tr("Audit records за цими фільтрами відсутні.", "No audit records match these filters.")}</div> : <>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr>
          <th>{tr("Час", "Time")}</th><th>{tr("Подія", "Event")}</th><th>{tr("Суб'єкт", "Actor")}</th><th>{tr("Контекст", "Context")}</th><th>{tr("Ордер / Correlation", "Order / Correlation")}</th><th>Hash</th>
        </tr></thead><tbody>{data.items.map((item) => <tr key={item.id} onClick={() => setSelected(item)} className={selected?.id === item.id ? styles.selected : ""}>
          <td><strong>#{item.id}</strong><small>{formatDateTime(item.occurred_at)}</small></td>
          <td><span className={`${styles.category} ${styles[`cat${item.category}`] || ""}`}>{categoryLabel(item.category, tr)}</span><strong className={styles.eventType}>{item.event_type}</strong><small>{item.message}</small></td>
          <td><strong>{item.actor_type}</strong><small>{item.actor_label || `User #${item.user_id || "—"}`}</small></td>
          <td><strong>{item.symbol || "—"}</strong><small>{item.exchange || "—"} · {item.environment || "—"} · Bot #{item.bot_id || "—"}</small></td>
          <td><strong className={styles.mono}>{item.order_link_id || "—"}</strong><small className={styles.mono}>{item.correlation_id || "—"}</small></td>
          <td><code title={item.event_hash}>{shortHash(item.event_hash)}</code></td>
        </tr>)}</tbody></table></div>
        <div className={styles.pagination}>
          <Button variant="ghost" disabled={page <= 1} icon={<ChevronLeft size={16}/>} onClick={() => setPage((p) => Math.max(1, p - 1))}>{tr("Назад", "Previous")}</Button>
          <span>{tr("Сторінка", "Page")} {data.page} / {Math.max(data.pages, 1)}</span>
          <Button variant="ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>{tr("Далі", "Next")} <ChevronRight size={16}/></Button>
        </div>
      </>}

      {selected && <section className={styles.detail}>
        <div className={styles.detailHead}><div><span className="eyebrow">{tr("Запис", "Record")} #{selected.id}</span><h2>{selected.event_type}</h2></div><button onClick={() => setSelected(null)} aria-label={tr("Закрити", "Close")}><X size={18}/></button></div>
        <div className={styles.detailGrid}>
          <div><span>{tr("Час події", "Occurred")}</span><strong>{formatDateTime(selected.occurred_at)}</strong></div>
          <div><span>{tr("Час запису", "Recorded")}</span><strong>{formatDateTime(selected.recorded_at)}</strong></div>
          <div><span>Correlation ID</span><strong>{selected.correlation_id || "—"}</strong></div>
          <div><span>Order Link ID</span><strong>{selected.order_link_id || "—"}</strong></div>
          <div><span>{tr("Кількість", "Quantity")}</span><strong>{selected.quantity ?? "—"}</strong></div>
          <div><span>{tr("Ціна", "Price")}</span><strong>{selected.price ?? "—"}</strong></div>
          <div><span>{tr("Комісія", "Fee")}</span><strong>{selected.fee ?? "—"}</strong></div>
          <div><span>{tr("Realized PnL", "Realized PnL")}</span><strong>{selected.realized_pnl ?? "—"}</strong></div>
          <div><span>Config hash</span><strong className={styles.mono}>{selected.config_hash || "—"}</strong></div>
          <div><span>{tr("Зберігати до", "Retain until")}</span><strong>{formatDateTime(selected.retention_until)}</strong></div>
        </div>
        <div className={styles.hashes}><div><span>Previous hash</span><code>{selected.previous_hash || "GENESIS"}</code></div><div><span>Event hash</span><code>{selected.event_hash}</code></div></div>
        <div className={styles.payload}><span>Payload snapshot</span><pre>{JSON.stringify(selected.payload, null, 2)}</pre></div>
      </section>}
    </div>
  </main>;
}
