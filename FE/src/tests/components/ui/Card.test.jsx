import { render, screen } from '@testing-library/react';
import Card, { CardHeader } from '../../../components/ui/Card/Card';

describe('ui/Card', () => {
  it('renders children', () => {
    render(<Card><p>Content</p></Card>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('snapshot — default Card', () => {
    const { container } = render(<Card><span>Snap</span></Card>);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('applies extra className', () => {
    const { container } = render(<Card className="extra"><span>x</span></Card>);
    expect(container.firstChild.className).toContain('extra');
  });

  it('renders as a custom element when as prop is provided', () => {
    const { container } = render(<Card as="section"><span>x</span></Card>);
    expect(container.querySelector('section')).toBeInTheDocument();
  });
});

describe('ui/CardHeader', () => {
  it('renders title', () => {
    render(<CardHeader title="My Title" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('snapshot — CardHeader with eyebrow + action', () => {
    const { container } = render(
      <CardHeader eyebrow="TAG" title="Title" action={<button>Act</button>} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders eyebrow when provided', () => {
    render(<CardHeader eyebrow="EYEBROW" title="T" />);
    expect(screen.getByText('EYEBROW')).toBeInTheDocument();
  });

  it('renders action slot when provided', () => {
    render(<CardHeader title="T" action={<button>Edit</button>} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('does not render eyebrow when omitted', () => {
    render(<CardHeader title="T" />);
    expect(screen.queryByText('EYEBROW')).not.toBeInTheDocument();
  });
});
