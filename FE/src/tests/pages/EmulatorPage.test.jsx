import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmModalProvider } from '../../context/ConfirmModalContext';
import { LanguageProvider } from '../../context/LanguageContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../api/emulator', () => ({
  emulatorApi: {
    getAccounts: jest.fn(() => Promise.resolve([])),
    getAccount: jest.fn(() => new Promise(() => {})),
    getActivity: jest.fn(() => Promise.resolve([])),
    createOrder: jest.fn(), cancelOrder: jest.fn(),
    runScenario: jest.fn(), startHistorical: jest.fn(),
    stopHistorical: jest.fn(), resetAccount: jest.fn(),
    health: jest.fn(() => Promise.resolve({ status: 'ok' })),
  },
}));
jest.mock('../../websocket/useAuthenticatedWebSocket', () => ({
  useAuthenticatedWebSocket: jest.fn(() => 'offline'),
}));
jest.mock('recharts', () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

import { useAuth } from '../../context/AuthContext';
import EmulatorPage from '../../pages/EmulatorPage/EmulatorPage';

const Wrapper = ({ children }) => (
  <MemoryRouter>
    <LanguageProvider>
      <ConfirmModalProvider>{children}</ConfirmModalProvider>
    </LanguageProvider>
  </MemoryRouter>
);

describe('pages/EmulatorPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'u@test.com' }, isAuthenticated: true });
  });

  it('snapshot — initial render', () => {
    const { container } = render(<EmulatorPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<EmulatorPage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('shows connection status badge', () => {
    const { container } = render(<EmulatorPage />, { wrapper: Wrapper });
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders without throwing', () => {
    let container;
    expect(() => {
      ({ container } = render(<EmulatorPage />, { wrapper: Wrapper }));
    }).not.toThrow();
    expect(container).toMatchSnapshot();
  });
});
