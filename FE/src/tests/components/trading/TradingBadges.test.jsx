import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../context/LanguageContext';
import {
  SideBadge, StatusBadge, OrderTypeBadge,
  PnlValue, inferRoleFromLinkId,
} from '../../../components/trading/TradingBadges/TradingBadges';

const W = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;

describe('trading/SideBadge', () => {
  it('snapshot — buy', () => {
    const { container } = render(<SideBadge side="buy" />, { wrapper: W });
    expect(container.firstChild).toMatchSnapshot();
  });
  it('renders buy label in Ukrainian', () => {
    render(<SideBadge side="buy" />, { wrapper: W });
    expect(screen.getByText('\u041a\u0443\u043f\u0456\u0432\u043b\u044f')).toBeInTheDocument();
  });
  it('renders sell label in Ukrainian', () => {
    render(<SideBadge side="sell" />, { wrapper: W });
    expect(screen.getByText('\u041f\u0440\u043e\u0434\u0430\u0436')).toBeInTheDocument();
  });
  it('renders LONG for long', () => {
    render(<SideBadge side="long" />, { wrapper: W });
    expect(screen.getByText('LONG')).toBeInTheDocument();
  });
  it('renders SHORT for short', () => {
    render(<SideBadge side="short" />, { wrapper: W });
    expect(screen.getByText('SHORT')).toBeInTheDocument();
  });
  it('renders — for empty side', () => {
    render(<SideBadge side="" />, { wrapper: W });
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });
});

describe('trading/StatusBadge', () => {
  it('snapshot — filled', () => {
    const { container } = render(<StatusBadge status="filled" />, { wrapper: W });
    expect(container.firstChild).toMatchSnapshot();
  });
  it('renders filled label', () => {
    render(<StatusBadge status="filled" />, { wrapper: W });
    expect(screen.getByText('\u0412\u0438\u043a\u043e\u043d\u0430\u043d\u043e')).toBeInTheDocument();
  });
  it('renders cancelled label', () => {
    render(<StatusBadge status="cancelled" />, { wrapper: W });
    expect(screen.getByText('\u0421\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e')).toBeInTheDocument();
  });
});

describe('trading/OrderTypeBadge', () => {
  it('snapshot — market', () => {
    const { container } = render(<OrderTypeBadge type="market" />, { wrapper: W });
    expect(container.firstChild).toMatchSnapshot();
  });
  it('renders market label', () => {
    render(<OrderTypeBadge type="market" />, { wrapper: W });
    expect(screen.getByText('\u0420\u0438\u043d\u043a\u043e\u0432\u0438\u0439')).toBeInTheDocument();
  });
  it('renders limit label', () => {
    render(<OrderTypeBadge type="limit" />, { wrapper: W });
    expect(screen.getByText('\u041b\u0456\u043c\u0456\u0442\u043d\u0438\u0439')).toBeInTheDocument();
  });
});

describe('trading/PnlValue', () => {
  it('renders positive value', () => {
    render(<PnlValue value={42.5}>+42.50</PnlValue>);
    expect(screen.getByText('+42.50')).toBeInTheDocument();
  });
  it('renders negative value', () => {
    render(<PnlValue value={-10}>-10.00</PnlValue>);
    expect(screen.getByText('-10.00')).toBeInTheDocument();
  });
  it('renders — for missing value', () => {
    render(<PnlValue value={null} />);
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });
});

describe('trading/inferRoleFromLinkId', () => {
  it('returns position_take_profit for -tp suffix', () => {
    expect(inferRoleFromLinkId('bot_order-tp')).toBe('position_take_profit');
  });
  it('returns grid_entry pattern', () => {
    expect(inferRoleFromLinkId('grid_entry_3')).toBe('grid_entry_3');
  });
  it('returns entry for entry link', () => {
    expect(inferRoleFromLinkId('order_entry')).toBe('entry');
  });
  it('returns empty for empty input', () => {
    expect(inferRoleFromLinkId('')).toBe('');
  });
});
