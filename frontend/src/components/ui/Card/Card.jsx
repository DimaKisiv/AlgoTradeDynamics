import styles from './Card.module.css';

export default function Card({ children, className = '', as: As = 'div', ...props }) {
  return (
    <As className={`${styles.card} glass-strong ${className}`} {...props}>
      {children}
    </As>
  );
}

export function CardHeader({ eyebrow, title, action, className = '' }) {
  return (
    <div className={`${styles.cardHeader} ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h3 className={styles.cardHeaderTitle}>{title}</h3>}
      </div>
      {action && <div className={styles.cardHeaderAction}>{action}</div>}
    </div>
  );
}
