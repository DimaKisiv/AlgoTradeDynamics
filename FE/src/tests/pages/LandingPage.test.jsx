import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import LandingPage from '../../pages/LandingPage/LandingPage';

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
  <MemoryRouter><LanguageProvider>{children}</LanguageProvider></MemoryRouter>
);

describe('pages/LandingPage', () => {
  beforeEach(() => { localStorage.clear(); });

  it('snapshot', () => {
    const { container } = render(<LandingPage />, { wrapper: Wrapper });
    expect(container).toMatchSnapshot();
  });

  it('renders all 5 landing sections', () => {
    const { container } = render(<LandingPage />, { wrapper: Wrapper });
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(5);
    expect(container).toMatchSnapshot();
  });

  it('renders without throwing', () => {
    let container;
    expect(() => {
      ({ container } = render(<LandingPage />, { wrapper: Wrapper }));
    }).not.toThrow();
    expect(container).toMatchSnapshot();
  });
});
