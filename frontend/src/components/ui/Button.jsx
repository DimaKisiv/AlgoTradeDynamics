import './Button.css';

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
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    loading ? 'btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} {...props}>
      {icon && <span className="btn__icon">{icon}</span>}
      <span className="btn__label">{loading ? 'Виконується…' : children}</span>
      {iconRight && <span className="btn__icon">{iconRight}</span>}
    </button>
  );
}
