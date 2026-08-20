import { translations } from '../../i18n/translations';

describe('i18n/translations', () => {
  it('has uk and en keys at the top level', () => {
    expect(translations).toHaveProperty('uk');
    expect(translations).toHaveProperty('en');
  });

  ['uk', 'en'].forEach((lang) => {
    describe(lang, () => {
      it('has navbar section', () => {
        expect(translations[lang]).toHaveProperty('navbar');
      });
      it('navbar has required keys', () => {
        const nav = translations[lang].navbar;
        ['home', 'bots', 'backtests', 'emulator', 'login', 'register'].forEach((k) => {
          expect(nav).toHaveProperty(k);
          expect(typeof nav[k]).toBe('string');
        });
      });
      it('has footer section with required keys', () => {
        const footer = translations[lang].footer;
        expect(footer).toHaveProperty('caption');
        expect(footer).toHaveProperty('legal');
      });
      it('has hero section', () => {
        expect(translations[lang]).toHaveProperty('hero');
      });
      it('features.items is a non-empty array', () => {
        expect(Array.isArray(translations[lang].features.items)).toBe(true);
        expect(translations[lang].features.items.length).toBeGreaterThan(0);
      });
      it('howItWorks.steps is a non-empty array', () => {
        expect(Array.isArray(translations[lang].howItWorks.steps)).toBe(true);
      });
      it('strategies.cards is a non-empty array', () => {
        expect(Array.isArray(translations[lang].strategies.cards)).toBe(true);
      });
    });
  });
});
