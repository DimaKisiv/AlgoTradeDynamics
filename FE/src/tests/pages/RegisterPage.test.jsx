import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

import { useAuth } from '../../context/AuthContext';
import RegisterPage from '../../pages/RegisterPage/RegisterPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider>{children}</LanguageProvider></MemoryRouter>
);

describe('pages/RegisterPage', () => {
  const registerMock = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    registerMock.mockReset();
    useAuth.mockReturnValue({ register: registerMock });
  });

  it('snapshot — empty form', () => {
    const { container } = render(<RegisterPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders email input', () => {
    const { container } = render(<RegisterPage />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('shows error when password is too short', async () => {
    const { container } = render(<RegisterPage />, { wrapper: Wrapper });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'u@test.com' } });
    const passwordInput = document.querySelector('input[type="password"]');
    fireEvent.change(passwordInput, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(registerMock).not.toHaveBeenCalled();
    expect(container).toMatchSnapshot();
  });

  it('calls register with valid data', async () => {
    registerMock.mockResolvedValueOnce({});
    const { container } = render(<RegisterPage />, { wrapper: Wrapper });
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'new@test.com' } });
    const passwordInput = document.querySelector('input[type="password"]');
    fireEvent.change(passwordInput, { target: { value: 'securepass' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(registerMock).toHaveBeenCalledWith('new@test.com', 'securepass'));
    expect(container).toMatchSnapshot();
  });
});
