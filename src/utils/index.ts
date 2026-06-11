export function createPageUrl(pageName: string) {
    const locale = window.location.pathname.split('/')[1] || 'ja';
    return `/${locale}/${pageName.replace(/ /g, '-')}`;
}