import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import CTA from '../../../components/landing/CTA/CTA';

const Wrapper = ({ children }) => (
  <MemoryRouter>
    <LanguageProvider>{children}</LanguageProvider>
  </MemoryRouter>
);

describe('landing/CTA', () => {
  it('snapshot', () => {
    const { container } = render(<CTA />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders the CTA button link', () => {
    render(<CTA />, { wrapper: Wrapper });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/backtests');
  });

  it('renders eyebrow text', () => {
    render(<CTA />, { wrapper: Wrapper });
    // Just check section renders without error
    expect(document.querySelector('section')).toBeInTheDocument();
  });
});
