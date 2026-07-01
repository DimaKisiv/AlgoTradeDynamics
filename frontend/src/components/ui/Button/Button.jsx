import styles from './Button.module.css';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled,
  loading,
  type = 'button',
  className = '',
  ...props
}) {
  const VARIANTS = {
    primary: styles.btnPrimary,
    danger: styles.btnDanger,
    ghost: styles.btnGhost,
    link: styles.btnLink,
  };
  const SIZES = { sm: styles.btnSm, md: styles.btnMd, lg: styles.btnLg };

  const classes = [
    styles.btn,
    VARIANTS[variant],
    SIZES[size],
    loading ? styles.btnLoading : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {icon && <span className={styles.btnIcon}>{icon}</span>}
      <span className={styles.btnLabel}>{loading ? 'Виконується…' : children}</span>
      {iconRight && <span className={styles.btnIcon}>{iconRight}</span>}
    </button>
  );
}
