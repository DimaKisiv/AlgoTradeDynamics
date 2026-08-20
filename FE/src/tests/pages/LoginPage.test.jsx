import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ state: null }),
}));

import { useAuth } from '../../context/AuthContext';
import LoginPage from '../../pages/LoginPage/LoginPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider>{children}</LanguageProvider></MemoryRouter>
);

describe('pages/LoginPage', () => {
  const loginMock = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    loginMock.mockReset();
    useAuth.mockReturnValue({ login: loginMock });
  });

  it('snapshot — empty form', () => {
    const { container } = render(<LoginPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders email and password inputs', () => {
    const { container } = render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders demo credentials hint', () => {
    const { container } = render(<LoginPage />, { wrapper: Wrapper });
    expect(screen.getByText(/demo@algotrade\.dev/)).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('calls login with email and password on submit', async () => {
    loginMock.mockResolvedValueOnce({});
    const { container } = render(<LoginPage />, { wrapper: Wrapper });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'u@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'), { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('u@test.com', 'pass123'));
    expect(container).toMatchSnapshot();
  });

  it('shows error message when login fails', async () => {
    loginMock.mockRejectedValueOnce({ message: 'Invalid credentials' });
    const { container } = render(<LoginPage />, { wrapper: Wrapper });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials'));
    expect(container).toMatchSnapshot();
  });
});
