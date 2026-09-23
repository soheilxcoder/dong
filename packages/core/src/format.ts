const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** 1234567 -> "۱,۲۳۴,۵۶۷" */
export function formatAmount(amount: number, persian = true): string {
  const s = Math.abs(Math.trunc(amount)).toLocaleString('en-US');
  const withSign = amount < 0 ? `-${s}` : s;
  return persian ? toPersianDigits(withSign) : withSign;
}

export function formatToman(amount: number, persian = true): string {
  return `${formatAmount(amount, persian)} تومان`;
}

/** "6037991712345678" -> "6037 9917 1234 5678" */
export function formatCardNumber(card: string, sep = ' '): string {
  const digits = toEnglishDigits(card).replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, `$1${sep}`);
}

export function normalizeCardNumber(card: string): string {
  return toEnglishDigits(card).replace(/\D/g, '');
}

export function isValidCardNumber(card: string): boolean {
  return /^\d{16}$/.test(normalizeCardNumber(card));
}

/** Parse a user-typed amount ("۱۲,۰۰۰" / "12000") to integer toman. */
export function parseAmount(input: string): number {
  const n = Number(toEnglishDigits(input).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Bank detection by BIN (first 6 digits) — Iranian banks. */
const BINS: Record<string, { name: string; color: string }> = {
  '603799': { name: 'بانک ملی', color: '#C8A24B' },
  '589210': { name: 'بانک سپه', color: '#1E4E9A' },
  '627648': { name: 'توسعه صادرات', color: '#0B7A57' },
  '627961': { name: 'صنعت و معدن', color: '#2B4C8C' },
  '603770': { name: 'کشاورزی', color: '#0E7A3E' },
  '639217': { name: 'کشاورزی', color: '#0E7A3E' },
  '628023': { name: 'بانک مسکن', color: '#E1622A' },
  '627760': { name: 'پست بانک', color: '#0E7C3F' },
  '502908': { name: 'توسعه تعاون', color: '#0F5C9F' },
  '627412': { name: 'اقتصاد نوین', color: '#5B2C83' },
  '622106': { name: 'پارسیان', color: '#9C1F2E' },
  '627884': { name: 'پارسیان', color: '#9C1F2E' },
  '639194': { name: 'پارسیان', color: '#9C1F2E' },
  '502229': { name: 'پاسارگاد', color: '#D9A21B' },
  '639347': { name: 'پاسارگاد', color: '#D9A21B' },
  '627488': { name: 'کارآفرین', color: '#1E7D69' },
  '502910': { name: 'کارآفرین', color: '#1E7D69' },
  '621986': { name: 'سامان', color: '#1BA0D8' },
  '639346': { name: 'سینا', color: '#20418A' },
  '639607': { name: 'سرمایه', color: '#4F5B93' },
  '636214': { name: 'بانک آینده', color: '#B48F3C' },
  '502806': { name: 'شهر', color: '#D0212A' },
  '504706': { name: 'شهر', color: '#D0212A' },
  '502938': { name: 'دی', color: '#1F8A70' },
  '603769': { name: 'صادرات', color: '#1D3E8C' },
  '610433': { name: 'ملت', color: '#D6203A' },
  '991975': { name: 'ملت', color: '#D6203A' },
  '585983': { name: 'تجارت', color: '#1F3F8F' },
  '627353': { name: 'تجارت', color: '#1F3F8F' },
  '589463': { name: 'رفاه', color: '#1B5FAA' },
  '627381': { name: 'انصار', color: '#C6941C' },
  '639370': { name: 'مهر اقتصاد', color: '#0C7F5F' },
  '606373': { name: 'قرض‌الحسنه مهر ایران', color: '#0C7F5F' },
  '505785': { name: 'ایران زمین', color: '#6B2C91' },
  '585947': { name: 'خاورمیانه', color: '#2A2D5A' },
  '507677': { name: 'نور', color: '#1D6FB8' },
  '504172': { name: 'رسالت', color: '#0A7ABF' },
  '639599': { name: 'قوامین', color: '#0F6B3A' },
  '636795': { name: 'مرکزی', color: '#1D4C8F' },
  '627593': { name: 'ملل', color: '#0F8A5F' },
  '606256': { name: 'ملل', color: '#0F8A5F' },
  '639342': { name: 'گردشگری', color: '#B0452F' },
  '505416': { name: 'گردشگری', color: '#B0452F' },
  '581874': { name: 'ایران ونزوئلا', color: '#2E7D32' },
};

export function detectBank(card: string): { name: string; color: string } | null {
  const bin = normalizeCardNumber(card).slice(0, 6);
  return BINS[bin] ?? null;
}
