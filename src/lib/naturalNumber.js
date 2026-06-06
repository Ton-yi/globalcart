/**
 * Parses a Chinese number string like "一百五十" → 150, "三千五百" → 3500
 */
function parseChinese(s) {
  s = s.replace(/\s/g, '').replace(/两/g, '二');
  if (!s) return null;

  const digits = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
  const units  = { '十':10,'百':100,'千':1000,'万':10000 };

  let result  = 0;
  let section = 0;
  let current = 0;
  let hasDigit = false;

  for (const ch of s) {
    if (digits[ch] !== undefined) {
      current = digits[ch];
      hasDigit = true;
    } else if (units[ch] !== undefined) {
      const unit = units[ch];
      if (unit === 10000) {
        result += (section + current) * unit;
        section = 0;
        current = 0;
      } else {
        if (unit === 10 && current === 0 && !hasDigit) current = 1; // 十 alone → 10
        section += current * unit;
        current = 0;
      }
      hasDigit = false;
    } else {
      return null; // contains non-Chinese-number char
    }
  }
  result += section + current;
  return result > 0 ? result : null;
}

/**
 * Parses an English number string like "one hundred twenty" → 120, "two thousand" → 2000
 */
function parseEnglish(s) {
  s = s.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;

  const ones = {
    zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
    ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
    seventeen:17,eighteen:18,nineteen:19,
    twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90,
  };

  const words = s.split(/[\s-]+/);
  let total = 0;
  let current = 0;

  for (const w of words) {
    if (w === 'and') continue;
    if (ones[w] !== undefined) {
      current += ones[w];
    } else if (w === 'hundred') {
      current = (current || 1) * 100;
    } else if (w === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
    } else if (w === 'million') {
      total += (current || 1) * 1000000;
      current = 0;
    } else {
      return null; // unknown word
    }
  }
  const n = total + current;
  return n > 0 ? n : null;
}

/**
 * Parses a natural-language price expression (Chinese or English) and returns
 * a rounded integer, or null if it cannot be parsed.
 *
 * Examples:
 *   "一百加五百"       → 600
 *   "三千五百"         → 3500
 *   "one hundred plus twenty" → 120
 *   "500+500"          → 1000  (pure arithmetic still works)
 *   "15000"            → 15000
 */
export function parseNaturalPrice(raw) {
  let s = raw.trim()
    // Chinese operators
    .replace(/除以|÷/g, '/')
    .replace(/乘以|×/g, '*')
    .replace(/减去|减/g, '-')
    .replace(/加上|加/g, '+')
    // English operators
    .replace(/\bdivided\s+by\b/gi, '/')
    .replace(/\bmultiplied\s+by\b|\btimes\b/gi, '*')
    .replace(/\bminus\b|\bsubtract\b/gi, '-')
    .replace(/\bplus\b|\badd\b/gi, '+');

  // Split on arithmetic operators while keeping them
  const parts = s.split(/([+\-*/])/).map(t => t.trim());

  const resolved = parts.map(t => {
    if (['+', '-', '*', '/'].includes(t)) return t;
    if (!t) return '';
    // Plain number (possibly with commas)
    const plain = parseFloat(t.replace(/,/g, ''));
    if (!isNaN(plain)) return String(plain);
    // Chinese natural number
    const cn = parseChinese(t);
    if (cn !== null) return String(cn);
    // English natural number
    const en = parseEnglish(t);
    if (en !== null) return String(en);
    return t; // leave as-is; will likely fail eval
  });

  const expr = resolved.join('');
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === 'number' && isFinite(result) && result > 0) {
      return Math.round(result);
    }
  } catch (_) {}
  return null;
}