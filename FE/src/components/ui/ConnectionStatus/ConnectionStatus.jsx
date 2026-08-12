import styles from "./ConnectionStatus.module.css";

export default function ConnectionStatus({ status = "offline", tr = (uk) => uk }) {
  const normalized = ["live", "reconnecting", "offline"].includes(status) ? status : "offline";
  const label = {
    live: tr("Live", "Live"),
    reconnecting: tr("Перепідключення", "Reconnecting"),
    offline: tr("Offline", "Offline"),
  }[normalized];

  return (
    <span className={`${styles.badge} ${styles[normalized]}`} title={tr("Статус WebSocket-з’єднання", "WebSocket connection status")}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}
