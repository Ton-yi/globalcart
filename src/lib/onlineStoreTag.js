/**
 * Online Store Tag Recognition
 * Matches product URLs against configured rules to assign store tags
 */

export async function getOnlineStoreRules() {
  try {
    const { base44 } = await import('@/api/base44Client');
    const rules = await base44.entities.OnlineStoreTagRule.filter({ is_active: true }, "-priority", 100);
    return rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  } catch {
    return [];
  }
}

export function matchStoreTag(url, rules) {
  if (!url || !rules || rules.length === 0) return "其它";
  
  const urlLower = url.toLowerCase();
  
  for (const rule of rules) {
    const keyword = (rule.keyword || "").toLowerCase();
    if (keyword && urlLower.includes(keyword)) {
      return rule.tag_label || "其它";
    }
  }
  
  return "其它";
}

export async function detectStoreTag(url) {
  const rules = await getOnlineStoreRules();
  return matchStoreTag(url, rules);
}

// Detect tag for the first URL (primary tag for order)
export async function detectPrimaryStoreTag(urlsString) {
  if (!urlsString || typeof urlsString !== 'string') return "其它";
  
  const urls = urlsString.split('\n').map(s => s.trim()).filter(Boolean);
  if (urls.length === 0) return "其它";
  
  return detectStoreTag(urls[0]);
}