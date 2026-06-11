import { Globe, ChevronDown } from 'lucide-react';
import { useLocale, SUPPORTED_LOCALES } from '@/lib/LocaleContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function LocaleSwitcher() {
  const { locale, changeLocale, locales } = useLocale();
  const currentLocale = locales.find(l => l.code === locale) || locales[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{currentLocale.flag} {currentLocale.label}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {SUPPORTED_LOCALES.map((loc) => (
          <DropdownMenuItem
            key={loc.code}
            onClick={() => changeLocale(loc.code)}
            className={`flex items-center gap-2 cursor-pointer ${
              locale === loc.code ? 'bg-gray-100 font-semibold' : ''
            }`}
          >
            <span className="text-base">{loc.flag}</span>
            <span className="text-sm">{loc.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}