import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { ConfirmModalProvider } from '../../context/ConfirmModalContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));
jest.mock('../../api/backtests', () => ({
  backtestsApi: {
    list: jest.fn(() => Promise.resolve([])),
    datasets: jest.fn(() => Promise.resolve([])),
    create: jest.fn(),
    remove: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
  },
}));
jest.mock('../../api/bots', () => ({ listBots: jest.fn(() => Promise.resolve([])) }));
jest.mock('../../websocket/useAuthenticatedWebSocket', () => ({
  useAuthenticatedWebSocket: jest.fn(() => 'offline'),
}));

import { useAuth } from '../../context/AuthContext';
import BacktestsPage from '../../pages/BacktestsPage/BacktestsPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider><ConfirmModalProvider>{children}</ConfirmModalProvider></LanguageProvider></MemoryRouter>
);

describe('pages/BacktestsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'u@test.com' }, isAuthenticated: true });
  });

  it('snapshot — initial render', () => {
    const { container } = render(<BacktestsPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<BacktestsPage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('shows connection status badge', () => {
    const { container } = render(<BacktestsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('mentions momentum support in the hero copy', () => {
    render(<BacktestsPage />, { wrapper: Wrapper });
    expect(screen.getByText(/Momentum Bot/)).toBeInTheDocument();
  });
});
