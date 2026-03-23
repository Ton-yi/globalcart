import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Allow both admin and non-admin (for frontend to fetch rates)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch live rates from exchangerate-api
    const response = await fetch('https://v6.exchangerate-api.com/v6/89e2f91c758d92aa2c06667b/latest/JPY');
    
    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch exchange rates' }, { status: 500 });
    }

    const data = await response.json();
    
    if (data.result !== 'success') {
      return Response.json({ error: 'API returned error: ' + data['error-type'] }, { status: 500 });
    }

    const rates = {
      jpy_usd: data.conversion_rates?.USD || 0.0067,
      jpy_cny: data.conversion_rates?.CNY || 0.048,
      jpy_eur: data.conversion_rates?.EUR || 0.0062,
      jpy_gbp: data.conversion_rates?.GBP || 0.0050,
      jpy_aud: data.conversion_rates?.AUD || 0.0104,
      jpy_sgd: data.conversion_rates?.SGD || 0.0090,
      jpy_hkd: data.conversion_rates?.HKD || 0.052,
      jpy_twd: data.conversion_rates?.TWD || 0.22,
      timestamp: new Date().toISOString()
    };

    return Response.json(rates);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});