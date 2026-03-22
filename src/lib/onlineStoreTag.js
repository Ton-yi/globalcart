/**
 * Online Store Tag Recognition
 * Matches product URLs against configured rules to assign store tags.
 * Rules are fetched via tenant-safe backend function.
 */

export async function getOnlineStoreRules() {
  try {
    const { base44 } = await import('@/api/base44Client');
    // Use tenant-safe config endpoint
    const res = await base44.functions.invoke('getTenantConfigData', {});
    const rules = res.data?.storeTagRules || [];
    return rules
      .filter(r => r.is_active !== false)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  } catch {
    return [];
  }
}

export function matchStoreTagResult(url, rules) {
  if (!url || !rules || rules.length === 0) return { tag_label: "其它", tag_color: "bg-gray-100 text-gray-700" };
  const urlLower = url.toLowerCase();
  for (const rule of rules) {
    const keyword = (rule.keyword || "").toLowerCase();
    if (keyword && urlLower.includes(keyword)) {
      return { tag_label: rule.tag_label || "其它", tag_color: rule.tag_color || "bg-gray-100 text-gray-700" };
    }
  }
  return { tag_label: "其它", tag_color: "bg-gray-100 text-gray-700" };
}

export function matchStoreTag(url, rules) {
  return matchStoreTagResult(url, rules).tag_label;
}

export async function detectStoreTagResult(url) {
  const rules = await getOnlineStoreRules();
  return matchStoreTagResult(url, rules);
}

export async function detectStoreTag(url) {
  const rules = await getOnlineStoreRules();
  return matchStoreTag(url, rules);
}

// Detect tag for the first URL (primary tag for order) - returns { tag_label, tag_color }
export async function detectPrimaryStoreTagResult(urlsString) {
  if (!urlsString || typeof urlsString !== 'string') return { tag_label: "其它", tag_color: "bg-gray-100 text-gray-700" };
  const urls = urlsString.split('\n').map(s => s.trim()).filter(Boolean);
  if (urls.length === 0) return { tag_label: "其它", tag_color: "bg-gray-100 text-gray-700" };
  return detectStoreTagResult(urls[0]);
}

export async function detectPrimaryStoreTag(urlsString) {
  const result = await detectPrimaryStoreTagResult(urlsString);
  return result.tag_label;
}