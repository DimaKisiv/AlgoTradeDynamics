import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { ConfirmModalProvider } from '../../context/ConfirmModalContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../api/bots', () => ({
  listBots: jest.fn(() => Promise.resolve([])),
  createBot: jest.fn(), updateBot: jest.fn(), deleteBot: jest.fn(),
  startBot: jest.fn(), stopBot: jest.fn(),
}));
jest.mock('../../api/emulator', () => ({
  emulatorApi: {
    health: jest.fn(() => Promise.resolve({ status: 'ok' })),
    accounts: jest.fn(() => Promise.resolve([])),
  },
}));

import { useAuth } from '../../context/AuthContext';
import BotsPage from '../../pages/BotsPage/BotsPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider><ConfirmModalProvider>{children}</ConfirmModalProvider></LanguageProvider></MemoryRouter>
);

describe('pages/BotsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'u@test.com' }, isAuthenticated: true });
  });

  it('snapshot — initial render', () => {
    const { container } = render(<BotsPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<BotsPage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders without throwing', () => {
    let container;
    expect(() => {
      ({ container } = render(<BotsPage />, { wrapper: Wrapper }));
    }).not.toThrow();
    expect(container).toMatchSnapshot();
  });

  it('shows momentum strategy in the create form', async () => {
    render(<BotsPage />, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button', { name: /Відкрити форму|Open form/i }));
    await waitFor(() => expect(screen.getByLabelText(/Стратегія|Strategy/i)).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Momentum Bot' })).toBeInTheDocument();
  });
});
