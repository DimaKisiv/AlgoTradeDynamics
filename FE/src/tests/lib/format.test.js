import {
  fmtMoney, fmtPct, fmtPctSigned, fmtMoneySigned,
  fmtNumber, fmtDate, fmtDateTime, fmtCompact,
} from '../../lib/format';

describe('lib/format', () => {
  describe('fmtMoney', () => {
    it('formats positive number with 2 decimals', () => {
      expect(fmtMoney(1234.56)).toBe('$1,234.56');
    });
    it('returns $0.00 for undefined', () => {
      expect(fmtMoney(undefined)).toBe('$0.00');
    });
    it('formats with 0 decimals', () => {
      expect(fmtMoney(1234.99, 0)).toBe('$1,235');
    });
    it('formats negative values', () => {
      expect(fmtMoney(-50)).toBe('-$50.00');
    });
  });

  describe('fmtPct', () => {
    it('appends % sign', () => {
      expect(fmtPct(12.34)).toBe('12.34%');
    });
    it('handles undefined', () => {
      expect(fmtPct(undefined)).toBe('0.00%');
    });
  });

  describe('fmtPctSigned', () => {
    it('prepends + for positive', () => {
      expect(fmtPctSigned(5)).toBe('+5.00%');
    });
    it('keeps - for negative', () => {
      expect(fmtPctSigned(-3.5)).toBe('-3.50%');
    });
    it('returns +0.00% for zero', () => {
      expect(fmtPctSigned(0)).toBe('+0.00%');
    });
  });

  describe('fmtMoneySigned', () => {
    it('prepends + for positive', () => {
      expect(fmtMoneySigned(100)).toBe('+$100.00');
    });
    it('keeps - for negative', () => {
      expect(fmtMoneySigned(-42.5)).toBe('-$42.50');
    });
  });

  describe('fmtNumber', () => {
    it('formats with 2 decimals by default', () => {
      expect(fmtNumber(1000)).toBe('1,000.00');
    });
    it('respects custom decimals', () => {
      expect(fmtNumber(1.5, 4)).toBe('1.5000');
    });
  });

  describe('fmtDate', () => {
    it('returns \u2014 for empty string', () => {
      expect(fmtDate('')).toBe('\u2014');
    });
    it('returns \u2014 for null', () => {
      expect(fmtDate(null)).toBe('\u2014');
    });
    it('returns original string for invalid date', () => {
      expect(fmtDate('not-a-date')).toBe('not-a-date');
    });
    it('formats a valid ISO date', () => {
      const result = fmtDate('2024-06-15T10:00:00Z', 'en-US');
      expect(typeof result).toBe('string');
      expect(result).toMatch(/2024/);
    });
  });

  describe('fmtDateTime', () => {
    it('returns \u2014 for null', () => {
      expect(fmtDateTime(null)).toBe('\u2014');
    });
    it('returns original for invalid date', () => {
      expect(fmtDateTime('bad')).toBe('bad');
    });
    it('formats a valid ISO datetime', () => {
      const result = fmtDateTime('2024-06-15T10:00:00Z', 'en-US');
      expect(typeof result).toBe('string');
    });
  });

  describe('fmtCompact', () => {
    it('formats thousands as K', () => {
      expect(fmtCompact(1500)).toBe('1.5K');
    });
    it('formats millions as M', () => {
      expect(fmtCompact(2000000)).toBe('2M');
    });
    it('handles zero', () => {
      expect(fmtCompact(0)).toBe('0');
    });
  });
});
