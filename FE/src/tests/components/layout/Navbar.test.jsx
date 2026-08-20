import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import Navbar from '../../../components/layout/Navbar/Navbar';

// Completely mock AuthContext to prevent loading api/client (uses import.meta.env)
jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../../../context/AuthContext';

const guestAuth = {
  user: null,
  loading: false,
  isAuthenticated: false,
  login: jest.fn(),
  logout: jest.fn(),
};

const userAuth = {
  user: { email: 'test@example.com' },
  loading: false,
  isAuthenticated: true,
  login: jest.fn(),
  logout: jest.fn(),
};

const Wrapper = ({ children }) => (
  <MemoryRouter>
    <LanguageProvider>{children}</LanguageProvider>
  </MemoryRouter>
);

describe('layout/Navbar', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue(guestAuth);
  });

  it('snapshot \u2014 guest', () => {
    const { container } = render(<Navbar />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot \u2014 authenticated', () => {
    useAuth.mockReturnValue(userAuth);
    const { container } = render(<Navbar />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders brand logo image', () => {
    render(<Navbar />, { wrapper: Wrapper });
    const img = document.querySelector('img.logo');
    expect(img).toBeInTheDocument();
  });

  it('renders brand name text', () => {
    render(<Navbar />, { wrapper: Wrapper });
    expect(screen.getByText('Dynamics')).toBeInTheDocument();
  });

  it('shows login and register links for guest', () => {
    render(<Navbar />, { wrapper: Wrapper });
    expect(screen.getByText('\u0423\u0432\u0456\u0439\u0442\u0438')).toBeInTheDocument();
    expect(screen.getByText('\u0420\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044f')).toBeInTheDocument();
  });

  it('shows user email and logout for authenticated user', () => {
    useAuth.mockReturnValue(userAuth);
    render(<Navbar />, { wrapper: Wrapper });
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByLabelText('\u0412\u0438\u0439\u0442\u0438')).toBeInTheDocument();
  });

  it('shows UA / EN language switch buttons', () => {
    render(<Navbar />, { wrapper: Wrapper });
    expect(screen.getByText('UA')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
  });

  it('switches language when EN is clicked', () => {
    render(<Navbar />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('EN'));
    expect(localStorage.getItem('algoTradeDynamics.language')).toBe('en');
  });

  it('calls logout when logout button clicked', () => {
    const logoutMock = jest.fn();
    useAuth.mockReturnValue({ ...userAuth, logout: logoutMock });
    render(<Navbar />, { wrapper: Wrapper });
    fireEvent.click(screen.getByLabelText('\u0412\u0438\u0439\u0442\u0438'));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
