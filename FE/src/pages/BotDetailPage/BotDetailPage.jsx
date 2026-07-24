import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play, RefreshCw, Square, Ban, Trash2 } from "lucide-react";

import Button from "../../components/ui/Button/Button";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import {
  cancelBotOrders,
  clearBotHistory,
  getBot,
  listBotEvents,
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
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [botData, ordersData, eventsData] = await Promise.all([
        getBot(botId),
        listBotOrders(botId),
        listBotEvents(botId),
      ]);
      setBot(botData);
      setOrders(ordersData);
      setEvents(eventsData);
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося завантажити дані бота.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [botId]);

  useEffect(() => {
    if (!bot || bot.runtime_status !== "running") {return undefined;}
    const intervalId = window.setInterval(() => {
      load();
    }, 7000);
    return () => window.clearInterval(intervalId);
  }, [botId, bot?.runtime_status]);

  const handleStart = async () => {
    try {
      setAction("start");
      setError("");
      const result = await startBot(botId);
      await load();
      setMessage(result.message || "Бот запущено.");
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

  const handleCancelOrders = async () => {
    try {
      setAction("cancel");
      setError("");
      const cancelled = await cancelBotOrders(botId);
      await load();
      setMessage(`Скасовано ордерів: ${cancelled.length}.`);
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося скасувати ордери.");
    } finally {
      setAction("");
    }
  };

  const handleClearHistory = async () => {
    const confirmed = window.confirm(
      "This will stop the bot, cancel open bot orders, and delete local order/event history. It will NOT close existing Bybit positions. Continue?",
    );

    if (!confirmed) {return;}

    try {
      setAction("clear");
      setError("");

      const result = await clearBotHistory(botId);

      await load();

      setMessage(
        `History cleared. Deleted orders: ${result.orders_deleted}. Deleted events: ${result.events_deleted}. Cancelled exchange orders: ${result.exchange_orders_cancelled}.`,
      );
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося очистити історію бота.");
    } finally {
      setAction("");
    }
  };

  const openOrders = orders.filter((order) =>
    ["New", "Created", "PartiallyFilled", "PendingNew", "Untriggered"].includes(
      order.status,
    ),
  );
  const filledOrders = orders.filter((order) => order.status === "Filled");
  const positionTakeProfitOrders = orders.filter(
    (order) => order.order_role === "position_take_profit",
  );
  const activePositionTakeProfit = positionTakeProfitOrders.find((order) =>
    ["New", "Created", "PartiallyFilled", "PendingNew", "Untriggered"].includes(
      order.status,
    ),
  );
  const positionSnapshot = activePositionTakeProfit?.raw_response || {};
  const positionSize = positionSnapshot.positionSize ?? null;
  const avgEntryPrice = positionSnapshot.avgEntryPrice ?? null;
  const positionTpPrice =
    activePositionTakeProfit?.price ?? positionSnapshot.tpPrice ?? null;
  const positionTpQty =
    activePositionTakeProfit?.qty ?? positionSnapshot.tpQty ?? null;

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
                  Поки бот має статус running, бекендовий worker періодично
                  синхронізує ордери, підтримує один Position TP для поточної
                  long-позиції та відновлює рівні сітки після закриття циклів.
                </p>
              </header>

              <div className={styles.summaryGrid}>
                <SummaryCard
                  label="Last sync"
                  value={fmtDateTime(bot.last_run_at)}
                />
                <SummaryCard
                  label="Open orders"
                  value={String(openOrders.length)}
                />
                <SummaryCard
                  label="Filled orders"
                  value={String(filledOrders.length)}
                />
                <SummaryCard
                  label="Position TP"
                  value={String(positionTakeProfitOrders.length)}
                />
              </div>

              <Card className={styles.configCard}>
                <CardHeader eyebrow="Current position" title="Position TP" />

                <dl className={styles.configGrid}>
                  <ConfigItem
                    label="Position Size"
                    value={
                      positionSize == null ? "—" : fmtNumber(positionSize, 6)
                    }
                    mono
                  />
                  <ConfigItem
                    label="Avg Entry Price"
                    value={
                      avgEntryPrice == null ? "—" : fmtNumber(avgEntryPrice, 4)
                    }
                    mono
                  />
                  <ConfigItem
                    label="TP Price"
                    value={
                      positionTpPrice == null
                        ? "—"
                        : fmtNumber(positionTpPrice, 4)
                    }
                    mono
                  />
                  <ConfigItem
                    label="TP Qty"
                    value={
                      positionTpQty == null ? "—" : fmtNumber(positionTpQty, 6)
                    }
                    mono
                  />
                </dl>
              </Card>

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
                  <Button
                    variant="danger"
                    icon={<Ban size={16} />}
                    onClick={handleCancelOrders}
                    loading={action === "cancel"}
                  >
                    Cancel all orders
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={16} />}
                    onClick={handleClearHistory}
                    loading={action === "clear"}
                    disabled={action !== "" && action !== "clear"}
                  >
                    Clear history
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
                            <td>
                              {order.order_role === "position_take_profit"
                                ? "position_take_profit (Position TP)"
                                : order.order_role}
                            </td>
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

              <Card className={styles.eventsCard}>
                <CardHeader eyebrow="Worker events" title="Журнал подій бота" />

                {events.length === 0 ? (
                  <div className={styles.emptyOrders}>Подій ще немає.</div>
                ) : (
                  <div className={styles.eventsList}>
                    {events.map((event) => (
                      <article key={event.id} className={styles.eventRow}>
                        <div>
                          <p className={styles.eventType}>{event.event_type}</p>
                          <p className={styles.eventMessage}>{event.message}</p>
                        </div>
                        <time className="mono">
                          {fmtDateTime(event.created_at)}
                        </time>
                      </article>
                    ))}
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

function SummaryCard({ label, value }) {
  return (
    <div className={styles.summaryCard}>
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
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
  if (!value) {return "";}
  return value.charAt(0).toUpperCase() + value.slice(1);
}
