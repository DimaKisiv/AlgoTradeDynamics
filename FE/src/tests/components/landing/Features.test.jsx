import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../context/LanguageContext';
import Features from '../../../components/landing/Features/Features';

const Wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;

describe('landing/Features', () => {
  it('renders section with features grid', () => {
    render(<Features />, { wrapper: Wrapper });
    const articles = document.querySelectorAll('article');
    expect(articles.length).toBeGreaterThan(0);
  });

  it('snapshot', () => {
    const { container } = render(<Features />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders 6 feature cards', () => {
    render(<Features />, { wrapper: Wrapper });
    expect(document.querySelectorAll('article').length).toBe(6);
  });

  it('renders eyebrow text', () => {
    render(<Features />, { wrapper: Wrapper });
    expect(screen.getByText('\u0429\u043e \u0432\u0441\u0435\u0440\u0435\u0434\u0438\u043d\u0456')).toBeInTheDocument();
  });
});
