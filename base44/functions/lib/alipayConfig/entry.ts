/**
 * Shared Alipay config resolver — multi-tenant aware.
 * 
 * Priority:
 *   1. Tenant-specific keys stored in SiteSettings (category: "alipay_keys")
 *   2. Platform-level environment variables (ALIPAY_*)
 * 
 * Keys stored in SiteSettings:
 *   alipay_key_app_id       — Alipay App ID
 *   alipay_key_private_key  — RSA2 private key (PKCS8 PEM)
 *   alipay_key_public_key   — Alipay public key (for callback verification)
 *   alipay_key_gateway_url  — Gateway URL (optional, defaults to production)
 */

export async function getAlipayConfig(base44, tenantId) {
  let settings = [];
  if (tenantId) {
    settings = await base44.asServiceRole.entities.SiteSettings.filter({
      tenant_id: tenantId,
    });
  }

  const map = {};
  (settings || []).forEach(s => { map[s.key] = s.value; });

  const appId      = map['alipay_key_app_id']      || Deno.env.get('ALIPAY_APP_ID')      || '';
  const privateKey = map['alipay_key_private_key']  || Deno.env.get('ALIPAY_PRIVATE_KEY') || '';
  const publicKey  = map['alipay_key_public_key']   || Deno.env.get('ALIPAY_PUBLIC_KEY')  || '';
  const gatewayUrl = map['alipay_key_gateway_url']  || Deno.env.get('ALIPAY_GATEWAY_URL') || 'https://openapi.alipay.com/gateway.do';

  return { appId, privateKey, publicKey, gatewayUrl };
}