import { render, screen } from '@testing-library/react';
import ConnectionStatus from '../../../components/ui/ConnectionStatus/ConnectionStatus';

describe('ui/ConnectionStatus', () => {
  it('snapshot — live', () => {
    const { container } = render(<ConnectionStatus status="live" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot — offline', () => {
    const { container } = render(<ConnectionStatus status="offline" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('snapshot — reconnecting', () => {
    const { container } = render(<ConnectionStatus status="reconnecting" />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('shows Live label for live status', () => {
    render(<ConnectionStatus status="live" />);
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('shows Offline label for offline status', () => {
    render(<ConnectionStatus status="offline" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('defaults to offline for unknown status', () => {
    render(<ConnectionStatus status="unknown-xyz" />);
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('uses custom tr function for localization', () => {
    const tr = (uk, en) => en;
    render(<ConnectionStatus status="reconnecting" tr={tr} />);
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });
});
