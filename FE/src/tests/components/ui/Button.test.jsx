import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../../../context/LanguageContext';
import Button from '../../../components/ui/Button/Button';

const Wrapper = ({ children }) => <LanguageProvider>{children}</LanguageProvider>;

describe('ui/Button', () => {
  it('renders children label', () => {
    render(<Button>Click me</Button>, { wrapper: Wrapper });
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('snapshot — default primary md', () => {
    const { container } = render(<Button>Snap</Button>, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot — danger large with icon', () => {
    const { container } = render(
      <Button variant="danger" size="lg" icon={<span>X</span>}>Delete</Button>,
      { wrapper: Wrapper }
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Save</Button>, { wrapper: Wrapper });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading text when loading is true', () => {
    render(<Button loading>Save</Button>, { wrapper: Wrapper });
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/\u0412\u0438\u043a\u043e\u043d\u0443\u0454\u0442\u044c\u0441\u044f|\u2026/);
  });

  it('calls onClick handler', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>, { wrapper: Wrapper });
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders left icon when provided', () => {
    render(<Button icon={<span data-testid="ico">+</span>}>Add</Button>, { wrapper: Wrapper });
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('renders right icon when provided', () => {
    render(<Button iconRight={<span data-testid="icoR">-</span>}>Remove</Button>, { wrapper: Wrapper });
    expect(screen.getByTestId('icoR')).toBeInTheDocument();
  });

  it('passes extra props to the button element', () => {
    render(<Button aria-label="submit-btn">Submit</Button>, { wrapper: Wrapper });
    expect(screen.getByLabelText('submit-btn')).toBeInTheDocument();
  });
});
