import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  RefreshCw,
  Square,
  Ban,
  Trash2,
  ShieldAlert,
} from "lucide-react";

import Button from "../../components/ui/Button/Button";
import Card, { CardHeader } from "../../components/ui/Card/Card";
import {
  cancelBotOrders,
  clearBotHistory,
  closeBotPosition,
  getBot,
  getBotPosition,
  getBotRisk,
  getBotPerformance,
  listBotEvents,
  listBotOrders,
  startBot,
  stopBot,
  syncBot,
} from "../../api/bots";
import {
  fmtDateTime,
  fmtMoney,
  fmtMoneySigned,
  fmtNumber,
  fmtPct,
  fmtPctSigned,
} from "../../lib/format";
import styles from "./BotDetailPage.module.css";

export default function BotDetailPage() {
  const { botId } = useParams();
  const [bot, setBot] = useState(null);
  const [orders, setOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [position, setPosition] = useState(null);
  const [risk, setRisk] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [
        botData,
        ordersData,
        eventsData,
        positionData,
        riskData,
        performanceData,
      ] = await Promise.all([
        getBot(botId),
        listBotOrders(botId),
        listBotEvents(botId),
        getBotPosition(botId),
        getBotRisk(botId),
        getBotPerformance(botId),
      ]);
      setBot(botData);
      setOrders(ordersData);
      setEvents(eventsData);
      setPosition(positionData);
      setRisk(riskData);
      setPerformance(performanceData);
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося завантажити дані бота.");
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async () => {
    const confirmed = window.confirm(
      "This will close the current exchange position with a reduce-only market order. It will not delete bot history. Continue?",
    );

    if (!confirmed) return;

    try {
      setAction("close-position");
      setError("");
      const result = await closeBotPosition(botId, { confirm: true });
      await load();
      setMessage(result.message || "Position close order submitted.");
    } catch (e) {
      setError(e.detail || e.message || "Не вдалося закрити позицію.");
    } finally {
      setAction("");
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
  const activePositionTakeProfitOrders = orders.filter(
    (order) =>
      order.order_role === "position_take_profit" &&
      ["New", "Created", "PartiallyFilled", "PendingNew", "Untriggered"].includes(
        order.status,
      ),
  );
  const positionSize = Number(position?.size || 0);
  const avgEntryPrice =
    position?.avg_entry_price == null ? null : Number(position.avg_entry_price);
  const markPrice =
    position?.mark_price == null ? null : Number(position.mark_price);
  const positionValue =
    position?.position_value == null ? null : Number(position.position_value);
  const unrealizedPnl =
    position?.unrealized_pnl == null ? null : Number(position.unrealized_pnl);
  const unrealizedPnlPercent =
    position?.unrealized_pnl_percent == null
      ? null
      : Number(position.unrealized_pnl_percent);
  const tpPrice =
    position?.take_profit?.price == null
      ? null
      : Number(position.take_profit.price);
  const tpQty =
    position?.take_profit?.qty == null
      ? null
      : Number(position.take_profit.qty);
  const tpDistancePercent =
    avgEntryPrice && tpPrice
      ? ((tpPrice - avgEntryPrice) / avgEntryPrice) * 100
      : null;
  const runtimeState = bot?.runtime_state || bot?.runtime_status || "stopped";
  const runtimeLabel = getRuntimeLabel(runtimeState);
  const riskBlocked = Boolean(risk?.blocked);
  const riskAtLimit =
    !riskBlocked &&
    typeof risk?.reason === "string" &&
    risk.reason.toLowerCase().startsWith("at ");
  const liveDisabled = Boolean(
    risk?.is_live_environment && !risk?.allow_live_trading,
  );
  const closedCycles = performance?.closed_cycles ?? 0;
  const winningCycles = performance?.winning_cycles ?? 0;
  const winRatePercent = toNumberOrNull(performance?.win_rate_percent);
  const grossRealizedPnl = toNumberOrNull(performance?.gross_realized_pnl);
  const closedFees = toNumberOrNull(performance?.closed_fees);
  const totalFees = toNumberOrNull(performance?.total_fees);
  const netRealizedPnl = toNumberOrNull(performance?.net_realized_pnl);
  const realizedPnlPercent = toNumberOrNull(performance?.realized_pnl_percent);
  const averageCyclePnl = toNumberOrNull(performance?.average_cycle_pnl);
  const performanceUnrealizedPnl = toNumberOrNull(performance?.unrealized_pnl);
  const totalPnl = toNumberOrNull(performance?.total_pnl);
  const totalPnlPercent = toNumberOrNull(performance?.total_pnl_percent);
  const openPositionQty = toNumberOrNull(performance?.open_position_qty);
  const openPositionValue = toNumberOrNull(performance?.open_position_value);

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
                  label="Active Position TP"
                  value={String(activePositionTakeProfitOrders.length)}
                />
                <SummaryCard
                  label="Closed cycles"
                  value={String(closedCycles)}
                />
                <SummaryCard
                  label="Total PnL"
                  value={totalPnl == null ? "—" : fmtMoneySigned(totalPnl)}
                />
              </div>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow="Trading result"
                  title="Performance Summary"
                  action={
                    <span
                      className={`${styles.statusBadge} ${
                        totalPnl == null || totalPnl >= 0
                          ? styles.statusOk
                          : styles.statusLiveDisabled
                      }`}
                    >
                      {totalPnl == null ? "No data" : totalPnl >= 0 ? "Profit" : "Loss"}
                    </span>
                  }
                />

                <dl className={styles.configGrid}>
                  <ConfigItem label="Closed Cycles" value={String(closedCycles)} mono />
                  <ConfigItem label="Winning Cycles" value={String(winningCycles)} mono />
                  <ConfigItem
                    label="Win Rate"
                    value={winRatePercent == null ? "—" : fmtPct(winRatePercent)}
                    mono
                  />
                  <ConfigItem
                    label="Gross Realized PnL"
                    value={grossRealizedPnl == null ? "—" : fmtMoneySigned(grossRealizedPnl)}
                    mono
                  />
                  <ConfigItem
                    label="Closed Fees"
                    value={closedFees == null ? "—" : fmtMoney(closedFees)}
                    mono
                  />
                  <ConfigItem
                    label="Total Fees"
                    value={totalFees == null ? "—" : fmtMoney(totalFees)}
                    mono
                  />
                  <ConfigItem
                    label="Net Realized PnL"
                    value={netRealizedPnl == null ? "—" : fmtMoneySigned(netRealizedPnl)}
                    mono
                  />
                  <ConfigItem
                    label="Realized PnL %"
                    value={realizedPnlPercent == null ? "—" : fmtPctSigned(realizedPnlPercent)}
                    mono
                  />
                  <ConfigItem
                    label="Average Cycle PnL"
                    value={averageCyclePnl == null ? "—" : fmtMoneySigned(averageCyclePnl)}
                    mono
                  />
                  <ConfigItem
                    label="Open Unrealized PnL"
                    value={performanceUnrealizedPnl == null ? "—" : fmtMoneySigned(performanceUnrealizedPnl)}
                    mono
                  />
                  <ConfigItem
                    label="Total PnL"
                    value={totalPnl == null ? "—" : fmtMoneySigned(totalPnl)}
                    mono
                  />
                  <ConfigItem
                    label="Total PnL %"
                    value={totalPnlPercent == null ? "—" : fmtPctSigned(totalPnlPercent)}
                    mono
                  />
                  <ConfigItem
                    label="Open Position Qty"
                    value={openPositionQty == null ? "—" : fmtNumber(openPositionQty, 6)}
                    mono
                  />
                  <ConfigItem
                    label="Open Position Value"
                    value={openPositionValue == null ? "—" : fmtMoney(openPositionValue)}
                    mono
                  />
                </dl>
              </Card>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow="Exchange snapshot"
                  title="Current Position"
                />

                {positionSize > 0 ? (
                  <dl className={styles.configGrid}>
                    <ConfigItem label="Side" value={position?.side || "—"} />
                    <ConfigItem
                      label="Size"
                      value={fmtNumber(positionSize, 6)}
                      mono
                    />
                    <ConfigItem
                      label="Avg Entry Price"
                      value={
                        avgEntryPrice == null
                          ? "—"
                          : fmtNumber(avgEntryPrice, 4)
                      }
                      mono
                    />
                    <ConfigItem
                      label="Mark Price"
                      value={markPrice == null ? "—" : fmtNumber(markPrice, 4)}
                      mono
                    />
                    <ConfigItem
                      label="Unrealized PnL"
                      value={
                        unrealizedPnl == null
                          ? "—"
                          : fmtMoneySigned(unrealizedPnl)
                      }
                      mono
                    />
                    <ConfigItem
                      label="Unrealized PnL %"
                      value={
                        unrealizedPnlPercent == null
                          ? "—"
                          : fmtPctSigned(unrealizedPnlPercent)
                      }
                      mono
                    />
                    <ConfigItem
                      label="Liquidation Price"
                      value={
                        position?.liq_price == null
                          ? "—"
                          : fmtNumber(Number(position.liq_price), 4)
                      }
                      mono
                    />
                    <ConfigItem
                      label="Leverage"
                      value={position?.leverage || "—"}
                      mono
                    />
                    <ConfigItem
                      label="Margin Mode"
                      value={position?.margin_mode || "—"}
                    />
                    <ConfigItem
                      label="Position Value"
                      value={
                        positionValue == null ? "—" : fmtMoney(positionValue)
                      }
                      mono
                    />
                    <ConfigItem
                      label="Active TP Price"
                      value={tpPrice == null ? "—" : fmtNumber(tpPrice, 4)}
                      mono
                    />
                    <ConfigItem
                      label="Active TP Qty"
                      value={tpQty == null ? "—" : fmtNumber(tpQty, 6)}
                      mono
                    />
                    <ConfigItem
                      label="TP Distance %"
                      value={
                        tpDistancePercent == null
                          ? "—"
                          : fmtPct(tpDistancePercent)
                      }
                      mono
                    />
                  </dl>
                ) : (
                  <div className={styles.emptyOrders}>No open position</div>
                )}
              </Card>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow="Safety"
                  title="Risk Management"
                  action={
                    <div className={styles.badgeRow}>
                      <span
                        className={`${styles.statusBadge} ${
                          riskBlocked
                            ? styles.statusBlocked
                            : riskAtLimit
                              ? styles.statusAtLimit
                              : styles.statusOk
                        }`}
                      >
                        {riskBlocked
                          ? "Blocked"
                          : riskAtLimit
                            ? "At limit"
                            : "OK"}
                      </span>
                      {liveDisabled ? (
                        <span
                          className={`${styles.statusBadge} ${styles.statusLiveDisabled}`}
                        >
                          Live disabled
                        </span>
                      ) : null}
                    </div>
                  }
                />

                <dl className={styles.configGrid}>
                  <ConfigItem
                    label="Max Position Qty"
                    value={formatMaybeNumber(risk?.max_position_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label="Current Position Qty"
                    value={formatMaybeNumber(risk?.current_position_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label="Pending Buy Qty"
                    value={formatMaybeNumber(risk?.pending_buy_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label="Potential Total Qty"
                    value={formatMaybeNumber(risk?.potential_total_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label="Max Open Orders"
                    value={
                      risk?.max_open_orders == null
                        ? "—"
                        : String(risk.max_open_orders)
                    }
                    mono
                  />
                  <ConfigItem
                    label="Current Open Orders"
                    value={
                      risk?.current_open_orders == null
                        ? "—"
                        : String(risk.current_open_orders)
                    }
                    mono
                  />
                  <ConfigItem
                    label="Max Notional"
                    value={formatMaybeMoney(risk?.max_notional_usdt)}
                    mono
                  />
                  <ConfigItem
                    label="Estimated Notional"
                    value={formatMaybeMoney(risk?.estimated_notional_usdt)}
                    mono
                  />
                  <ConfigItem
                    label="Live Trading Allowed"
                    value={risk?.allow_live_trading ? "Yes" : "No"}
                  />
                  <ConfigItem
                    label="Risk Status"
                    value={
                      riskBlocked ? "Blocked" : riskAtLimit ? "At limit" : "OK"
                    }
                  />
                </dl>

                {risk?.reason ? (
                  <p className={styles.riskMessage}>{risk.reason}</p>
                ) : null}
              </Card>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow="Configuration"
                  title="Поточні параметри"
                  action={
                    <span
                      className={`${styles.runtimeBadge} ${styles[`runtime${capitalizeRuntimeState(runtimeState)}`] || ""}`}
                    >
                      {runtimeLabel}
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
                {bot.last_risk_message ? (
                  <p className={styles.riskMessage}>
                    Risk: {bot.last_risk_message}
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
                    icon={<ShieldAlert size={16} />}
                    onClick={handleClosePosition}
                    loading={action === "close-position"}
                    disabled={action !== "" || positionSize <= 0}
                  >
                    Close position
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

function capitalizeRuntimeState(value) {
  if (!value) return "Stopped";
  return value
    .split("_")
    .map((part) => capitalize(part))
    .join("");
}

function getRuntimeLabel(value) {
  const labels = {
    stopped: "Stopped",
    running: "Running",
    waiting_for_entry: "Waiting for entry",
    position_open: "Position open",
    tp_active: "TP active",
    risk_blocked: "Risk blocked",
    error: "Error",
  };
  return labels[value] || value;
}

function toNumberOrNull(value) {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMaybeNumber(value, decimals = 2) {
  if (value == null) return "—";
  return fmtNumber(Number(value), decimals);
}

function formatMaybeMoney(value) {
  if (value == null) return "—";
  return fmtMoney(Number(value));
}
