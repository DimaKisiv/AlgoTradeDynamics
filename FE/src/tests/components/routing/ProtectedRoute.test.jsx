import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';

jest.mock('../../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../../../context/AuthContext';
import ProtectedRoute from '../../../components/routing/ProtectedRoute';

const Wrapper = ({ children, route = '/' }) => (
  <MemoryRouter initialEntries={[route]}>
    <LanguageProvider>{children}</LanguageProvider>
  </MemoryRouter>
);

describe('routing/ProtectedRoute', () => {
  it('snapshot — authenticated renders children', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    const { container } = render(
      <Wrapper>
        <ProtectedRoute><div data-testid="child">Protected Content</div></ProtectedRoute>
      </Wrapper>
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot — loading returns null', () => {
    useAuth.mockReturnValue({ loading: true, isAuthenticated: false });
    const { container } = render(
      <Wrapper>
        <ProtectedRoute><span>Protected</span></ProtectedRoute>
      </Wrapper>
    );
    expect(container).toMatchSnapshot();
  });

  it('renders nothing while loading', () => {
    useAuth.mockReturnValue({ loading: true, isAuthenticated: false });
    const { container } = render(
      <Wrapper>
        <ProtectedRoute><span>Protected</span></ProtectedRoute>
      </Wrapper>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects to /login when not authenticated', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: false });
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <LanguageProvider>
          <Routes>
            <Route path="/login" element={<span>Login Page</span>} />
            <Route path="/dashboard" element={
              <ProtectedRoute><span>Protected</span></ProtectedRoute>
            } />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    render(
      <Wrapper>
        <ProtectedRoute><span>Protected Content</span></ProtectedRoute>
      </Wrapper>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
