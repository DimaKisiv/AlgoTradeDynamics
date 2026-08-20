import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import Footer from '../../../components/layout/Footer/Footer';

const Wrapper = ({ children }) => (
  <MemoryRouter>
    <LanguageProvider>{children}</LanguageProvider>
  </MemoryRouter>
);

describe('layout/Footer', () => {
  it('snapshot', () => {
    const { container } = render(<Footer />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders brand name', () => {
    render(<Footer />, { wrapper: Wrapper });
    expect(screen.getByText('AlgoTradeDynamics')).toBeInTheDocument();
  });

  it('renders logo image', () => {
    render(<Footer />, { wrapper: Wrapper });
    const img = document.querySelector('img.logo');
    expect(img).toBeInTheDocument();
  });

  it('renders GitHub link', () => {
    render(<Footer />, { wrapper: Wrapper });
    const link = screen.getByLabelText('GitHub');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/DimaKisiv/AlgoTradeDynamics');
  });

  it('renders team members', () => {
    render(<Footer />, { wrapper: Wrapper });
    expect(screen.getByText('\u0406\u043b\u043b\u044f \u0410\u0440\u0442\u044e\u0448\u0435\u043d\u043a\u043e')).toBeInTheDocument();
  });
});
