import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../../../context/AuthContext';
import GuestRoute from '../../../components/routing/GuestRoute';

describe('routing/GuestRoute', () => {
  it('snapshot — guest renders children', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: false });
    const { container } = render(
      <MemoryRouter>
        <LanguageProvider>
          <GuestRoute><div data-testid="form">Login Form</div></GuestRoute>
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot — loading returns null', () => {
    useAuth.mockReturnValue({ loading: true, isAuthenticated: false });
    const { container } = render(
      <MemoryRouter>
        <LanguageProvider>
          <GuestRoute><span>Guest</span></GuestRoute>
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(container).toMatchSnapshot();
  });

  it('renders nothing while loading', () => {
    useAuth.mockReturnValue({ loading: true, isAuthenticated: false });
    const { container } = render(
      <MemoryRouter>
        <LanguageProvider>
          <GuestRoute><span>Guest</span></GuestRoute>
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders children when not authenticated', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: false });
    render(
      <MemoryRouter>
        <LanguageProvider>
          <GuestRoute><span>Login Form</span></GuestRoute>
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Login Form')).toBeInTheDocument();
  });

  it('redirects to /app when already authenticated', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    render(
      <MemoryRouter initialEntries={['/login']}>
        <LanguageProvider>
          <Routes>
            <Route path="/app" element={<span>App Home</span>} />
            <Route path="/login" element={
              <GuestRoute><span>Login Form</span></GuestRoute>
            } />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('App Home')).toBeInTheDocument();
  });
});
