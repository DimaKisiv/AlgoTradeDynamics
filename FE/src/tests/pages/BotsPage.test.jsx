import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../api/bots', () => ({
  listBots: jest.fn(() => Promise.resolve([])),
  createBot: jest.fn(), updateBot: jest.fn(), deleteBot: jest.fn(),
  startBot: jest.fn(), stopBot: jest.fn(),
}));
jest.mock('../../api/emulator', () => ({
  emulatorApi: { health: jest.fn(() => Promise.resolve({ status: 'ok' })) },
}));

import { useAuth } from '../../context/AuthContext';
import BotsPage from '../../pages/BotsPage/BotsPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider>{children}</LanguageProvider></MemoryRouter>
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
});
