import './Card.css';

export default function Card({ children, className = '', as: As = 'div', ...props }) {
  return (
    <As className={`card glass-strong ${className}`} {...props}>
      {children}
    </As>
  );
}

export function CardHeader({ eyebrow, title, action, className = '' }) {
  return (
    <div className={`card-header ${className}`}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {title && <h3 className="card-header__title">{title}</h3>}
      </div>
      {action && <div className="card-header__action">{action}</div>}
    </div>
  );
}
