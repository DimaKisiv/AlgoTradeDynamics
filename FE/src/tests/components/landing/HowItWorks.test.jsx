import { render, screen } from '@testing-library/react';
import { LanguageProvider } from '../../../context/LanguageContext';
import HowItWorks from '../../../components/landing/HowItWorks/HowItWorks';

const Wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;

describe('landing/HowItWorks', () => {
  it('snapshot', () => {
    const { container } = render(<HowItWorks />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders step numbers 01–04', () => {
    render(<HowItWorks />, { wrapper: Wrapper });
    ['01', '02', '03', '04'].forEach((n) => {
      expect(screen.getByText(n)).toBeInTheDocument();
    });
  });

  it('renders section id how-it-works', () => {
    render(<HowItWorks />, { wrapper: Wrapper });
    expect(document.querySelector('#how-it-works')).toBeInTheDocument();
  });
});
