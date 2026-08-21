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
import ConnectionStatus from "../../components/ui/ConnectionStatus/ConnectionStatus";
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
import { useLanguage } from "../../context/LanguageContext";
import { useConfirmModal } from "../../context/ConfirmModalContext";
import { useAuthenticatedWebSocket } from "../../websocket/useAuthenticatedWebSocket";
import styles from "./BotDetailPage.module.css";

export default function BotDetailPage() {
  const { tr, locale } = useLanguage();
  const { confirm } = useConfirmModal();
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

  const wsStatus = useAuthenticatedWebSocket(`/ws/bots/${botId}`, {
    enabled: Boolean(botId),
    onMessage: (event) => {
      if (event.type === "bot.snapshot" && event.data) {
        setBot(event.data.bot);
        setOrders(event.data.orders || []);
        setEvents(event.data.events || []);
        if (!event.data.stream_errors?.position) setPosition(event.data.position || null);
        if (!event.data.stream_errors?.risk) setRisk(event.data.risk || null);
        if (!event.data.stream_errors?.performance) setPerformance(event.data.performance || null);
        setLoading(false);
        return;
      }
      if (event.type === "access.denied") {
        setError(event.message || tr('Немає доступу до цього бота.', 'You do not have access to this bot.'));
      }
      if (event.type === "bot.deleted") {
        setError(tr('Бота було видалено.', 'The bot was deleted.'));
      }
    },
  });

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
      setError(e.detail || e.message || tr('Не вдалося завантажити дані бота.', 'Failed to load bot data.'));
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async () => {
    const confirmed = await confirm({
      title: tr('Закрити позицію?', 'Close position?'),
      message: tr('Поточну біржову позицію буде закрито reduce-only market ордером. Історія бота не буде видалена. Продовжити?', 'This will close the current exchange position with a reduce-only market order. It will not delete bot history. Continue?'),
      confirmLabel: tr('Закрити', 'Close'),
      cancelLabel: tr('Скасувати', 'Cancel'),
      isDanger: true,
    });

    if (!confirmed) return;

    try {
      setAction("close-position");
      setError("");
      const result = await closeBotPosition(botId, { confirm: true });
      await load();
      setMessage(result.message || tr('Ордер на закриття позиції відправлено.', 'Position close order submitted.'));
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося закрити позицію.', 'Failed to close position.'));
    } finally {
      setAction("");
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
      setMessage(result.message || tr('Бот запущено.', 'Bot started.'));
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося запустити бота.', 'Failed to start bot.'));
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
      setMessage(tr('Бот зупинено.', 'Bot stopped.'));
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося зупинити бота.', 'Failed to stop bot.'));
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
        `${tr('Синхронізацію завершено. Оновлено ордерів:', 'Sync completed. Orders updated:')} ${syncedOrders.length}.`,
      );
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося синхронізувати ордери.', 'Failed to sync orders.'));
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
      setMessage(`${tr('Скасовано ордерів:', 'Orders cancelled:')} ${cancelled.length}.`);
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося скасувати ордери.', 'Failed to cancel orders.'));
    } finally {
      setAction("");
    }
  };

  const handleClearHistory = async () => {
    const confirmed = await confirm({
      title: tr('Очистити історію?', 'Clear history?'),
      message: tr('Це зупинить бота, скасує відкриті ордери бота та видалить локальну історію ордерів/подій. Існуючі позиції Bybit НЕ будуть закриті. Продовжити?', 'This will stop the bot, cancel open bot orders, and delete local order/event history. It will NOT close existing Bybit positions. Continue?'),
      confirmLabel: tr('Очистити', 'Clear'),
      cancelLabel: tr('Скасувати', 'Cancel'),
      isDanger: true,
    });

    if (!confirmed) {return;}

    try {
      setAction("clear");
      setError("");

      const result = await clearBotHistory(botId);

      await load();

      setMessage(
        `${tr('Історію очищено. Видалено ордерів:', 'History cleared. Deleted orders:')} ${result.orders_deleted}. ${tr('Видалено подій:', 'Deleted events:')} ${result.events_deleted}. ${tr('Скасовано біржових ордерів:', 'Cancelled exchange orders:')} ${result.exchange_orders_cancelled}.`,
      );
    } catch (e) {
      setError(e.detail || e.message || tr('Не вдалося очистити історію бота.', 'Failed to clear bot history.'));
    } finally {
      setAction("");
    }
  };

  const isScalper = bot?.strategy_type === "pattern_scalper";
  const isMomentum = bot?.strategy_type === "momentum";
  const isDca = bot?.strategy_type === "dca";
  const scalperTrade = bot?.settings?.pattern_scalper_state?.current_trade || null;
  const momentumState = bot?.settings?.momentum_state || null;
  const momentumTrade = momentumState?.current_trade || null;
  const lastAnalysis = momentumState?.last_analysis || null;
  const signalHistory = Array.isArray(momentumState?.signal_history)
    ? momentumState.signal_history.slice(-5).reverse()
    : [];
  const signalScore = toNumberOrNull(
    isMomentum
      ? momentumState?.current_signal_score ?? lastAnalysis?.score
      : scalperTrade?.signal_score,
  );
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
  const activeManagedTakeProfits = isScalper || isMomentum
    ? (positionSize > 0 && tpPrice != null ? 1 : 0)
    : activePositionTakeProfitOrders.length;
  const managedStopLoss = toNumberOrNull(momentumTrade?.stop_loss);
  const managedTrailingStop = toNumberOrNull(momentumTrade?.trailing_stop);
  const managedMarketRegime = momentumTrade?.market_regime || momentumState?.market_regime || lastAnalysis?.market_regime || "sideways";
  const runtimeState = bot?.runtime_state || bot?.runtime_status || "stopped";
  const runtimeLabel = getRuntimeLabel(runtimeState, tr);
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
    { value: "open", label: tr('Відкриті', 'Open'), count: openOrders.length },
    { value: "filled", label: tr('Виконані', 'Filled'), count: filledOrders.length },
    { value: "cancelled", label: tr('Скасовані', 'Cancelled'), count: cancelledOrders.length },
    { value: "all", label: tr('Усі', 'All'), count: orders.length },
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
          <ArrowLeft size={16} /> {tr('Усі боти', 'All bots')}
        </Link>

        {loading && <div className={styles.state}>{tr('Завантаження…', 'Loading…')}</div>}
        {error && (
          <div className={`${styles.state} ${styles.stateError}`}>{error}</div>
        )}
        {message && !error && <div className={styles.state}>{message}</div>}

        {bot ? (
          <div className={styles.layout}>
            <section className={styles.summary}>
              <header className={styles.head}>
                <div className={styles.headMeta}>
                  <span className="eyebrow">{tr('Бот', 'Bot')} #{bot.id}</span>
                  <ConnectionStatus status={wsStatus} tr={tr} />
                </div>
                <h1 className="display-2">{bot.name}</h1>
                <p className="lead">
                  {isScalper
                    ? tr('Pattern Scalper аналізує лише закриті свічки, чекає breakout, а потім retest і утримання пробитого рівня перед входом. Після входу керує однією LONG або SHORT позицією через SL, TP, timeout і cooldown.', 'Pattern Scalper analyzes only closed candles, waits for a breakout, then a retest and hold of the broken level before entry. After entry it manages a single LONG or SHORT position through SL, TP, timeout, and cooldown.')
                    : isMomentum
                      ? tr('Momentum Bot аналізує лише закриті свічки, оцінює EMA-trend, RSI, volume та ATR, а після входу керує однією LONG або SHORT позицією через ATR stop-loss, take-profit, trailing stop і cooldown.', 'Momentum Bot analyzes only closed candles, scores EMA trend, RSI, volume, and ATR, then manages a single LONG or SHORT position with ATR stop-loss, take-profit, trailing stop, and cooldown.')
                    : tr('Поки бот має статус running, бекендовий worker синхронізує ордери, підтримує Position TP для long-позиції та відновлює рівні сітки після закриття циклів.', 'While the bot is running, the backend worker syncs orders, maintains Position TP for a long position, and restores grid levels after cycles close.')}
                </p>
              </header>

              <div className={styles.summaryGrid}>
                <SummaryCard
                  label={tr('Остання синхронізація', 'Last sync')}
                  value={fmtDateTime(bot.last_run_at, locale)}
                />
                <SummaryCard
                  label={tr('Відкриті ордери', 'Open orders')}
                  value={String(openOrders.length)}
                  tone={openOrders.length > 0 ? "open" : "neutral"}
                />
                <SummaryCard
                  label={tr('Виконані ордери', 'Filled orders')}
                  value={String(filledOrders.length)}
                  tone={filledOrders.length > 0 ? "positive" : "neutral"}
                />
                <SummaryCard
                  label={isScalper || isMomentum ? tr('Score сигналу', 'Signal score') : tr('Активний Position TP', 'Active Position TP')}
                  value={isScalper || isMomentum
                    ? formatSignalScore(signalScore, isMomentum)
                    : String(activeManagedTakeProfits)}
                  tone={(isScalper || isMomentum ? signalScore != null : activeManagedTakeProfits > 0) ? "tp" : "neutral"}
                />
                <SummaryCard
                  label={tr('Закриті цикли', 'Closed cycles')}
                  value={String(closedCycles)}
                />
                <SummaryCard
                  label={tr('Загальний PnL', 'Total PnL')}
                  value={<PnlValue value={totalPnl}>{totalPnl == null ? "—" : fmtMoneySigned(totalPnl)}</PnlValue>}
                  tone={totalPnl == null ? "neutral" : totalPnl >= 0 ? "positive" : "negative"}
                />
              </div>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow={tr('Результат торгівлі', 'Trading result')}
                  title={tr('Підсумок результативності', 'Performance Summary')}
                  action={
                    <span
                      className={`${styles.statusBadge} ${
                        totalPnl == null || totalPnl >= 0
                          ? styles.statusOk
                          : styles.statusLiveDisabled
                      }`}
                    >
                      {totalPnl == null ? tr('Немає даних', 'No data') : totalPnl >= 0 ? tr('Прибуток', 'Profit') : tr('Збиток', 'Loss')}
                    </span>
                  }
                />

                <dl className={styles.configGrid}>
                  <ConfigItem label={tr('Закриті цикли', 'Closed Cycles')} value={String(closedCycles)} mono />
                  <ConfigItem label={tr('Прибуткові цикли', 'Winning Cycles')} value={String(winningCycles)} mono />
                  <ConfigItem
                    label={tr('Win Rate', 'Win Rate')}
                    value={winRatePercent == null ? "—" : fmtPct(winRatePercent)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Валовий Realized PnL', 'Gross Realized PnL')}
                    value={<PnlValue value={grossRealizedPnl}>{grossRealizedPnl == null ? "—" : fmtMoneySigned(grossRealizedPnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label={tr('Комісії закритих циклів', 'Closed Fees')}
                    value={closedFees == null ? "—" : fmtMoney(closedFees)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Загальні комісії', 'Total Fees')}
                    value={totalFees == null ? "—" : fmtMoney(totalFees)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Чистий Realized PnL', 'Net Realized PnL')}
                    value={<PnlValue value={netRealizedPnl}>{netRealizedPnl == null ? "—" : fmtMoneySigned(netRealizedPnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label={tr('Realized PnL %', 'Realized PnL %')}
                    value={<PnlValue value={realizedPnlPercent}>{realizedPnlPercent == null ? "—" : fmtPctSigned(realizedPnlPercent)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label={tr('Середній PnL циклу', 'Average Cycle PnL')}
                    value={<PnlValue value={averageCyclePnl}>{averageCyclePnl == null ? "—" : fmtMoneySigned(averageCyclePnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label={tr('Відкритий Unrealized PnL', 'Open Unrealized PnL')}
                    value={<PnlValue value={performanceUnrealizedPnl}>{performanceUnrealizedPnl == null ? "—" : fmtMoneySigned(performanceUnrealizedPnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label={tr('Загальний PnL', 'Total PnL')}
                    value={<PnlValue value={totalPnl}>{totalPnl == null ? "—" : fmtMoneySigned(totalPnl)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label={tr('Загальний PnL %', 'Total PnL %')}
                    value={<PnlValue value={totalPnlPercent}>{totalPnlPercent == null ? "—" : fmtPctSigned(totalPnlPercent)}</PnlValue>}
                    mono
                  />
                  <ConfigItem
                    label={tr('Кількість відкритої позиції', 'Open Position Qty')}
                    value={openPositionQty == null ? "—" : fmtNumber(openPositionQty, 6)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Вартість відкритої позиції', 'Open Position Value')}
                    value={openPositionValue == null ? "—" : fmtMoney(openPositionValue)}
                    mono
                  />
                </dl>
              </Card>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow={tr('Знімок біржі', 'Exchange snapshot')}
                  title={tr('Поточна позиція', 'Current Position')}
                />

                {positionSize > 0 ? (
                  <dl className={styles.configGrid}>
                    <ConfigItem label={tr('Сторона', 'Side')} value={<SideBadge side={position?.side || "Buy"} />} />
                    <ConfigItem
                      label={tr('Розмір', 'Size')}
                      value={fmtNumber(positionSize, 6)}
                      mono
                    />
                    <ConfigItem
                      label={tr('Середня ціна входу', 'Avg Entry Price')}
                      value={
                        avgEntryPrice == null
                          ? "—"
                          : fmtNumber(avgEntryPrice, 4)
                      }
                      mono
                    />
                    <ConfigItem
                      label={tr('Mark Price', 'Mark Price')}
                      value={markPrice == null ? "—" : fmtNumber(markPrice, 4)}
                      mono
                    />
                    <ConfigItem
                      label={tr('Unrealized PnL', 'Unrealized PnL')}
                      value={<PnlValue value={unrealizedPnl}>{unrealizedPnl == null ? "—" : fmtMoneySigned(unrealizedPnl)}</PnlValue>}
                      mono
                    />
                    <ConfigItem
                      label={tr('Unrealized PnL %', 'Unrealized PnL %')}
                      value={<PnlValue value={unrealizedPnlPercent}>{unrealizedPnlPercent == null ? "—" : fmtPctSigned(unrealizedPnlPercent)}</PnlValue>}
                      mono
                    />
                    <ConfigItem
                      label={tr('Ціна ліквідації', 'Liquidation Price')}
                      value={
                        position?.liq_price == null
                          ? "—"
                          : fmtNumber(Number(position.liq_price), 4)
                      }
                      mono
                    />
                    <ConfigItem
                      label={tr('Плече', 'Leverage')}
                      value={position?.leverage || "—"}
                      mono
                    />
                    <ConfigItem
                      label={tr('Режим маржі', 'Margin Mode')}
                      value={position?.margin_mode || "—"}
                    />
                    <ConfigItem
                      label={tr('Вартість позиції', 'Position Value')}
                      value={
                        positionValue == null ? "—" : fmtMoney(positionValue)
                      }
                      mono
                    />
                    <ConfigItem
                      label={isScalper || isMomentum ? tr('Керована ціна TP', 'Managed TP Price') : tr('Активна ціна TP', 'Active TP Price')}
                      value={tpPrice == null ? "—" : fmtNumber(tpPrice, 4)}
                      mono
                    />
                    <ConfigItem
                      label={isScalper || isMomentum ? tr('Керована кількість TP', 'Managed TP Qty') : tr('Активна кількість TP', 'Active TP Qty')}
                      value={tpQty == null ? "—" : fmtNumber(tpQty, 6)}
                      mono
                    />
                    <ConfigItem
                      label={tr('Відстань до TP %', 'TP Distance %')}
                      value={
                        tpDistancePercent == null
                          ? "—"
                          : fmtPct(tpDistancePercent)
                      }
                      mono
                    />
                    {isMomentum ? (
                      <>
                        <ConfigItem label={tr('Керований Stop-loss', 'Managed Stop-loss')} value={managedStopLoss == null ? "—" : fmtNumber(managedStopLoss, 4)} mono />
                        <ConfigItem label={tr('Trailing stop', 'Trailing stop')} value={managedTrailingStop == null ? "—" : fmtNumber(managedTrailingStop, 4)} mono />
                        <ConfigItem label={tr('Режим ринку', 'Market regime')} value={managedMarketRegime} />
                      </>
                    ) : null}
                  </dl>
                ) : (
                  <div className={styles.emptyOrders}>{tr('Немає відкритої позиції', 'No open position')}</div>
                )}
              </Card>

              {isMomentum ? (
                <Card className={styles.configCard}>
                  <CardHeader
                    eyebrow={tr('Аналітика сигналу', 'Signal analytics')}
                    title={tr('Momentum state', 'Momentum state')}
                  />

                  <dl className={styles.configGrid}>
                    <ConfigItem label={tr('Поточний сигнал', 'Current signal')} value={String(momentumState?.current_signal || 'none').toUpperCase()} />
                    <ConfigItem label={tr('Score', 'Score')} value={formatSignalScore(signalScore, true)} mono />
                    <ConfigItem label={tr('Режим ринку', 'Market regime')} value={managedMarketRegime} />
                    <ConfigItem label={tr('Останній аналіз', 'Last analysis')} value={fmtDateTime(momentumState?.last_analysis_at, locale)} mono />
                    <ConfigItem label={tr('Останній вхід', 'Last entry')} value={fmtDateTime(momentumTrade?.opened_at, locale)} mono />
                    <ConfigItem label={tr('Cooldown', 'Cooldown')} value={bot.runtime_state === 'cooldown' ? tr('Активний', 'Active') : tr('Ні', 'No')} />
                  </dl>

                  {lastAnalysis?.reasons?.length ? (
                    <div>
                      <strong>{tr('Причини останнього сигналу', 'Latest signal reasons')}</strong>
                      <div className={styles.eventsList}>
                        {lastAnalysis.reasons.map((reason, index) => (
                          <article key={`${reason}-${index}`} className={styles.eventRow}>
                            <div className={styles.eventBody}>
                              <p className={styles.eventMessage}>{reason}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {signalHistory.length ? (
                    <div>
                      <strong>{tr('Останні сигнали', 'Recent signals')}</strong>
                      <div className={styles.eventsList}>
                        {signalHistory.map((entry) => (
                          <article key={`${entry.timestamp}-${entry.type}`} className={styles.eventRow}>
                            <div className={styles.eventBody}>
                              <div className={styles.eventMeta}>
                                <EventBadge type={`momentum_${entry.type}_signal`} />
                                <time className="mono">{fmtDateTime(entry.timestamp, locale)}</time>
                              </div>
                              <p className={styles.eventMessage}>{String(entry.type || 'none').toUpperCase()} · {formatSignalScore(toNumberOrNull(entry.score), true)}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
              ) : null}

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow={tr('Безпека', 'Safety')}
                  title={tr('Керування ризиком', 'Risk Management')}
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
                          ? tr('Заблоковано', 'Blocked')
                          : riskAtLimit
                            ? tr('На ліміті', 'At limit')
                            : 'OK'}
                      </span>
                      {liveDisabled ? (
                        <span
                          className={`${styles.statusBadge} ${styles.statusLiveDisabled}`}
                        >
                          {tr('Live вимкнено', 'Live disabled')}
                        </span>
                      ) : null}
                    </div>
                  }
                />

                <dl className={styles.configGrid}>
                  <ConfigItem
                    label={tr('Макс. кількість позиції', 'Max Position Qty')}
                    value={formatMaybeNumber(risk?.max_position_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Поточна кількість позиції', 'Current Position Qty')}
                    value={formatMaybeNumber(risk?.current_position_qty, 6)}
                    mono
                  />
                    <ConfigItem
                      label={isScalper || isMomentum ? tr('Кількість очікуючого входу', 'Pending Entry Qty') : tr('Кількість очікуючої купівлі', 'Pending Buy Qty')}
                    value={formatMaybeNumber(risk?.pending_buy_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Потенційна загальна кількість', 'Potential Total Qty')}
                    value={formatMaybeNumber(risk?.potential_total_qty, 6)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Макс. відкритих ордерів', 'Max Open Orders')}
                    value={
                      risk?.max_open_orders == null
                        ? "—"
                        : String(risk.max_open_orders)
                    }
                    mono
                  />
                  <ConfigItem
                    label={tr('Поточні відкриті ордери', 'Current Open Orders')}
                    value={
                      risk?.current_open_orders == null
                        ? "—"
                        : String(risk.current_open_orders)
                    }
                    mono
                  />
                  <ConfigItem
                    label={tr('Макс. notional', 'Max Notional')}
                    value={formatMaybeMoney(risk?.max_notional_usdt)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Орієнтовний notional', 'Estimated Notional')}
                    value={formatMaybeMoney(risk?.estimated_notional_usdt)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Live trading дозволено', 'Live Trading Allowed')}
                    value={risk?.allow_live_trading ? tr('Так', 'Yes') : tr('Ні', 'No')}
                  />
                  <ConfigItem
                    label={tr('Статус ризику', 'Risk Status')}
                    value={
                      riskBlocked ? tr('Заблоковано', 'Blocked') : riskAtLimit ? tr('На ліміті', 'At limit') : 'OK'
                    }
                  />
                </dl>

                {risk?.reason ? (
                  <p className={styles.riskMessage}>{risk.reason}</p>
                ) : null}
              </Card>

              <Card className={styles.configCard}>
                <CardHeader
                  eyebrow={tr('Конфігурація', 'Configuration')}
                  title={tr('Поточні параметри', 'Current settings')}
                  action={
                    <span
                      className={`${styles.runtimeBadge} ${styles[`runtime${capitalizeRuntimeState(runtimeState)}`] || ""}`}
                    >
                      {runtimeLabel}
                    </span>
                  }
                />

                <dl className={styles.configGrid}>
                  <ConfigItem label={tr('Біржа', 'Exchange')} value={bot.exchange} />
                  <ConfigItem label={tr('Середовище', 'Environment')} value={bot.environment} />
                  <ConfigItem label={tr('Категорія', 'Category')} value={bot.category} />
                  <ConfigItem label={tr('Символ', 'Symbol')} value={bot.symbol} mono />
                  <ConfigItem label={tr('Стратегія', 'Strategy')} value={bot.strategy_type} />
                  <ConfigItem
                    label={tr('Кількість ордера', 'Order Qty')}
                    value={fmtNumber(bot.order_qty, 6)}
                    mono
                  />
                  {isScalper ? (
                    <>
                      <ConfigItem label={tr('Таймфрейм', 'Timeframe')} value={`${bot.settings?.timeframe || "5"}m`} mono />
                      <ConfigItem label={tr('Модель входу', 'Entry Model')} value={Number(bot.settings?.strategy_revision || 4) >= 4 ? tr('Контекст ринку + патерни', 'Market context + patterns') : Number(bot.settings?.strategy_revision || 3) >= 3 ? tr('Пробій → ретест', 'Breakout → Retest') : tr('Пробій', 'Breakout')} />
                      <ConfigItem label={tr('Context TF', 'Context TF')} value={`${bot.settings?.context_timeframe || "5"}m`} mono />
                      <ConfigItem label={tr('Патерни', 'Patterns')} value={Number(bot.settings?.strategy_revision || 4) >= 4 ? tr('Ретест · Прапор · Трикутник · Подвійна вершина/дно · Зняття ліквідності', 'Retest · Flag · Triangle · Double · Sweep') : tr('Пробій', 'Breakout')} />
                      <ConfigItem label={tr('Мін. сигнал', 'Minimum Signal')} value={fmtPct(Number(bot.settings?.minimum_signal_score || 0.85) * 100)} mono />
                      <ConfigItem label={tr('Stop-loss ATR', 'Stop-loss ATR')} value={fmtNumber(bot.settings?.stop_loss_atr || 1.2)} mono />
                      <ConfigItem label={tr('Take-profit ATR', 'Take-profit ATR')} value={fmtNumber(bot.settings?.take_profit_atr || 1.8)} mono />
                      <ConfigItem label={tr('Макс. утримання', 'Max Holding')} value={`${bot.settings?.max_holding_minutes || 30} ${tr('хв', 'min')}`} mono />
                      <ConfigItem label={tr('Cooldown', 'Cooldown')} value={`${bot.settings?.cooldown_minutes || 15} ${tr('хв', 'min')}`} mono />
                      <ConfigItem label={tr('Ризик / угода', 'Risk / Trade')} value={fmtPct(Number(bot.settings?.risk_per_trade_percent || 0.5))} mono />
                      <ConfigItem label={tr('Денний ліміт збитку', 'Daily Loss Limit')} value={fmtPct(Number(bot.settings?.max_daily_loss_percent || 2))} mono />
                      <ConfigItem label={tr('SHORT дозволено', 'SHORT Enabled')} value={bot.settings?.allow_short ? tr('Так', 'Yes') : tr('Ні', 'No')} />
                    </>
                  ) : isMomentum ? (
                    <>
                      <ConfigItem label={tr('Таймфрейм', 'Timeframe')} value={`${bot.settings?.timeframe || "15"}m`} mono />
                      <ConfigItem label={tr('Напрямок позицій', 'Position Bias')} value={String(bot.settings?.position_side || 'both').toUpperCase()} />
                      <ConfigItem label={tr('Fast EMA', 'Fast EMA')} value={fmtNumber(bot.settings?.fast_ema_period || 20, 0)} mono />
                      <ConfigItem label={tr('Slow EMA', 'Slow EMA')} value={fmtNumber(bot.settings?.slow_ema_period || 50, 0)} mono />
                      <ConfigItem label={tr('RSI період', 'RSI period')} value={fmtNumber(bot.settings?.rsi_period || 14, 0)} mono />
                      <ConfigItem label={tr('RSI long мін.', 'RSI long min')} value={fmtNumber(bot.settings?.rsi_long_threshold || 55, 0)} mono />
                      <ConfigItem label={tr('RSI short макс.', 'RSI short max')} value={fmtNumber(bot.settings?.rsi_short_threshold || 45, 0)} mono />
                      <ConfigItem label={tr('Мін. сигнал', 'Minimum Signal')} value={fmtPct(Number(bot.settings?.minimum_signal_score || 70))} mono />
                      <ConfigItem label={tr('Множник volume', 'Volume multiplier')} value={fmtNumber(bot.settings?.volume_multiplier || 1.5)} mono />
                      <ConfigItem label={tr('Stop-loss ATR', 'Stop-loss ATR')} value={fmtNumber(bot.settings?.atr_stop_loss_multiplier || 1.5)} mono />
                      <ConfigItem label={tr('Take-profit ATR', 'Take-profit ATR')} value={fmtNumber(bot.settings?.atr_take_profit_multiplier || 3)} mono />
                      <ConfigItem label={tr('Trailing stop ATR', 'Trailing stop ATR')} value={fmtNumber(bot.settings?.trailing_stop_atr_multiplier || 2)} mono />
                      <ConfigItem label={tr('Trailing stop', 'Trailing stop')} value={bot.settings?.trailing_stop_enabled ? tr('Так', 'Yes') : tr('Ні', 'No')} />
                      <ConfigItem label={tr('Мін. ATR %', 'Min ATR %')} value={fmtPct(Number(bot.settings?.minimum_atr_percent || 0.1))} mono />
                      <ConfigItem label={tr('Ризик / угода', 'Risk / Trade')} value={fmtPct(Number(bot.settings?.risk_per_trade_percent || 1))} mono />
                      <ConfigItem label={tr('Cooldown', 'Cooldown')} value={`${bot.settings?.cooldown_minutes || 15} ${tr('хв', 'min')}`} mono />
                    </>
                  ) : isDca ? (
                    <>
                      <ConfigItem label={tr('Страхувальні ордери', 'Safety Orders')} value={String(bot.grid_orders_count)} mono />
                      <ConfigItem label={tr('Перший крок %', 'First Step %')} value={fmtNumber(bot.grid_step_percent)} mono />
                      <ConfigItem label={tr('Множник обсягу', 'Volume Multiplier')} value={fmtNumber(bot.settings?.dca_volume_multiplier ?? 1.5)} mono />
                      <ConfigItem label={tr('Множник кроку', 'Step Multiplier')} value={fmtNumber(bot.settings?.dca_step_multiplier ?? 1.3)} mono />
                      <ConfigItem label={tr('Take-profit %', 'Take-profit %')} value={fmtNumber(bot.settings?.take_profit_percent ?? 1.5)} mono />
                    </>
                  ) : (
                    <>
                      <ConfigItem label={tr('Grid ордери', 'Grid Orders')} value={String(bot.grid_orders_count)} mono />
                      <ConfigItem label={tr('Крок Grid %', 'Grid Step %')} value={fmtNumber(bot.grid_step_percent)} mono />
                    </>
                  )}
                  <ConfigItem
                    label={tr('Увімкнено', 'Enabled')}
                    value={bot.is_active ? tr('Так', 'Yes') : tr('Ні', 'No')}
                  />
                  <ConfigItem
                    label={tr('Дата запуску', 'Started At')}
                    value={fmtDateTime(bot.started_at, locale)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Дата зупинки', 'Stopped At')}
                    value={fmtDateTime(bot.stopped_at, locale)}
                    mono
                  />
                  <ConfigItem
                    label={tr('Останній запуск', 'Last Run')}
                    value={fmtDateTime(bot.last_run_at, locale)}
                    mono
                  />
                </dl>

                {bot.last_error ? (
                  <div className={styles.errorRecovery}>
                    <div className={styles.errorRecoveryHead}>
                      <strong>{tr('Обробка помилки', 'Error recovery')}</strong>
                      <span>{formatErrorSeverity(bot.last_error_severity, tr)}</span>
                    </div>
                    <p className={styles.lastError}>{bot.last_error}</p>
                    <dl className={styles.errorRecoveryGrid}>
                      <div><dt>{tr('Тип', 'Type')}</dt><dd>{formatErrorType(bot.last_error_type, tr)}</dd></div>
                      <div><dt>{tr('Дія', 'Action')}</dt><dd>{formatErrorAction(bot.last_error_action, tr)}</dd></div>
                      <div><dt>{tr('Код', 'Code')}</dt><dd className="mono">{bot.last_error_code || '—'}</dd></div>
                      <div><dt>{tr('Спроба', 'Retry')}</dt><dd className="mono">{bot.error_retry_count || 0}</dd></div>
                      {bot.next_retry_at ? <div><dt>{tr('Наступна спроба', 'Next retry')}</dt><dd className="mono">{fmtDateTime(bot.next_retry_at, locale)}</dd></div> : null}
                    </dl>
                  </div>
                ) : null}
                {bot.last_risk_message ? (
                  <p className={styles.riskMessage}>
                    {tr('Ризик:', 'Risk:')} {bot.last_risk_message}
                  </p>
                ) : null}

                <div className={styles.actions}>
                  <Button
                    icon={<Play size={16} />}
                    onClick={handleStart}
                    loading={action === "start"}
                  >
                    {tr('Запустити бота', 'Start bot')}
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<Square size={16} />}
                    onClick={handleStop}
                    disabled={action !== ""}
                  >
                    {tr('Зупинити бота', 'Stop bot')}
                  </Button>
                  <Button
                    variant="ghost"
                    icon={<RefreshCw size={16} />}
                    onClick={handleSync}
                    loading={action === "sync"}
                  >
                    {tr('Синхронізувати ордери', 'Sync orders')}
                  </Button>
                  <Button
                    variant="danger"
                    icon={<ShieldAlert size={16} />}
                    onClick={handleClosePosition}
                    loading={action === "close-position"}
                    disabled={action !== "" || positionSize <= 0}
                  >
                    {tr('Закрити позицію', 'Close position')}
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Ban size={16} />}
                    onClick={handleCancelOrders}
                    loading={action === "cancel"}
                  >
                    {tr('Скасувати всі ордери', 'Cancel all orders')}
                  </Button>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={16} />}
                    onClick={handleClearHistory}
                    loading={action === "clear"}
                    disabled={action !== "" && action !== "clear"}
                  >
                    {tr('Очистити історію', 'Clear history')}
                  </Button>
                </div>
              </Card>
            </section>

            <section>
              <Card className={styles.ordersCard}>
                <CardHeader
                  eyebrow={tr('Ордери / Угоди', 'Orders / Trades')}
                  title={tr('Історія ордерів', 'Order history')}
                  action={
                    <div className={styles.orderTotals}>
                      <span><b>{openOrders.length}</b> {tr('відкритих', 'open')}</span>
                      <span><b>{filledOrders.length}</b> {tr('виконаних', 'filled')}</span>
                      {rejectedOrders.length > 0 ? <span><b>{rejectedOrders.length}</b> {tr('відхилених', 'rejected')}</span> : null}
                    </div>
                  }
                />

                <div className={styles.orderTabs} role="tablist" aria-label={tr('Фільтр статусу ордерів', 'Order status filter')}>
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
                  <div className={styles.emptyOrders}>{tr('Немає ордерів для фільтра', 'No orders for filter')} “{orderFilters.find((item) => item.value === orderFilter)?.label || orderFilter}”.</div>
                ) : (
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{tr('Створено', 'Created')}</th>
                          <th>{tr('Символ', 'Symbol')}</th>
                          <th>{tr('Сторона', 'Side')}</th>
                          <th>{tr('Роль', 'Role')}</th>
                          <th>{tr('Тип', 'Type')}</th>
                          <th className={styles.numericHeader}>{tr('Кількість', 'Qty')}</th>
                          <th className={styles.numericHeader}>{tr('Ціна', 'Price')}</th>
                          <th>{tr('Статус', 'Status')}</th>
                          <th>{tr('ID біржі', 'Exchange ID')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleOrders.map((order) => (
                          <tr key={order.id} className={getOrderRowClass(order)}>
                            <td className={styles.dateCell}>{fmtDateTime(order.created_at, locale)}</td>
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
                  eyebrow={tr('Події worker', 'Worker events')}
                  title={tr('Активність бота', 'Bot activity')}
                  action={<span className={styles.eventCount}>{events.length} {tr('подій', 'events')}</span>}
                />

                {events.length === 0 ? (
                  <div className={styles.emptyOrders}>{tr('Подій ще немає.', 'No events yet.')}</div>
                ) : (
                  <>
                    <div className={styles.eventsList}>
                      {visibleEvents.map((event) => (
                        <article key={event.id} className={styles.eventRow}>
                          <span className={styles.eventRail} aria-hidden="true" />
                          <div className={styles.eventBody}>
                            <div className={styles.eventMeta}>
                              <EventBadge type={event.event_type} />
                              <time className="mono">{fmtDateTime(event.created_at, locale)}</time>
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
                        {showAllEvents ? tr('Показати останні 12', 'Show latest 12') : `${tr('Показати всі', 'Show all')} ${events.length} ${tr('подій', 'events')}`}
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

function getRuntimeLabel(value, tr) {
  const labels = {
    stopped: tr('Зупинено', 'Stopped'),
    running: tr('Запущено', 'Running'),
    waiting_for_entry: tr('Очікування входу', 'Waiting for entry'),
    waiting_for_signal: tr('Очікування сигналу', 'Waiting for signal'),
    cooldown: tr('Cooldown', 'Cooldown'),
    position_open: tr('Позиція відкрита', 'Position open'),
    tp_active: tr('TP активний', 'TP active'),
    risk_blocked: tr('Заблоковано ризиком', 'Risk blocked'),
    error: tr('Помилка', 'Error'),
    retrying: tr('Повторна спроба', 'Retrying'),
    paused: tr('Пауза — потрібна дія', 'Paused — action required'),
  };
  return labels[value] || value;
}

function formatErrorType(value, tr) {
  const labels = {
    network: tr('Мережа', 'Network'), rate_limit: tr('Rate limit', 'Rate limit'),
    exchange_unavailable: tr('Біржа недоступна', 'Exchange unavailable'), time_sync: tr('Синхронізація часу', 'Time sync'),
    authentication: tr('Автентифікація', 'Authentication'), permission: tr('Права доступу', 'Permission'),
    insufficient_funds: tr('Недостатньо коштів', 'Insufficient funds'), invalid_order: tr('Некоректний ордер', 'Invalid order'),
    invalid_symbol: tr('Некоректний символ', 'Invalid symbol'), order_state: tr('Стан ордера', 'Order state'),
    configuration: tr('Конфігурація', 'Configuration'), risk: tr('Ризик / ліквідація', 'Risk / liquidation'),
    internal: tr('Внутрішня помилка', 'Internal error'),
  };
  return labels[value] || value || '—';
}

function formatErrorAction(value, tr) {
  const labels = {
    retry_backoff: tr('Повторити з паузою', 'Retry with backoff'),
    resync_and_retry: tr('Синхронізувати і повторити', 'Resync and retry'),
    pause: tr('Поставити бота на паузу', 'Pause bot'),
    stop: tr('Зупинити з помилкою', 'Stop with error'),
  };
  return labels[value] || value || '—';
}

function formatErrorSeverity(value, tr) {
  const labels = { warning: tr('Попередження', 'Warning'), error: tr('Помилка', 'Error'), critical: tr('Критична', 'Critical') };
  return labels[value] || value || tr('Помилка', 'Error');
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatSignalScore(score, isMomentum = false) {
  if (score == null) return "—";
  return isMomentum ? `${Math.round(score)}%` : `${Math.round(score * 100)}%`;
}

function formatMaybeNumber(value, decimals = 2) {
  if (value == null) return "—";
  return fmtNumber(Number(value), decimals);
}

function formatMaybeMoney(value) {
  if (value == null) return "—";
  return fmtMoney(Number(value));
}
