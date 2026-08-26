import { render } from '@testing-library/react';
import { LanguageProvider } from '../../../context/LanguageContext';
import Strategies from '../../../components/landing/Strategies/Strategies';

const Wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;

describe('landing/Strategies', () => {
  it('snapshot', () => {
    const { container } = render(<Strategies />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders 3 strategy cards', () => {
    render(<Strategies />, { wrapper: Wrapper });
    expect(document.querySelectorAll('article').length).toBe(3);
  });

  it('renders section id strategies', () => {
    render(<Strategies />, { wrapper: Wrapper });
    expect(document.querySelector('#strategies')).toBeInTheDocument();
  });
});
