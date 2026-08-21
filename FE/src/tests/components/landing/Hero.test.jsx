import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../../context/LanguageContext';
import Hero from '../../../components/landing/Hero/Hero';

// framer-motion: render children immediately without animation
jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy({}, {
    get: (_, prop) => {
      const Tag = prop;
      return ({ children, ...rest }) => {
        const {
          initial: _initial,
          animate: _animate,
          variants: _variants,
          transition: _transition,
          custom: _custom,
          whileHover: _whileHover,
          whileTap: _whileTap,
          ...domProps
        } = rest;
        return React.createElement(Tag, domProps, children);
      };
    },
  });
  return { motion, AnimatePresence: ({ children }) => children };
});

const Wrapper = ({ children }) => (
  <MemoryRouter>
    <LanguageProvider>{children}</LanguageProvider>
  </MemoryRouter>
);

describe('landing/Hero', () => {
  it('snapshot', () => {
    const { container } = render(<Hero />, { wrapper: Wrapper });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders the start backtest link', () => {
    render(<Hero />, { wrapper: Wrapper });
    expect(screen.getByText('\u0417\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0438 Backtest')).toBeInTheDocument();
  });

  it('renders PnL stat', () => {
    render(<Hero />, { wrapper: Wrapper });
    expect(screen.getByText('+18.4%')).toBeInTheDocument();
  });

  it('renders how it works anchor link', () => {
    render(<Hero />, { wrapper: Wrapper });
    expect(screen.getByText('\u042f\u043a \u0446\u0435 \u043f\u0440\u0430\u0446\u044e\u0454')).toBeInTheDocument();
  });
});
