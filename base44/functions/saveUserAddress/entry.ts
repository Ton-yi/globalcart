/**
 * saveUserAddress
 *
 * Appends one or more addresses to the current user's UserPreference.saved_addresses.
 * Creates the UserPreference record if it doesn't exist.
 * Merges and deduplicates across all UserPreference records for the user.
 * Never trusts tenant_id from the client.
 *
 * Payload: { addresses: Array<{ id, label, full_text, recipient_name, country, addr1, addr2, addr3, state, phone }> }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { addresses: newAddresses = [] } = body;

    if (!Array.isArray(newAddresses) || newAddresses.length === 0) {
      return Response.json({ error: 'addresses array is required' }, { status: 400 });
    }

    // Resolve tenant_id from session
    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = userRecords?.[0];
    if (!userRecord) return Response.json({ error: 'User record not found' }, { status: 404 });
    const tenantId = userRecord.tenant_id || null;

    // Load ALL UserPreference records for this user (may have legacy records without tenant_id)
    const allPrefs = await base44.asServiceRole.entities.UserPreference.filter({ user_email: user.email });

    // Merge all existing addresses (deduplicate by id)
    const seenIds = new Set();
    const mergedAddrs = allPrefs
      .flatMap(r => r.saved_addresses || [])
      .filter(a => { if (!a.id || seenIds.has(a.id)) return false; seenIds.add(a.id); return true; });

    // Append new addresses (skip if id already exists)
    const toAdd = newAddresses.filter(a => a.id && !seenIds.has(a.id));
    const finalAddrs = [...mergedAddrs, ...toAdd];

    if (allPrefs.length === 0) {
      // Create a new canonical record
      await base44.asServiceRole.entities.UserPreference.create({
        user_email: user.email,
        tenant_id: tenantId,
        saved_addresses: finalAddrs,
      });
    } else {
      // Sort by updated_date desc — use the most recently updated as canonical
      const sorted = [...allPrefs].sort((a, b) =>
        new Date(b.updated_date || 0) - new Date(a.updated_date || 0)
      );
      const primary = sorted[0];

      // Update canonical record (ensure tenant_id is set)
      await base44.asServiceRole.entities.UserPreference.update(primary.id, {
        saved_addresses: finalAddrs,
        tenant_id: tenantId,
      });

      // Clean up duplicate records
      for (const dup of sorted.slice(1)) {
        await base44.asServiceRole.entities.UserPreference.delete(dup.id);
      }
    }

    return Response.json({ success: true, added: toAdd.length });
  } catch (error) {
    console.error('saveUserAddress error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});