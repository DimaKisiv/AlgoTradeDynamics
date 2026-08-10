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
  EventBadge,
  OrderTypeBadge,
  PnlValue,
  RoleBadge,
  SideBadge,
  StatusBadge,
} from "../../components/trading/TradingBadges/TradingBadges";
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
  const [orderFilter, setOrderFilter] = useState("open");
  const [showAllEvents, setShowAllEvents] = useState(false);

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

  const isScalper = bot?.strategy_type === "pattern_scalper";
  const scalperTrade = bot?.settings?.pattern_scalper_state?.current_trade || null;
  const signalScore = toNumberOrNull(scalperTrade?.signal_score);
  const openOrders = orders.filter((order) => isOpenOrderStatus(order.status));
  const filledOrders = orders.filter((order) => order.status === "Filled");
  const activePositionTakeProfitOrders = orders.filter(
    (order) =>
      order.order_role === "position_take_profit" &&
      isOpenOrderStatus(order.status),
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
      ? Math.abs((tpPrice - avgEntryPrice) / avgEntryPrice) * 100
      : null;
  const activeManagedTakeProfits = isScalper
    ? (positionSize > 0 && tpPrice != null ? 1 : 0)
    : activePositionTakeProfitOrders.length;
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
  const cancelledOrders = orders.filter((order) =>
    ["Cancelled", "Canceled", "Deactivated"].includes(order.status),
  );
  const rejectedOrders = orders.filter((order) =>
    ["Rejected", "Failed", "Error"].includes(order.status),
  );
  const orderFilters = [
    { value: "open", label: "Open", count: openOrders.length },
    { value: "filled", label: "Filled", count: filledOrders.length },
    { value: "cancelled", label: "Cancelled", count: cancelledOrders.length },
    { value: "all", label: "All", count: orders.length },
  ];
  const visibleOrders = orderFilter === "open"
    ? openOrders
    : orderFilter === "filled"
      ? filledOrders
      : orderFilter === "cancelled"
        ? cancelledOrders
        : orders;
  const visibleEvents = showAllEvents ? events : events.slice(0, 12);

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
                  {isScalper
                    ? "Pattern Scalper аналізує лише закриті свічки, чекає breakout, а потім retest і утримання пробитого рівня перед входом. Після входу керує однією LONG або SHORT позицією через SL, TP, timeout і cooldown."
                    : "Поки бот має статус running, бекендовий worker синхронізує ордери, підтримує Position TP для long-позиції та відновлює рівні сітки після закриття циклів."}
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
                  tone={openOrders.length > 0 ? "open" : "neutral"}
                />
                <SummaryCard
                  label="Filled orders"
                  value={String(filledOrders.length)}
                  tone={filledOrders.length > 0 ? "positive" : "neutral"}
                />
                <SummaryCard
                  label={isScalper ? "Signal score" : "Active Position TP"}
                  value={isScalper
                    ? (signalScore == null ? "—" : `${Math.round(signalScore * 100)}%`)
                    : String(activeManagedTakeProfits)}
                  tone={(isScalper ? signalScore != null : activeManagedTakeProfits > 0) ? "tp" : "neutral"}
                />
                <SummaryCard
                  label="Closed cycles"
                  value={String(closedCycles)}
                />
                <SummaryCard
                  label="Total PnL"
                  value={<PnlValue value={totalPnl}>{totalPnl == null ? "—" : fmtMoneySigned(totalPnl)}</PnlValue>}
                  tone={totalPnl == null ? "neutral" : totalPnl >= 0 ? "positive" : "negative"}
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
                    value={<PnlValue value={grossRealizedPnl}>{grossRealizedPnl == null ? "—" : fmtMoneySigned(grossRealizedPnl)}</PnlValue>}
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
                    value={<PnlValue value={netRealizedPnl}>{netRealizedPnl == null ? "—" : fmtMoneySigned(netRealizedPnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label="Realized PnL %"
                    value={<PnlValue value={realizedPnlPercent}>{realizedPnlPercent == null ? "—" : fmtPctSigned(realizedPnlPercent)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label="Average Cycle PnL"
                    value={<PnlValue value={averageCyclePnl}>{averageCyclePnl == null ? "—" : fmtMoneySigned(averageCyclePnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label="Open Unrealized PnL"
                    value={<PnlValue value={performanceUnrealizedPnl}>{performanceUnrealizedPnl == null ? "—" : fmtMoneySigned(performanceUnrealizedPnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label="Total PnL"
                    value={<PnlValue value={totalPnl}>{totalPnl == null ? "—" : fmtMoneySigned(totalPnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label="Total PnL %"
                    value={<PnlValue value={totalPnlPercent}>{totalPnlPercent == null ? "—" : fmtPctSigned(totalPnlPercent)}</PnlValue>}
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
                    <ConfigItem label="Side" value={<SideBadge side={position?.side || "Buy"} />} />
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
                      value={<PnlValue value={unrealizedPnl}>{unrealizedPnl == null ? "—" : fmtMoneySigned(unrealizedPnl)}</PnlValue>}
                      mono
                    />
                    <ConfigItem
                      label="Unrealized PnL %"
                      value={<PnlValue value={unrealizedPnlPercent}>{unrealizedPnlPercent == null ? "—" : fmtPctSigned(unrealizedPnlPercent)}</PnlValue>}
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
                      label={isScalper ? "Managed TP Price" : "Active TP Price"}
                      value={tpPrice == null ? "—" : fmtNumber(tpPrice, 4)}
                      mono
                    />
                    <ConfigItem
                      label={isScalper ? "Managed TP Qty" : "Active TP Qty"}
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
                    label={isScalper ? "Pending Entry Qty" : "Pending Buy Qty"}
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
                  {isScalper ? (
                    <>
                      <ConfigItem label="Timeframe" value={`${bot.settings?.timeframe || "5"}m`} mono />
                      <ConfigItem label="Entry Model" value={Number(bot.settings?.strategy_revision || 4) >= 4 ? "Market context + patterns" : Number(bot.settings?.strategy_revision || 3) >= 3 ? "Breakout → Retest" : "Breakout"} />
                      <ConfigItem label="Context TF" value={`${bot.settings?.context_timeframe || "5"}m`} mono />
                      <ConfigItem label="Patterns" value={Number(bot.settings?.strategy_revision || 4) >= 4 ? "Retest · Flag · Triangle · Double · Sweep" : "Breakout"} />
                      <ConfigItem label="Minimum Signal" value={fmtPct(Number(bot.settings?.minimum_signal_score || 0.85) * 100)} mono />
                      <ConfigItem label="Stop-loss ATR" value={fmtNumber(bot.settings?.stop_loss_atr || 1.2)} mono />
                      <ConfigItem label="Take-profit ATR" value={fmtNumber(bot.settings?.take_profit_atr || 1.8)} mono />
                      <ConfigItem label="Max Holding" value={`${bot.settings?.max_holding_minutes || 30} min`} mono />
                      <ConfigItem label="Cooldown" value={`${bot.settings?.cooldown_minutes || 15} min`} mono />
                      <ConfigItem label="Risk / Trade" value={fmtPct(Number(bot.settings?.risk_per_trade_percent || 0.5))} mono />
                      <ConfigItem label="Daily Loss Limit" value={fmtPct(Number(bot.settings?.max_daily_loss_percent || 2))} mono />
                      <ConfigItem label="SHORT Enabled" value={bot.settings?.allow_short ? "Yes" : "No"} />
                    </>
                  ) : (
                    <>
                      <ConfigItem label="Grid Orders" value={String(bot.grid_orders_count)} mono />
                      <ConfigItem label="Grid Step %" value={fmtNumber(bot.grid_step_percent)} mono />
                    </>
                  )}
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
                <CardHeader
                  eyebrow="Orders / Trades"
                  title="Order history"
                  action={
                    <div className={styles.orderTotals}>
                      <span><b>{openOrders.length}</b> open</span>
                      <span><b>{filledOrders.length}</b> filled</span>
                      {rejectedOrders.length > 0 ? <span><b>{rejectedOrders.length}</b> rejected</span> : null}
                    </div>
                  }
                />

                <div className={styles.orderTabs} role="tablist" aria-label="Order status filter">
                  {orderFilters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      className={orderFilter === filter.value ? styles.orderTabActive : ""}
                      onClick={() => setOrderFilter(filter.value)}
                    >
                      {filter.label}
                      <span>{filter.count}</span>
                    </button>
                  ))}
                </div>

                {visibleOrders.length === 0 ? (
                  <div className={styles.emptyOrders}>No {orderFilter} orders.</div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Created</th>
                          <th>Symbol</th>
                          <th>Side</th>
                          <th>Role</th>
                          <th>Type</th>
                          <th className={styles.numericHeader}>Qty</th>
                          <th className={styles.numericHeader}>Price</th>
                          <th>Status</th>
                          <th>Exchange ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOrders.map((order) => (
                          <tr key={order.id} className={getOrderRowClass(order)}>
                            <td className={styles.dateCell}>{fmtDateTime(order.created_at)}</td>
                            <td className={`${styles.symbolCell} mono`}>{order.symbol}</td>
                            <td><SideBadge side={order.side} /></td>
                            <td><RoleBadge role={order.order_role} /></td>
                            <td><OrderTypeBadge type={order.order_type} /></td>
                            <td className={`${styles.numberCell} mono`}>{fmtNumber(order.qty, 6)}</td>
                            <td className={`${styles.numberCell} mono`}>
                              {order.price == null ? "—" : fmtNumber(order.price, 4)}
                            </td>
                            <td><StatusBadge status={order.status} /></td>
                            <td className={`${styles.exchangeId} mono`} title={order.exchange_order_id || ""}>
                              {shortId(order.exchange_order_id)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card className={styles.eventsCard}>
                <CardHeader
                  eyebrow="Worker events"
                  title="Bot activity"
                  action={<span className={styles.eventCount}>{events.length} events</span>}
                />

                {events.length === 0 ? (
                  <div className={styles.emptyOrders}>No events yet.</div>
                ) : (
                  <>
                    <div className={styles.eventsList}>
                      {visibleEvents.map((event) => (
                        <article key={event.id} className={styles.eventRow}>
                          <span className={styles.eventRail} aria-hidden="true" />
                          <div className={styles.eventBody}>
                            <div className={styles.eventMeta}>
                              <EventBadge type={event.event_type} />
                              <time className="mono">{fmtDateTime(event.created_at)}</time>
                            </div>
                            <p className={styles.eventMessage}>{event.message}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                    {events.length > 12 ? (
                      <button
                        type="button"
                        className={styles.showMoreButton}
                        onClick={() => setShowAllEvents((value) => !value)}
                      >
                        {showAllEvents ? "Show latest 12" : `Show all ${events.length} events`}
                      </button>
                    ) : null}
                  </>
                )}
              </Card>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, tone = "neutral" }) {
  return (
    <div className={`${styles.summaryCard} ${styles[`summary${capitalize(tone)}`] || ""}`}>
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
  );
}

function ConfigItem({ label, value, mono = false }) {
  return (
    <div className={styles.configItem}>
      <dt>{label}</dt>
      <dd className={mono ? "mono" : ""}>{value ?? "—"}</dd>
    </div>
  );
}

function isOpenOrderStatus(status) {
  return ["New", "Created", "PartiallyFilled", "PendingNew", "Untriggered"].includes(status);
}

function getOrderRowClass(order) {
  const classes = [];
  if (order.side === "Buy") classes.push(styles.orderRowBuy);
  if (order.side === "Sell") classes.push(styles.orderRowSell);
  if (isOpenOrderStatus(order.status)) classes.push(styles.orderRowOpen);
  return classes.join(" ");
}

function shortId(value) {
  if (!value) return "—";
  const text = String(value);
  return text.length > 14 ? `${text.slice(0, 7)}…${text.slice(-5)}` : text;
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
    waiting_for_signal: "Waiting for signal",
    cooldown: "Cooldown",
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
