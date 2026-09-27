import { describe, it, expect } from 'vitest';
import { isValidCardNumber, cardNumberError } from './format';

describe('card number validation (Luhn)', () => {
  it('accepts real-looking Iranian cards and rejects random 16-digit numbers', () => {
    expect(isValidCardNumber('6037991712349876')).toBe(false); // random
    expect(isValidCardNumber('6037 9975 9999 9993')).toBe(true); // Luhn-valid
    expect(isValidCardNumber('۶۰۳۷۹۹۷۵۹۹۹۹۹۹۹۳')).toBe(true); // Persian digits
    expect(isValidCardNumber('6037991')).toBe(false);
    expect(cardNumberError('')).toBeNull();
    expect(cardNumberError('6037991712349876')).toMatch(/اشتباه/);
    expect(cardNumberError('603799')).toMatch(/۱۶ رقم/);
  });
});
