import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { ConfirmModalProvider } from '../../context/ConfirmModalContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ botId: '7' }),
}));
jest.mock('../../api/bots', () => ({
  getBot: jest.fn(() => new Promise(() => {})),
  getBotPosition: jest.fn(() => new Promise(() => {})),
  getBotRisk: jest.fn(() => new Promise(() => {})),
  getBotPerformance: jest.fn(() => new Promise(() => {})),
  listBotOrders: jest.fn(() => new Promise(() => {})),
  listBotEvents: jest.fn(() => new Promise(() => {})),
  startBot: jest.fn(), stopBot: jest.fn(), syncBot: jest.fn(),
  cancelBotOrders: jest.fn(), closeBotPosition: jest.fn(), clearBotHistory: jest.fn(),
}));
jest.mock('../../websocket/useAuthenticatedWebSocket', () => ({
  useAuthenticatedWebSocket: jest.fn(() => 'offline'),
}));

import { useAuth } from '../../context/AuthContext';
import BotDetailPage from '../../pages/BotDetailPage/BotDetailPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider><ConfirmModalProvider>{children}</ConfirmModalProvider></LanguageProvider></MemoryRouter>
);

describe('pages/BotDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'u@test.com' }, isAuthenticated: true });
  });

  it('snapshot — loading state', () => {
    const { container } = render(<BotDetailPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<BotDetailPage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders without throwing', () => {
    let container;
    expect(() => {
      ({ container } = render(<BotDetailPage />, { wrapper: Wrapper }));
    }).not.toThrow();
    expect(container).toMatchSnapshot();
  });

  it('snapshot — with botId param provided', () => {
    const { container } = render(<BotDetailPage />, { wrapper: Wrapper });
    expect(container.firstChild).toBeTruthy();
    expect(container).toMatchSnapshot();
  });
});
