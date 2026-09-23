import { format, formatDistanceToNowStrict, parseISO } from 'date-fns-jalali';
import { faIR } from 'date-fns-jalali/locale';
import { toPersianDigits } from '@dong/core';

export const fmtDate = (iso: string, f = 'd MMMM') => toPersianDigits(format(parseISO(iso), f, { locale: faIR }));
export const fmtDateTime = (iso: string) => toPersianDigits(format(parseISO(iso), 'd MMMM yyyy، HH:mm', { locale: faIR }));
export const fmtAgo = (iso: string) => toPersianDigits(formatDistanceToNowStrict(parseISO(iso), { locale: faIR, addSuffix: true }));
export const todayISO = () => new Date().toISOString();
export const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
