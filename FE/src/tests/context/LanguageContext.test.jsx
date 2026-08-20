import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../../context/LanguageContext';

function LangDisplay() {
  const { language, t, tr, setLanguage } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="home">{t('navbar.home')}</span>
      <span data-testid="tr">{tr('Привіт', 'Hello')}</span>
      <button onClick={() => setLanguage('en')}>Switch EN</button>
      <button onClick={() => setLanguage('uk')}>Switch UK</button>
    </div>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
  });

  it('snapshot — default Ukrainian state', () => {
    const { container } = render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot — English state', () => {
    localStorage.setItem('algoTradeDynamics.language', 'en');
    const { container } = render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('defaults to uk language', () => {
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('uk');
  });

  it('t() returns Ukrainian translation', () => {
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    expect(screen.getByTestId('home').textContent).toBe('\u041e\u0433\u043b\u044f\u0434');
  });

  it('tr() returns Ukrainian string by default', () => {
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    expect(screen.getByTestId('tr').textContent).toBe('\u041f\u0440\u0438\u0432\u0456\u0442');
  });

  it('switches to en and updates translations', () => {
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    fireEvent.click(screen.getByText('Switch EN'));
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(screen.getByTestId('tr').textContent).toBe('Hello');
  });

  it('persists language to localStorage', () => {
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    fireEvent.click(screen.getByText('Switch EN'));
    expect(localStorage.getItem('algoTradeDynamics.language')).toBe('en');
  });

  it('restores language from localStorage', () => {
    localStorage.setItem('algoTradeDynamics.language', 'en');
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('en');
  });

  it('sets document.documentElement.lang', () => {
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    expect(document.documentElement.lang).toBe('uk');
  });

  it('useLanguage throws when used outside LanguageProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function BadComponent() {
      useLanguage();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow();
    spy.mockRestore();
  });

  it('t() falls back to key when translation missing', () => {
    render(<LanguageProvider><LangDisplay /></LanguageProvider>);
    function MissingKey() {
      const { t } = useLanguage();
      return <span data-testid="missing">{t('does.not.exist')}</span>;
    }
    render(<LanguageProvider><MissingKey /></LanguageProvider>);
    expect(screen.getByTestId('missing').textContent).toBe('does.not.exist');
  });
});
