import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () => [new URLSearchParams('ids=1,2'), jest.fn()],
}));
jest.mock('../../api/backtests', () => ({
  backtestsApi: {
    get: jest.fn(() => new Promise(() => {})),
    points: jest.fn(() => new Promise(() => {})),
  },
}));
jest.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

import { useAuth } from '../../context/AuthContext';
import BacktestComparePage from '../../pages/BacktestComparePage/BacktestComparePage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider>{children}</LanguageProvider></MemoryRouter>
);

describe('pages/BacktestComparePage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'u@test.com' }, isAuthenticated: true });
  });

  it('snapshot — initial render', () => {
    const { container } = render(<BacktestComparePage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<BacktestComparePage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders back link to backtests', () => {
    const { container } = render(<BacktestComparePage />, { wrapper: Wrapper });
    expect(document.querySelector('a[href="/backtests"]')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });
});
