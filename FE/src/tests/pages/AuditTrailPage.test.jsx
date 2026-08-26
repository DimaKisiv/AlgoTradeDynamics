import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';

jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../api/audit', () => ({
  auditApi: {
    list: jest.fn(() => new Promise(() => {})),
    integrity: jest.fn(() => new Promise(() => {})),
    export: jest.fn(),
  },
}));

import { useAuth } from '../../context/AuthContext';
import AuditTrailPage from '../../pages/AuditTrailPage/AuditTrailPage';

const Wrapper = ({ children }) => (
  <MemoryRouter><LanguageProvider>{children}</LanguageProvider></MemoryRouter>
);

describe('pages/AuditTrailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.mockReturnValue({ user: { email: 'u@test.com' }, isAuthenticated: true });
  });

  it('snapshot — loading state', () => {
    const { container } = render(<AuditTrailPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders main element', () => {
    const { container } = render(<AuditTrailPage />, { wrapper: Wrapper });
    expect(document.querySelector('main')).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it('renders page without errors', () => {
    const { container } = render(<AuditTrailPage />, { wrapper: Wrapper });
    expect(container.firstChild).toBeTruthy();
    expect(container).toMatchSnapshot();
  });

  it('does not throw on initial render', () => {
    let container;
    expect(() => {
      ({ container } = render(<AuditTrailPage />, { wrapper: Wrapper }));
    }).not.toThrow();
    expect(container).toMatchSnapshot();
  });
});
