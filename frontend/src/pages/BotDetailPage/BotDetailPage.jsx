import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, Square } from "lucide-react";

import Button from "../../components/ui/Button/Button";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import {
  getBot,
  listBotOrders,
  startBot,
  stopBot,
  syncBot,
} from "../../api/bots";
import { fmtDateTime, fmtNumber } from "../../lib/format";
import styles from "./BotDetailPage.module.css";

export default function BotDetailPage() {
  const { botId } = useParams();
  const [bot, setBot] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [botData, ordersData] = await Promise.all([
        getBot(botId),
        listBotOrders(botId),
      ]);
      setBot(botData);
      setOrders(ordersData);
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося завантажити дані бота.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [botId]);

  const handleStart = async () => {
    try {
      setAction("start");
      setError("");
      const result = await startBot(botId);
      await load();
      setMessage(result.message || "Цикл бота виконано.");
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося запустити бота.");
    } finally {
      setAction("");
    }
  };

  const handleStop = async () => {
    try {
      setAction("stop");
      setError("");
      await stopBot(botId);
      await load();
      setMessage("Бот зупинено.");
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося зупинити бота.");
    } finally {
      setAction("");
    }
  };

  const handleSync = async () => {
    try {
      setAction("sync");
      setError("");
      const syncedOrders = await syncBot(botId);
      await load();
      setMessage(
        `Синхронізацію завершено. Оновлено ордерів: ${syncedOrders.length}.`,
      );
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося синхронізувати ордери.");
    } finally {
      setAction("");
    }
  };

  return (
    <main className={styles.botDetail}>
      <div className="container">
        <Link to="/bots" className={styles.backLink}>
          <ArrowLeft size={16} /> Усі боти
        </Link>

        {loading && <div className={styles.state}>Завантаження…</div>}
        {error && (
          <div className={`${styles.state} ${styles.stateError}`}>{error}</div>
        )}
        {message && !error && <div className={styles.state}>{message}</div>}

        {bot ? (
          <div className={styles.layout}>
            <section className={styles.summary}>
              <header className={styles.head}>
                <span className="eyebrow">Bot #{bot.id}</span>
                <h1 className="display-2">{bot.name}</h1>
                <p className="lead">
                  Разовий запуск створює grid-ордери лише якщо на біржі немає
                  поточної позиції та відкритих ордерів для цього символу.
                </p>
              </header>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow="Configuration"
                  title="Поточні параметри"
                  action={
                    <span
                      className={`${styles.runtimeBadge} ${styles[`runtime${capitalize(bot.runtime_status)}`] || ""}`}
                    >
                      {bot.runtime_status}
                    </span>
                  }
                />

                <dl className={styles.configGrid}>
                  <ConfigItem label="Exchange" value={bot.exchange} />
                  <ConfigItem label="Environment" value={bot.environment} />
                  <ConfigItem label="Category" value={bot.category} />
                  <ConfigItem label="Symbol" value={bot.symbol} mono />
                  <ConfigItem label="Strategy" value={bot.strategy_type} />
                  <ConfigItem
                    label="Order Qty"
                    value={fmtNumber(bot.order_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label="Grid Orders"
                    value={String(bot.grid_orders_count)}
                    mono
                  />
                  <ConfigItem
                    label="Grid Step %"
                    value={fmtNumber(bot.grid_step_percent)}
                    mono
                  />
                  <ConfigItem
                    label="Enabled"
                    value={bot.is_active ? "Yes" : "No"}
                  />
                  <ConfigItem
                    label="Started At"
                    value={fmtDateTime(bot.started_at)}
                    mono
                  />
                  <ConfigItem
                    label="Stopped At"
                    value={fmtDateTime(bot.stopped_at)}
                    mono
                  />
                  <ConfigItem
                    label="Last Run"
                    value={fmtDateTime(bot.last_run_at)}
                    mono
                  />
                </dl>

                {bot.last_error ? (
                  <p className={styles.lastError}>
                    Last error: {bot.last_error}
                  </p>
                ) : null}

                <div className={styles.actions}>
                  <Button
                    icon={<Play size={16} />}
                    onClick={handleStart}
                    loading={action === "start"}
                  >
                    Start bot
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<Square size={16} />}
                    onClick={handleStop}
                    disabled={action !== ""}
                  >
                    Stop bot
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<RefreshCw size={16} />}
                    onClick={handleSync}
                    loading={action === "sync"}
                  >
                    Sync orders
                  </Button>
                </div>
              </Card>
            </section>

            <section>
              <Card className={styles.ordersCard}>
                <CardHeader eyebrow="Orders / Trades" title="Історія ордерів" />

                {orders.length === 0 ? (
                  <div className={styles.emptyOrders}>Ордерів ще немає.</div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Created</th>
                          <th>Symbol</th>
                          <th>Side</th>
                          <th>Type</th>
                          <th>Role</th>
                          <th>Qty</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>Exchange ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((order) => (
                          <tr key={order.id}>
                            <td>{fmtDateTime(order.created_at)}</td>
                            <td className="mono">{order.symbol}</td>
                            <td>{order.side}</td>
                            <td>{order.order_type}</td>
                            <td>{order.order_role}</td>
                            <td className="mono">{fmtNumber(order.qty, 6)}</td>
                            <td className="mono">
                              {order.price == null
                                ? "—"
                                : fmtNumber(order.price, 4)}
                            </td>
                            <td>{order.status}</td>
                            <td className="mono">
                              {order.exchange_order_id || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ConfigItem({ label, value, mono = false }) {
  return (
    <div className={styles.configItem}>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value || "—"}</dd>
    </div>
  );
}

function capitalize(value) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
