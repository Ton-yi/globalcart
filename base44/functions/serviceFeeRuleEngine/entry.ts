/**
 * 服务费规则引擎 — 后端统一计算入口
 * 
 * 支持操作：
 * - evaluate: 计算指定规则（或自动选取活跃规则）的服务费
 * - list_rules: 列出当前租户所有规则
 * - save_rule: 创建/更新规则（含版本快照）
 * - delete_rule: 删除规则
 * - validate_formula: 验证公式合法性
 * - apply_to_order: 计算并将服务费快照写入订单
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── 白名单常量（与前端同步） ────────────────────────────────────────────────────
const ALLOWED_VARIABLES = [
  'goodsAmount', 'orderAmount', 'itemCount', 'sourceSite', 'customerLevel',
  'customerTags', 'currency', 'country', 'shippingMethod', 'hasTransit',
  'weight', 'storageSize', 'storageDays', 'valueAddedServiceAmount',
];

const ALLOWED_FUNCTIONS = new Set([
  'if', 'min', 'max', 'clamp', 'round', 'ceil', 'floor',
  'roundTo', 'ceilTo', 'floorTo', 'abs',
]);

// ─── Tokenizer ────────────────────────────────────────────────────────────────
const TT = {
  NUMBER: 'NUMBER', STRING: 'STRING', PERCENT: 'PERCENT', IDENT: 'IDENT',
  LPAREN: 'LPAREN', RPAREN: 'RPAREN', COMMA: 'COMMA',
  PLUS: 'PLUS', MINUS: 'MINUS', STAR: 'STAR', SLASH: 'SLASH',
  GT: 'GT', GTE: 'GTE', LT: 'LT', LTE: 'LTE', EQ: 'EQ', NEQ: 'NEQ',
  AND: 'AND', OR: 'OR', NOT: 'NOT', IN: 'IN', CONTAINS: 'CONTAINS',
  EOF: 'EOF',
};

function tokenize(input) {
  if (!input || typeof input !== 'string') throw new Error('公式不能为空');
  if (input.length > 500) throw new Error('公式过长（最大500字符）');
  const tokens = [];
  let i = 0;
  const src = input.trim();
  while (i < src.length) {
    if (/\s/.test(src[i])) { i++; continue; }
    if (/[0-9]/.test(src[i]) || (src[i] === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      if (src[i] === '%') { i++; tokens.push({ type: TT.NUMBER, value: parseFloat(num) / 100 }); }
      else tokens.push({ type: TT.NUMBER, value: parseFloat(num) });
      continue;
    }
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i++]; let str = '';
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; str += src[i++]; }
      if (src[i] !== q) throw new Error('字符串未闭合');
      i++; tokens.push({ type: TT.STRING, value: str }); continue;
    }
    if (/[a-zA-Z_]/.test(src[i])) {
      let id = '';
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) id += src[i++];
      const lc = id.toLowerCase();
      if (lc === 'and') tokens.push({ type: TT.AND });
      else if (lc === 'or') tokens.push({ type: TT.OR });
      else if (lc === 'not') tokens.push({ type: TT.NOT });
      else if (lc === 'in') tokens.push({ type: TT.IN });
      else if (lc === 'contains') tokens.push({ type: TT.CONTAINS });
      else if (lc === 'true') tokens.push({ type: TT.NUMBER, value: 1 });
      else if (lc === 'false') tokens.push({ type: TT.NUMBER, value: 0 });
      else tokens.push({ type: TT.IDENT, value: id });
      continue;
    }
    if (src[i] === '>' && src[i+1] === '=') { tokens.push({ type: TT.GTE }); i += 2; continue; }
    if (src[i] === '<' && src[i+1] === '=') { tokens.push({ type: TT.LTE }); i += 2; continue; }
    if (src[i] === '=' && src[i+1] === '=') { tokens.push({ type: TT.EQ }); i += 2; continue; }
    if (src[i] === '!' && src[i+1] === '=') { tokens.push({ type: TT.NEQ }); i += 2; continue; }
    const single = { '>': TT.GT, '<': TT.LT, '+': TT.PLUS, '-': TT.MINUS, '*': TT.STAR,
      '/': TT.SLASH, '(': TT.LPAREN, ')': TT.RPAREN, ',': TT.COMMA, '%': TT.PERCENT };
    if (single[src[i]]) { tokens.push({ type: single[src[i]] }); i++; continue; }
    throw new Error(`非法字符: ${src[i]} (位置 ${i})`);
  }
  tokens.push({ type: TT.EOF });
  return tokens;
}

// ─── Parser ───────────────────────────────────────────────────────────────────
class Parser {
  constructor(tokens, vars) { this.tokens = tokens; this.pos = 0; this._vars = vars; this.steps = []; }
  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }
  expect(type) { const t = this.consume(); if (t.type !== type) throw new Error(`期望 ${type}，得到 ${t.type}`); return t; }

  parse(depth = 0) {
    if (depth > 20) throw new Error('公式嵌套过深');
    return this.parseOr(depth);
  }
  parseOr(d) {
    let l = this.parseAnd(d);
    while (this.peek().type === TT.OR) { this.consume(); const r = this.parseAnd(d); l = (l || r) ? 1 : 0; }
    return l;
  }
  parseAnd(d) {
    let l = this.parseNot(d);
    while (this.peek().type === TT.AND) { this.consume(); const r = this.parseNot(d); l = (l && r) ? 1 : 0; }
    return l;
  }
  parseNot(d) {
    if (this.peek().type === TT.NOT) { this.consume(); return this.parseCmp(d) ? 0 : 1; }
    return this.parseCmp(d);
  }
  parseCmp(d) {
    let l = this.parseAdd(d);
    const t = this.peek();
    const cmpMap = { [TT.GT]: (a,b) => a>b, [TT.GTE]: (a,b) => a>=b, [TT.LT]: (a,b) => a<b, [TT.LTE]: (a,b) => a<=b, [TT.EQ]: (a,b) => a==b, [TT.NEQ]: (a,b) => a!=b }; // eslint-disable-line eqeqeq
    if (cmpMap[t.type]) { this.consume(); const r = this.parseAdd(d); return cmpMap[t.type](l,r) ? 1 : 0; }
    if (t.type === TT.IN) {
      this.consume(); this.expect(TT.LPAREN);
      const opts = [this.parseAdd(d)];
      while (this.peek().type === TT.COMMA) { this.consume(); opts.push(this.parseAdd(d)); }
      this.expect(TT.RPAREN); return opts.includes(l) ? 1 : 0;
    }
    if (t.type === TT.CONTAINS) { this.consume(); const r = this.parseAdd(d); return String(l).includes(String(r)) ? 1 : 0; }
    return l;
  }
  parseAdd(d) {
    let l = this.parseMul(d);
    while (true) {
      if (this.peek().type === TT.PLUS) { this.consume(); l += this.parseMul(d); }
      else if (this.peek().type === TT.MINUS) { this.consume(); l -= this.parseMul(d); }
      else break;
    }
    return l;
  }
  parseMul(d) {
    let l = this.parseUnary(d);
    while (true) {
      if (this.peek().type === TT.STAR) { this.consume(); l *= this.parseUnary(d); }
      else if (this.peek().type === TT.SLASH) { this.consume(); const r = this.parseUnary(d); if (r === 0) throw new Error('除以零'); l /= r; }
      else if (this.peek().type === TT.PERCENT) { this.consume(); l /= 100; }
      else break;
    }
    return l;
  }
  parseUnary(d) {
    if (this.peek().type === TT.MINUS) { this.consume(); return -this.parsePrimary(d); }
    return this.parsePrimary(d);
  }
  parsePrimary(d) {
    const t = this.peek();
    if (t.type === TT.NUMBER) { this.consume(); return t.value; }
    if (t.type === TT.STRING) { this.consume(); return t.value; }
    if (t.type === TT.LPAREN) { this.consume(); const v = this.parse(d+1); this.expect(TT.RPAREN); return v; }
    if (t.type === TT.IDENT) {
      const name = t.value; this.consume();
      if (this.peek().type === TT.LPAREN) {
        if (!ALLOWED_FUNCTIONS.has(name)) throw new Error(`不支持的函数: ${name}`);
        this.consume();
        const args = [];
        if (this.peek().type !== TT.RPAREN) {
          args.push(this.parse(d+1));
          while (this.peek().type === TT.COMMA) { this.consume(); args.push(this.parse(d+1)); }
        }
        this.expect(TT.RPAREN);
        const fns = {
          if: (c,t,f) => (c ? t : f), min: Math.min, max: Math.max,
          clamp: (v,lo,hi) => Math.min(Math.max(v,lo),hi),
          round: Math.round, ceil: Math.ceil, floor: Math.floor,
          roundTo: (v,u) => Math.round(v/u)*u, ceilTo: (v,u) => Math.ceil(v/u)*u,
          floorTo: (v,u) => Math.floor(v/u)*u, abs: Math.abs,
        };
        const result = fns[name](...args);
        this.steps.push(`${name}(${args.map(a => typeof a === 'string' ? `"${a}"` : a).join(', ')}) = ${result}`);
        return result;
      }
      if (!ALLOWED_VARIABLES.includes(name)) throw new Error(`不支持的变量: ${name}`);
      const val = this._vars[name];
      return val !== undefined && val !== null ? val : 0;
    }
    throw new Error(`意外的token: ${t.type} 位置 ${this.pos}`);
  }
}

// ─── 计算服务费 ────────────────────────────────────────────────────────────────
function calcFee(rule, variables) {
  const steps = [];
  try {
    const vars = { ...variables };
    if (typeof vars.hasTransit === 'boolean') vars.hasTransit = vars.hasTransit ? 1 : 0;
    let baseFee = 0;

    if (rule.mode === 'simple') {
      const rate = (parseFloat(rule.simple_rate) || 0) / 100;
      baseFee = (parseFloat(vars.goodsAmount) || 0) * rate;
      steps.push(`简单比例: ¥${vars.goodsAmount} × ${rule.simple_rate}% = ¥${baseFee}`);

    } else if (rule.mode === 'tiered') {
      const amount = parseFloat(vars.goodsAmount) || 0;
      const tiers = rule.tiered_config || [];
      let matched = false;
      for (const tier of tiers) {
        const from = parseFloat(tier.from) || 0;
        const toVal = tier.to !== null && tier.to !== undefined ? parseFloat(tier.to) : Infinity;
        if (amount >= from && amount < toVal) {
          const rate = (parseFloat(tier.rate) || 0) / 100;
          const fixed = parseFloat(tier.fixed_fee) || 0;
          baseFee = amount * rate + fixed;
          steps.push(`阶梯命中: ¥${from}~${tier.to ?? '∞'}, ${tier.rate}% + 固定¥${fixed} = ¥${baseFee}`);
          matched = true; break;
        }
      }
      if (!matched) steps.push('未命中任何阶梯，服务费为0');

    } else if (rule.mode === 'formula') {
      const formula = rule.formula || '';
      if (!formula.trim()) throw new Error('公式为空');
      const tokens = tokenize(formula);
      const parser = new Parser(tokens, vars);
      baseFee = parser.parse(0);
      if (parser.peek().type !== TT.EOF) throw new Error('公式末尾有多余内容');
      steps.push(...parser.steps);
      steps.push(`公式结果: ¥${baseFee}`);
    }

    // min/max
    const minFee = parseFloat(rule.min_fee) || 0;
    const maxFee = parseFloat(rule.max_fee) || 0;
    if (minFee > 0 && baseFee < minFee) { steps.push(`最低限制: ¥${baseFee} → ¥${minFee}`); baseFee = minFee; }
    if (maxFee > 0 && baseFee > maxFee) { steps.push(`封顶限制: ¥${baseFee} → ¥${maxFee}`); baseFee = maxFee; }

    // round
    const unit = parseFloat(rule.round_unit) || 1;
    const before = baseFee;
    const rm = rule.round_mode || 'round';
    if (rm === 'round') baseFee = Math.round(baseFee / unit) * unit;
    else if (rm === 'ceil') baseFee = Math.ceil(baseFee / unit) * unit;
    else if (rm === 'floor') baseFee = Math.floor(baseFee / unit) * unit;
    if (rm !== 'none' && before !== baseFee) steps.push(`取整(${rm}, 单位${unit}): ¥${before} → ¥${baseFee}`);

    return { fee: Math.max(0, baseFee), steps, error: null };
  } catch (err) {
    return { fee: 0, steps, error: err.message };
  }
}

// ─── 验证公式 ─────────────────────────────────────────────────────────────────
function validateFormula(formula) {
  try {
    const tokens = tokenize(formula);
    const dv = {};
    ALLOWED_VARIABLES.forEach(v => { dv[v] = 0; });
    dv.sourceSite = 'test'; dv.customerLevel = 'regular'; dv.currency = 'JPY';
    dv.country = 'CN'; dv.shippingMethod = 'EMS'; dv.storageSize = 'small';
    const parser = new Parser(tokens, dv);
    parser.parse(0);
    if (parser.peek().type !== TT.EOF) return { valid: false, error: '公式末尾有多余内容' };
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

// ─── 选取活跃规则 ─────────────────────────────────────────────────────────────
function pickActiveRule(rules) {
  const now = new Date().toISOString().slice(0, 10);
  return rules
    .filter(r => r.status === 'active')
    .filter(r => !r.effective_from || r.effective_from <= now)
    .filter(r => !r.effective_until || r.effective_until >= now)
    .sort((a, b) => (parseFloat(b.priority) || 0) - (parseFloat(a.priority) || 0))[0] || null;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userRecords = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const userRecord = userRecords?.[0];
    const tenantId = userRecord?.tenant_id;
    const isAdmin = user.role === 'admin' || user.role === 'platform_admin' || user.role === 'staff' || user.role === 'tenant_admin';

    if (!tenantId && user.role !== 'platform_admin') {
      return Response.json({ error: 'No tenant' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // ── list_rules ─────────────────────────────────────────────────────────────
    if (action === 'list_rules') {
      const rules = await base44.asServiceRole.entities.ServiceFeeRule.filter({ tenant_id: tenantId });
      return Response.json({ rules: (rules || []).filter(r => !r.is_archived) });
    }

    // ── list_member_tiers ──────────────────────────────────────────────────────
    if (action === 'list_member_tiers') {
      const tiers = await base44.asServiceRole.entities.MemberTier.filter({ tenant_id: tenantId });
      return Response.json({ tiers: (tiers || []).filter(t => t.is_active !== false) });
    }

    // ── list_roles ─────────────────────────────────────────────────────────────
    if (action === 'list_roles') {
      const roles = await base44.asServiceRole.entities.Role.filter({ tenant_id: tenantId });
      return Response.json({ roles: (roles || []).filter(r => !r.is_archived && !r.is_global) });
    }

    // ── list_store_tags ────────────────────────────────────────────────────────
    if (action === 'list_store_tags') {
      const tags = await base44.asServiceRole.entities.OnlineStoreTagRule.filter({ tenant_id: tenantId });
      const active = (tags || []).filter(t => t.is_active !== false).sort((a, b) => (parseFloat(b.priority) || 0) - (parseFloat(a.priority) || 0));
      return Response.json({ tags: active });
    }

    // ── get_active_rule ────────────────────────────────────────────────────────
    if (action === 'get_active_rule') {
      const rules = await base44.asServiceRole.entities.ServiceFeeRule.filter({ tenant_id: tenantId });
      const active = pickActiveRule(rules || []);
      return Response.json({ rule: active });
    }

    // ── validate_formula ───────────────────────────────────────────────────────
    if (action === 'validate_formula') {
      const result = validateFormula(body.formula || '');
      return Response.json(result);
    }

    // ── evaluate ───────────────────────────────────────────────────────────────
    if (action === 'evaluate') {
      let rule = body.rule;
      if (!rule && body.rule_id) {
        const found = await base44.asServiceRole.entities.ServiceFeeRule.filter({ id: body.rule_id });
        rule = found?.[0];
      }
      if (!rule) {
        // pick active rule for tenant
        const rules = await base44.asServiceRole.entities.ServiceFeeRule.filter({ tenant_id: tenantId });
        rule = pickActiveRule(rules || []);
      }
      if (!rule) {
        // Fallback: use site settings service_fee_rate
        const settings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId });
        const smap = {};
        (settings || []).forEach(s => { smap[s.key] = s.value; });
        const rate = parseFloat(smap.service_fee_rate) || 10;
        const amount = parseFloat(body.variables?.goodsAmount) || 0;
        const fee = Math.round(amount * rate / 100);
        return Response.json({ fee, steps: [`默认费率: ¥${amount} × ${rate}% = ¥${fee}`], rule_id: null, rule_name: '默认费率', error: null });
      }
      // Tenant check
      if (rule.tenant_id && rule.tenant_id !== tenantId && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const result = calcFee(rule, body.variables || {});
      return Response.json({ ...result, rule_id: rule.id, rule_name: rule.name, rule_version: rule.version });
    }

    // ── apply_to_order ─────────────────────────────────────────────────────────
    // Compute and snapshot service fee onto an order
    if (action === 'apply_to_order') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { order_id, variables } = body;
      if (!order_id) return Response.json({ error: 'Missing order_id' }, { status: 400 });

      // Fetch order
      const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id });
      const order = orders?.[0];
      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 });
      if (order.tenant_id !== tenantId && user.role !== 'platform_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }

      const rules = await base44.asServiceRole.entities.ServiceFeeRule.filter({ tenant_id: tenantId });
      const rule = pickActiveRule(rules || []);

      const vars = variables || {
        goodsAmount: parseFloat(order.estimated_jpy) || 0,
        orderAmount: parseFloat(order.estimated_jpy) || 0,
        itemCount: parseFloat(order.quantity) || 1,
        sourceSite: order.online_store_tag || '其它',
        valueAddedServiceAmount: (order.selected_addons || []).reduce((s, a) => s + (parseFloat(a.fee) || 0), 0),
      };

      let fee, steps, ruleName, ruleId, ruleVersion, formulaSnapshot;

      if (rule) {
        const result = calcFee(rule, vars);
        fee = result.fee; steps = result.steps;
        ruleId = rule.id; ruleVersion = rule.version; ruleName = rule.name;
        formulaSnapshot = rule.formula || JSON.stringify(rule.tiered_config || rule.simple_rate);
      } else {
        const settings = await base44.asServiceRole.entities.SiteSettings.filter({ tenant_id: tenantId });
        const smap = {};
        (settings || []).forEach(s => { smap[s.key] = s.value; });
        const rate = parseFloat(smap.service_fee_rate) || 10;
        fee = Math.round((parseFloat(vars.goodsAmount) || 0) * rate / 100);
        steps = [`默认费率: ¥${vars.goodsAmount} × ${rate}% = ¥${fee}`];
        ruleId = null; ruleVersion = null; ruleName = '默认费率';
        formulaSnapshot = `goodsAmount * ${rate}%`;
      }

      // Write snapshot to order
      const snapshot = {
        service_fee_rule_id: ruleId,
        service_fee_rule_version: ruleVersion,
        formula_snapshot: formulaSnapshot,
        input_variables_snapshot: JSON.stringify(vars),
        service_fee_amount: fee,
        calculation_steps: JSON.stringify(steps),
        calculated_at: new Date().toISOString(),
        service_fee_rule_name: ruleName,
      };
      await base44.asServiceRole.entities.Order.update(order_id, snapshot);
      return Response.json({ success: true, fee, steps, rule_name: ruleName });
    }

    // ── save_rule ─────────────────────────────────────────────────────────────
    if (action === 'save_rule') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { rule } = body;
      if (!rule?.name || !rule?.mode) return Response.json({ error: '缺少必填字段' }, { status: 400 });

      // Validate formula before saving as active
      if (rule.mode === 'formula' && rule.formula) {
        const v = validateFormula(rule.formula);
        if (!v.valid && rule.status === 'active') {
          return Response.json({ error: `公式错误，无法保存为启用状态: ${v.error}` }, { status: 400 });
        }
      }

      // Build snapshot
      const configSnapshot = JSON.stringify({
        mode: rule.mode, formula: rule.formula, simple_rate: rule.simple_rate,
        tiered_config: rule.tiered_config, min_fee: rule.min_fee, max_fee: rule.max_fee,
        round_mode: rule.round_mode, round_unit: rule.round_unit,
      });

      if (rule.id) {
        // Update existing — bump version
        const existing = await base44.asServiceRole.entities.ServiceFeeRule.filter({ id: rule.id });
        const cur = existing?.[0];
        if (!cur) return Response.json({ error: 'Rule not found' }, { status: 404 });
        if (cur.tenant_id !== tenantId && user.role !== 'platform_admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

        const newVersion = (parseFloat(cur.version) || 1) + 1;
        const { id, ...updates } = rule;
        const saved = await base44.asServiceRole.entities.ServiceFeeRule.update(rule.id, {
          ...updates,
          tenant_id: tenantId,
          version: newVersion,
          formula_snapshot: rule.formula || configSnapshot,
          config_snapshot: configSnapshot,
        });
        return Response.json({ success: true, rule: saved });
      } else {
        // Create new
        delete rule.id;
        const saved = await base44.asServiceRole.entities.ServiceFeeRule.create({
          ...rule,
          tenant_id: tenantId,
          version: 1,
          formula_snapshot: rule.formula || configSnapshot,
          config_snapshot: configSnapshot,
        });
        return Response.json({ success: true, rule: saved });
      }
    }

    // ── delete_rule ───────────────────────────────────────────────────────────
    if (action === 'delete_rule') {
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const { rule_id } = body;
      const existing = await base44.asServiceRole.entities.ServiceFeeRule.filter({ id: rule_id });
      const cur = existing?.[0];
      if (!cur) return Response.json({ error: 'Not found' }, { status: 404 });
      if (cur.tenant_id !== tenantId && user.role !== 'platform_admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      // Soft delete
      await base44.asServiceRole.entities.ServiceFeeRule.update(rule_id, { is_archived: true, status: 'inactive' });
      return Response.json({ success: true });
    }

    return Response.json({ error: `未知操作: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('serviceFeeRuleEngine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});