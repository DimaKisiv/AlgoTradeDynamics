import styles from "./TradingBadges.module.css";

const normalize = (value) => String(value || "").trim().toLowerCase();

export function SideBadge({ side }) {
  const value = normalize(side);
  const className = value === "buy" || value === "long"
    ? styles.buy
    : value === "sell" || value === "short"
      ? styles.sell
      : styles.neutral;

  return <span className={`${styles.badge} ${styles.sideBadge} ${className}`}>{side || "—"}</span>;
}

export function StatusBadge({ status }) {
  const value = normalize(status);
  let className = styles.neutral;

  if (["new", "created", "pendingnew", "untriggered", "open"].includes(value)) {
    className = styles.open;
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

  return <span className={`${styles.badge} ${className}`}>{status || "—"}</span>;
}

export function OrderTypeBadge({ type, reduceOnly = false }) {
  const value = normalize(type);
  const className = value === "market" ? styles.market : styles.limit;

  return (
    <span className={`${styles.badge} ${className}`}>
      {type || "—"}{reduceOnly ? " · Reduce" : ""}
    </span>
  );
}

export function RoleBadge({ role, linkId = "" }) {
  const value = normalize(role || inferRoleFromLinkId(linkId));
  let className = styles.neutral;
  let label = role || inferRoleFromLinkId(linkId) || "Order";

  if (value.includes("take_profit") || value.includes("take profit") || value === "tp") {
    className = styles.takeProfit;
    label = "Position TP";
  } else if (value.includes("grid_entry")) {
    className = styles.grid;
    label = humanizeGridRole(role || inferRoleFromLinkId(linkId));
  } else if (value.includes("entry")) {
    className = styles.entry;
    label = "Entry";
  } else if (value.includes("stop") || value.includes("sl")) {
    className = styles.stopLoss;
    label = "Stop Loss";
  }

  return <span className={`${styles.badge} ${className}`}>{label}</span>;
}

export function EventBadge({ type }) {
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

  return <span className={`${styles.badge} ${styles.eventBadge} ${className}`}>{humanize(type)}</span>;
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

function humanizeGridRole(role) {
  const match = String(role || "").match(/(\d+)$/);
  return match ? `Grid #${match[1]}` : "Grid entry";
}

function humanize(value) {
  return String(value || "Event")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
