import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfirmModalProvider } from '../../context/ConfirmModalContext';
import { LanguageProvider } from '../../context/LanguageContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));
jest.mock('../../api/notifications', () => ({
  fetchTelegramStatus: jest.fn(() => new Promise(() => {})),
  createTelegramConnectLink: jest.fn(),
  disconnectTelegram: jest.fn(),
  sendTelegramTest: jest.fn(),
  updateTelegramPreferences: jest.fn(),
}));
jest.mock('../../api/privacy', () => ({
  deleteMyAccount: jest.fn(),
  downloadMyData: jest.fn(),
}));

import { useAuth } from '../../context/AuthContext';
import AccountPage from '../../pages/AccountPage/AccountPage';

const Wrapper = ({ children }) => (
  <MemoryRouter>
    <LanguageProvider>
      <ConfirmModalProvider>{children}</ConfirmModalProvider>
    </LanguageProvider>
  </MemoryRouter>
);

describe('pages/AccountPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'user@test.com' }, logout: jest.fn() });
  });

  it('snapshot — initial render', () => {
    const { container } = render(<AccountPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<AccountPage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('shows user email', () => {
    const { container } = render(<AccountPage />, { wrapper: Wrapper });
    expect(screen.getByText('user@test.com')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders Telegram section', () => {
    const { container } = render(<AccountPage />, { wrapper: Wrapper });
    expect(screen.getByText(/Telegram/i)).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });
});
