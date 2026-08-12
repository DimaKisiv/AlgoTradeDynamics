import { useLanguage } from "../../../context/LanguageContext";
import styles from "./TradingBadges.module.css";

const normalize = (value) => String(value || "").trim().toLowerCase();

export function SideBadge({ side }) {
  const { tr } = useLanguage();
  const value = normalize(side);
  const className = value === "buy" || value === "long"
    ? styles.buy
    : value === "sell" || value === "short"
      ? styles.sell
      : styles.neutral;
  const labels = {
    buy: tr('Купівля', 'Buy'),
    sell: tr('Продаж', 'Sell'),
    long: 'LONG',
    short: 'SHORT',
  };

  return <span className={`${styles.badge} ${styles.sideBadge} ${className}`}>{labels[value] || side || "—"}</span>;
}

export function StatusBadge({ status }) {
  const { tr } = useLanguage();
  const value = normalize(status);
  let className = styles.neutral;

  if (["new", "created", "pendingnew", "untriggered", "open", "queued", "running"].includes(value)) {
    className = styles.open;
  } else if (["paused"].includes(value)) {
    className = styles.partial;
  } else if (["partiallyfilled", "partially filled"].includes(value)) {
    className = styles.partial;
  } else if (["filled", "completed", "closed"].includes(value)) {
    className = styles.filled;
  } else if (["cancelled", "canceled", "deactivated"].includes(value)) {
    className = styles.cancelled;
  } else if (["rejected", "failed", "error"].includes(value)) {
    className = styles.rejected;
  } else if (["triggered"].includes(value)) {
    className = styles.triggered;
  }

  const labels = {
    new: tr('Новий', 'New'), created: tr('Створено', 'Created'), pendingnew: tr('Очікується', 'Pending'),
    untriggered: tr('Не спрацював', 'Untriggered'), open: tr('Відкритий', 'Open'), queued: tr('У черзі', 'Queued'),
    running: tr('Запущено', 'Running'), paused: tr('Пауза', 'Paused'), partiallyfilled: tr('Частково виконано', 'Partially filled'),
    filled: tr('Виконано', 'Filled'), completed: tr('Завершено', 'Completed'), closed: tr('Закрито', 'Closed'),
    cancelled: tr('Скасовано', 'Cancelled'), canceled: tr('Скасовано', 'Canceled'), deactivated: tr('Деактивовано', 'Deactivated'),
    rejected: tr('Відхилено', 'Rejected'), failed: tr('Помилка', 'Failed'), error: tr('Помилка', 'Error'), triggered: tr('Спрацював', 'Triggered'),
  };
  return <span className={`${styles.badge} ${className}`}>{labels[value] || status || "—"}</span>;
}

export function OrderTypeBadge({ type, reduceOnly = false }) {
  const { tr } = useLanguage();
  const value = normalize(type);
  const className = value === "market" ? styles.market : styles.limit;

  return (
    <span className={`${styles.badge} ${className}`}>
      {value === 'market' ? tr('Ринковий', 'Market') : value === 'limit' ? tr('Лімітний', 'Limit') : type || '—'}{reduceOnly ? ` · ${tr('Reduce', 'Reduce')}` : ''}
    </span>
  );
}

export function RoleBadge({ role, linkId = "" }) {
  const { tr } = useLanguage();
  const value = normalize(role || inferRoleFromLinkId(linkId));
  let className = styles.neutral;
  let label = role || inferRoleFromLinkId(linkId) || tr('Ордер', 'Order');

  if (value.includes("take_profit") || value.includes("take profit") || value === "tp") {
    className = styles.takeProfit;
    label = tr('TP позиції', 'Position TP');
  } else if (value.includes("grid_entry")) {
    className = styles.grid;
    label = humanizeGridRole(role || inferRoleFromLinkId(linkId), tr);
  } else if (value.includes("entry")) {
    className = styles.entry;
    label = tr('Вхід', 'Entry');
  } else if (value.includes("stop") || value.includes("sl")) {
    className = styles.stopLoss;
    label = tr('Stop Loss', 'Stop Loss');
  }

  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}

export function EventBadge({ type }) {
  const { tr } = useLanguage();
  const value = normalize(type);
  let className = styles.eventInfo;

  if (value.includes("error") || value.includes("failed") || value.includes("rejected")) {
    className = styles.eventError;
  } else if (value.includes("risk") || value.includes("blocked") || value.includes("warning")) {
    className = styles.eventWarning;
  } else if (value.includes("filled") || value.includes("completed") || value.includes("profit")) {
    className = styles.eventSuccess;
  } else if (value.includes("cancel") || value.includes("missing") || value.includes("reset") || value.includes("stopped")) {
    className = styles.eventMuted;
  } else if (value.includes("price") || value.includes("market")) {
    className = styles.eventMarket;
  }

  return <span className={`${styles.badge} ${styles.eventBadge} ${className}`}>{humanize(type, tr)}</span>;
}

export function PnlValue({ value, children, className = "" }) {
  const number = Number(value);
  const tone = Number.isFinite(number)
    ? number > 0
      ? styles.pnlPositive
      : number < 0
        ? styles.pnlNegative
        : styles.pnlNeutral
    : styles.pnlNeutral;

  return <span className={`${styles.pnl} ${tone} ${className}`}>{children ?? value ?? "—"}</span>;
}

export function inferRoleFromLinkId(linkId) {
  const value = normalize(linkId);
  if (!value) return "";
  if (value.includes("position_take_profit") || value.includes("take_profit") || value.includes("take-profit") || value.includes("-tp") || value.endsWith("tp")) {
    return "position_take_profit";
  }
  const gridMatch = value.match(/grid[_-]?entry[_-]?(\d+)?/);
  if (gridMatch) return `grid_entry_${gridMatch[1] || ""}`.replace(/_$/, "");
  if (value.includes("entry")) return "entry";
  if (value.includes("stop") || value.includes("sl")) return "stop_loss";
  return "";
}

function humanizeGridRole(role, tr) {
  const match = String(role || "").match(/(\d+)$/);
  return match ? `Grid #${match[1]}` : tr('Grid вхід', 'Grid entry');
}

function humanize(value, tr) {
  const normalized = normalize(value);
  const known = {
    bot_started: tr('Бот запущено', 'Bot started'), bot_stopped: tr('Бот зупинено', 'Bot stopped'),
    order_filled: tr('Ордер виконано', 'Order filled'), order_rejected: tr('Ордер відхилено', 'Order rejected'),
    position_closed: tr('Позицію закрито', 'Position closed'), risk_blocked: tr('Заблоковано risk guard', 'Blocked by risk guard'),
    runtime_error: tr('Runtime помилка', 'Runtime error'),
  };
  if (known[normalized]) return known[normalized];
  return String(value || tr('Подія', 'Event'))
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
