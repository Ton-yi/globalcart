const SUPPORTED_LOCALE_CODES = ['ja', 'zhcn', 'zhtw', 'en', 'ko', 'ms'];
const DEFAULT_LOCALE = 'ja';

export function getCurrentLocale(): string {
    const seg = window.location.pathname.split('/')[1];
    if (SUPPORTED_LOCALE_CODES.includes(seg)) return seg;
    const saved = localStorage.getItem('preferred_locale');
    return saved && SUPPORTED_LOCALE_CODES.includes(saved) ? saved : DEFAULT_LOCALE;
}

export function createPageUrl(pageName: string) {
    return `/${getCurrentLocale()}/${pageName.replace(/ /g, '-')}`;
}