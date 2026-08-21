import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { ConfirmModalProvider } from '../../context/ConfirmModalContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: '42' }),
}));
jest.mock('../../api/backtests', () => ({
  backtestsApi: {
    get: jest.fn(() => new Promise(() => {})),
    points: jest.fn(() => new Promise(() => {})),
    cycles: jest.fn(() => new Promise(() => {})),
    orders: jest.fn(() => new Promise(() => {})),
    executions: jest.fn(() => new Promise(() => {})),
    events: jest.fn(() => new Promise(() => {})),
    pause: jest.fn(), resume: jest.fn(), cancel: jest.fn(),
  },
}));
jest.mock('../../websocket/useAuthenticatedWebSocket', () => ({
  useAuthenticatedWebSocket: jest.fn(() => 'offline'),
}));
jest.mock('recharts', () => ({
  AreaChart: ({ children }) => <div>{children}</div>,
  ComposedChart: ({ children }) => <div>{children}</div>,
  Area: () => null, Line: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
  Brush: () => null, ReferenceLine: () => null, ReferenceDot: () => null, ReferenceArea: () => null,
}));

import { useAuth } from '../../context/AuthContext';
import BacktestDetailPage from '../../pages/BacktestDetailPage/BacktestDetailPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider><ConfirmModalProvider>{children}</ConfirmModalProvider></LanguageProvider></MemoryRouter>
);

describe('pages/BacktestDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'u@test.com' }, isAuthenticated: true });
  });

  it('snapshot — loading state', () => {
    const { container } = render(<BacktestDetailPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<BacktestDetailPage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders without throwing', () => {
    let container;
    expect(() => {
      ({ container } = render(<BacktestDetailPage />, { wrapper: Wrapper }));
    }).not.toThrow();
    expect(container).toMatchSnapshot();
  });
});
