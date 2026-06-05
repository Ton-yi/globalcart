/**
 * 服务费规则引擎 — 前端安全公式解析器
 * 
 * 安全设计：
 * - 不使用 eval / Function / new Function
 * - 手写 tokenizer + recursive descent parser
 * - 只允许白名单变量、函数、运算符
 * - 使用整数运算（JPY×100）避免浮点误差
 */

// ─── 白名单变量 ───────────────────────────────────────────────────────────────
export const ALLOWED_VARIABLES = [
  'goodsAmount',       // 商品货款 (JPY) — 下单阶段主要基数
  'orderAmount',       // 订单总金额（含服务费前）
  'itemCount',         // 商品数量
  'sourceSite',        // 下单网站标签（字符串）
  'customerLevel',     // 客户等级（字符串）
  'customerTags',      // 客户标签（字符串数组，用逗号分隔字符串表示）
  'currency',          // 结算币种
  'country',           // 收货国家
  'shippingMethod',    // 发货方式
  'hasTransit',        // 是否使用中转地（true/false）
  'weight',            // 重量(g)
  'storageSize',       // 入库尺寸（字符串，物品尺寸模板标题）
  'storageDays',       // 仓储天数
  'shippingFee',       // 实际国际运费 (JPY) — 发货阶段主要基数
  'valueAddedServiceAmount', // 增值服务金额 (JPY)
];

// ─── 变量中文名 ────────────────────────────────────────────────────────────────
export const VARIABLE_LABELS = {
  goodsAmount: '商品货款 (JPY)',
  orderAmount: '订单金额 (JPY)',
  itemCount: '商品数量',
  sourceSite: '下单网站',
  customerLevel: '客户等级',
  customerTags: '客户标签',
  currency: '结算币种',
  country: '收货国家',
  shippingMethod: '发货方式',
  hasTransit: '是否使用中转',
  weight: '重量 (g)',
  storageSize: '入库尺寸',
  storageDays: '仓储天数',
  shippingFee: '实际运费 (JPY)',
  valueAddedServiceAmount: '增值服务金额 (JPY)',
};

// ─── 白名单函数 ────────────────────────────────────────────────────────────────
export const ALLOWED_FUNCTIONS = {
  if: (cond, t, f) => (cond ? t : f),
  min: (a, b) => Math.min(a, b),
  max: (a, b) => Math.max(a, b),
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  round: (v) => Math.round(v),
  ceil: (v) => Math.ceil(v),
  floor: (v) => Math.floor(v),
  roundTo: (v, unit) => Math.round(v / unit) * unit,
  ceilTo: (v, unit) => Math.ceil(v / unit) * unit,
  floorTo: (v, unit) => Math.floor(v / unit) * unit,
  abs: (v) => Math.abs(v),
};

// ─── 内置规则模板 ──────────────────────────────────────────────────────────────
export const RULE_TEMPLATES = [
  { label: '固定比例', formula: 'goodsAmount * 8%', description: '按货款金额乘以固定比例' },
  { label: '比例 + 最低服务费', formula: 'max(goodsAmount * 8%, 500)', description: '不低于最低服务费' },
  { label: '比例 + 最低 + 封顶', formula: 'clamp(goodsAmount * 8%, 500, 5000)', description: '介于最低和封顶之间' },
  { label: '不同客户等级不同费率', formula: 'if(customerLevel == "vip", goodsAmount * 5%, if(customerLevel == "regular", goodsAmount * 8%, goodsAmount * 10%))', description: 'VIP 5%，普通 8%，其他 10%' },
  { label: '不同下单网站不同费率', formula: 'if(sourceSite == "Amazon", goodsAmount * 6%, if(sourceSite == "メルカリ", goodsAmount * 12%, goodsAmount * 8%))', description: '按商城区分费率' },
  { label: '商品件数附加费', formula: 'goodsAmount * 8% + itemCount * 100', description: '基础比例 + 每件100 JPY' },
  { label: '中转地附加费', formula: 'goodsAmount * 8% + if(hasTransit, 300, 0)', description: '使用中转地加收300 JPY' },
];

// ─── Tokenizer ─────────────────────────────────────────────────────────────────
const TOKEN_TYPES = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  PERCENT: 'PERCENT',
  IDENT: 'IDENT',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  PLUS: 'PLUS',
  MINUS: 'MINUS',
  STAR: 'STAR',
  SLASH: 'SLASH',
  GT: 'GT', GTE: 'GTE',
  LT: 'LT', LTE: 'LTE',
  EQ: 'EQ', NEQ: 'NEQ',
  AND: 'AND', OR: 'OR', NOT: 'NOT',
  IN: 'IN', CONTAINS: 'CONTAINS',
  EOF: 'EOF',
};

function tokenize(input) {
  if (!input || typeof input !== 'string') throw new Error('公式不能为空');
  if (input.length > 500) throw new Error('公式过长（最大500字符）');

  const tokens = [];
  let i = 0;
  const src = input.trim();

  while (i < src.length) {
    // skip whitespace
    if (/\s/.test(src[i])) { i++; continue; }

    // number (including decimals)
    if (/[0-9]/.test(src[i]) || (src[i] === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      // Check for percent suffix
      if (src[i] === '%') {
        i++;
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(num) / 100 });
      } else {
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(num) });
      }
      continue;
    }

    // string literal: "..." or '...'
    if (src[i] === '"' || src[i] === "'") {
      const quote = src[i++];
      let str = '';
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        str += src[i++];
      }
      if (src[i] !== quote) throw new Error('字符串未闭合');
      i++;
      tokens.push({ type: TOKEN_TYPES.STRING, value: str });
      continue;
    }

    // identifier or keyword
    if (/[a-zA-Z_]/.test(src[i])) {
      let ident = '';
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) ident += src[i++];
      switch (ident.toLowerCase()) {
        case 'and': tokens.push({ type: TOKEN_TYPES.AND }); break;
        case 'or':  tokens.push({ type: TOKEN_TYPES.OR }); break;
        case 'not': tokens.push({ type: TOKEN_TYPES.NOT }); break;
        case 'in':  tokens.push({ type: TOKEN_TYPES.IN }); break;
        case 'contains': tokens.push({ type: TOKEN_TYPES.CONTAINS }); break;
        case 'true':  tokens.push({ type: TOKEN_TYPES.NUMBER, value: 1 }); break;
        case 'false': tokens.push({ type: TOKEN_TYPES.NUMBER, value: 0 }); break;
        default: tokens.push({ type: TOKEN_TYPES.IDENT, value: ident });
      }
      continue;
    }

    // operators
    if (src[i] === '>' && src[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.GTE }); i += 2; continue; }
    if (src[i] === '<' && src[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.LTE }); i += 2; continue; }
    if (src[i] === '=' && src[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.EQ }); i += 2; continue; }
    if (src[i] === '!' && src[i + 1] === '=') { tokens.push({ type: TOKEN_TYPES.NEQ }); i += 2; continue; }
    if (src[i] === '>') { tokens.push({ type: TOKEN_TYPES.GT }); i++; continue; }
    if (src[i] === '<') { tokens.push({ type: TOKEN_TYPES.LT }); i++; continue; }
    if (src[i] === '+') { tokens.push({ type: TOKEN_TYPES.PLUS }); i++; continue; }
    if (src[i] === '-') { tokens.push({ type: TOKEN_TYPES.MINUS }); i++; continue; }
    if (src[i] === '*') { tokens.push({ type: TOKEN_TYPES.STAR }); i++; continue; }
    if (src[i] === '/') { tokens.push({ type: TOKEN_TYPES.SLASH }); i++; continue; }
    if (src[i] === '(') { tokens.push({ type: TOKEN_TYPES.LPAREN }); i++; continue; }
    if (src[i] === ')') { tokens.push({ type: TOKEN_TYPES.RPAREN }); i++; continue; }
    if (src[i] === ',') { tokens.push({ type: TOKEN_TYPES.COMMA }); i++; continue; }
    if (src[i] === '%') { 
      // bare % after expression: multiply last number by 0.01 (handled differently below)
      tokens.push({ type: TOKEN_TYPES.PERCENT }); i++; continue; 
    }

    throw new Error(`非法字符: ${src[i]} (位置 ${i})`);
  }

  tokens.push({ type: TOKEN_TYPES.EOF });
  return tokens;
}

// ─── Parser (Recursive Descent) ───────────────────────────────────────────────
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
    this.steps = []; // calculation trace
  }

  peek() { return this.tokens[this.pos]; }
  consume() { return this.tokens[this.pos++]; }

  expect(type) {
    const t = this.consume();
    if (t.type !== type) throw new Error(`期望 ${type}，得到 ${t.type}`);
    return t;
  }

  parseExpr(depth = 0) {
    if (depth > 20) throw new Error('公式嵌套过深（最大20层）');
    return this.parseOr(depth);
  }

  parseOr(depth) {
    let left = this.parseAnd(depth);
    while (this.peek().type === TOKEN_TYPES.OR) {
      this.consume();
      const right = this.parseAnd(depth);
      left = left || right ? 1 : 0;
    }
    return left;
  }

  parseAnd(depth) {
    let left = this.parseNot(depth);
    while (this.peek().type === TOKEN_TYPES.AND) {
      this.consume();
      const right = this.parseNot(depth);
      left = (left && right) ? 1 : 0;
    }
    return left;
  }

  parseNot(depth) {
    if (this.peek().type === TOKEN_TYPES.NOT) {
      this.consume();
      return this.parseComparison(depth) ? 0 : 1;
    }
    return this.parseComparison(depth);
  }

  parseComparison(depth) {
    let left = this.parseAddSub(depth);
    const t = this.peek();
    if ([TOKEN_TYPES.GT, TOKEN_TYPES.GTE, TOKEN_TYPES.LT, TOKEN_TYPES.LTE, TOKEN_TYPES.EQ, TOKEN_TYPES.NEQ].includes(t.type)) {
      this.consume();
      const right = this.parseAddSub(depth);
      switch (t.type) {
        case TOKEN_TYPES.GT:  return left > right ? 1 : 0;
        case TOKEN_TYPES.GTE: return left >= right ? 1 : 0;
        case TOKEN_TYPES.LT:  return left < right ? 1 : 0;
        case TOKEN_TYPES.LTE: return left <= right ? 1 : 0;
        case TOKEN_TYPES.EQ:  return left == right ? 1 : 0; // eslint-disable-line eqeqeq
        case TOKEN_TYPES.NEQ: return left != right ? 1 : 0; // eslint-disable-line eqeqeq
      }
    }
    // in operator: value in [a, b, c] — parse as "value == a or value == b..."
    if (t.type === TOKEN_TYPES.IN) {
      this.consume();
      this.expect(TOKEN_TYPES.LPAREN);
      const opts = [this.parseAddSub(depth)];
      while (this.peek().type === TOKEN_TYPES.COMMA) {
        this.consume();
        opts.push(this.parseAddSub(depth));
      }
      this.expect(TOKEN_TYPES.RPAREN);
      return opts.includes(left) ? 1 : 0;
    }
    // contains operator: string contains substring
    if (t.type === TOKEN_TYPES.CONTAINS) {
      this.consume();
      const right = this.parseAddSub(depth);
      return String(left).includes(String(right)) ? 1 : 0;
    }
    return left;
  }

  parseAddSub(depth) {
    let left = this.parseMulDiv(depth);
    while (true) {
      if (this.peek().type === TOKEN_TYPES.PLUS) {
        this.consume();
        const right = this.parseMulDiv(depth);
        left = left + right;
      } else if (this.peek().type === TOKEN_TYPES.MINUS) {
        this.consume();
        const right = this.parseMulDiv(depth);
        left = left - right;
      } else {
        break;
      }
    }
    return left;
  }

  parseMulDiv(depth) {
    let left = this.parseUnary(depth);
    while (true) {
      if (this.peek().type === TOKEN_TYPES.STAR) {
        this.consume();
        const right = this.parseUnary(depth);
        left = left * right;
      } else if (this.peek().type === TOKEN_TYPES.SLASH) {
        this.consume();
        const right = this.parseUnary(depth);
        if (right === 0) throw new Error('除以零错误');
        left = left / right;
      } else if (this.peek().type === TOKEN_TYPES.PERCENT) {
        // bare % after expression: x% = x/100
        this.consume();
        left = left / 100;
      } else {
        break;
      }
    }
    return left;
  }

  parseUnary(depth) {
    if (this.peek().type === TOKEN_TYPES.MINUS) {
      this.consume();
      return -this.parsePrimary(depth);
    }
    return this.parsePrimary(depth);
  }

  parsePrimary(depth, variables = {}) {
    const t = this.peek();

    if (t.type === TOKEN_TYPES.NUMBER) {
      this.consume();
      return t.value;
    }

    if (t.type === TOKEN_TYPES.STRING) {
      this.consume();
      return t.value;
    }

    if (t.type === TOKEN_TYPES.LPAREN) {
      this.consume();
      const val = this.parseExpr(depth + 1);
      this.expect(TOKEN_TYPES.RPAREN);
      return val;
    }

    if (t.type === TOKEN_TYPES.IDENT) {
      const name = t.value;
      this.consume();

      // Function call
      if (this.peek().type === TOKEN_TYPES.LPAREN) {
        if (!ALLOWED_FUNCTIONS[name]) throw new Error(`不支持的函数: ${name}`);
        this.consume();
        const args = [];
        if (this.peek().type !== TOKEN_TYPES.RPAREN) {
          args.push(this.parseExpr(depth + 1));
          while (this.peek().type === TOKEN_TYPES.COMMA) {
            this.consume();
            args.push(this.parseExpr(depth + 1));
          }
        }
        this.expect(TOKEN_TYPES.RPAREN);
        const result = ALLOWED_FUNCTIONS[name](...args);
        this.steps.push(`${name}(${args.join(', ')}) = ${result}`);
        return result;
      }

      // Variable lookup
      if (!ALLOWED_VARIABLES.includes(name)) throw new Error(`不支持的变量: ${name}`);
      const val = this._vars ? this._vars[name] : 0;
      return val !== undefined && val !== null ? val : 0;
    }

    throw new Error(`非法表达式，位置 ${this.pos}，token: ${t.type}`);
  }
}

// ─── 主计算函数 ────────────────────────────────────────────────────────────────
// ─── 辅助：匹配客户等级（tier/role name → 配置行 levels） ──────────────────────
/**
 * 判断 customerLevel 是否匹配某条配置行的 levels 数组
 * levels 为空 = 匹配全部；否则只要有一个 level.name 等于 customerLevel 即匹配
 */
function matchCustomerLevel(customerLevel, levels) {
  if (!levels || levels.length === 0) return true;
  const cl = String(customerLevel || '').trim().toLowerCase();
  return levels.some(l => String(l.name || '').trim().toLowerCase() === cl);
}

/**
 * 计算服务费
 * @param {object} rule - 规则对象
 * @param {object} variables - 变量值 (goodsAmount, itemCount, ...)
 * @returns {{ fee: number, steps: string[], matchedConfig: object|null, error: string|null }}
 */
export function calculateServiceFee(rule, variables) {
  const steps = [];
  let matchedConfig = null;
  try {
    const vars = { ...variables };
    // Normalize booleans
    if (typeof vars.hasTransit === 'boolean') vars.hasTransit = vars.hasTransit ? 1 : 0;

    let baseFee = 0;
    const isShipping = rule.fee_phase === 'shipping';

    if (rule.mode === 'simple') {
      if (isShipping) {
        // 发货阶段 simple：按 shipping_fee_simple_config 行匹配客户等级（顺序优先）
        const config = rule.shipping_fee_simple_config || [];
        const baseAmount = parseFloat(vars.shippingFee) || 0;
        let matched = false;

        for (let i = 0; i < config.length; i++) {
          const row = config[i];
          if (matchCustomerLevel(vars.customerLevel, row.levels || [])) {
            const rate = (parseFloat(row.rate) || 0) / 100;
            const fixed = parseFloat(row.fixed_fee_jpy) || 0;
            baseFee = baseAmount * rate + fixed;
            const levelDesc = (row.levels || []).length === 0 ? '全部用户' : row.levels.map(l => l.name).join('、');
            steps.push(`命中配置行 #${i + 1}（${levelDesc}）：¥${baseAmount} × ${row.rate || 0}% + 固定¥${fixed} = ¥${baseFee}`);
            matchedConfig = { rowIndex: i, row };
            matched = true;
            break;
          }
        }

        if (!matched) {
          // 回退到默认 simple_rate
          const rate = (parseFloat(rule.simple_rate) || 0) / 100;
          const fixed = parseFloat(rule.simple_fixed_fee) || 0;
          baseFee = baseAmount * rate + fixed;
          steps.push(`未命中配置行，使用默认费率：¥${baseAmount} × ${rule.simple_rate || 0}% + 固定¥${fixed} = ¥${baseFee}`);
        }
      } else {
        // 下单阶段 simple：customer_level_filter → store_filter → 默认
        const levelFilter = rule.customer_level_filter || [];
        const storeFilter = rule.store_filter || [];
        const baseAmount = parseFloat(vars.goodsAmount) || 0;
        let matched = false;

        for (let i = 0; i < levelFilter.length; i++) {
          const row = levelFilter[i];
          // 兼容旧版单level行 {type,id,name} 和新版 {levels:[...]}
          const levels = row.levels !== undefined ? (row.levels || []) : (row.id ? [row] : []);
          if (matchCustomerLevel(vars.customerLevel, levels)) {
            const rate = (parseFloat(row.rate) || 0) / 100;
            const fixed = parseFloat(row.fixed_fee) || 0;
            const desc = levels.length === 0 ? '全部用户' : levels.map(l => l.name).join('、');
            baseFee = baseAmount * rate + fixed;
            steps.push(`命中客户等级配置行 #${i+1}（${desc}）：¥${baseAmount} × ${row.rate || 0}% + 固定¥${fixed} = ¥${baseFee}`);
            matchedConfig = { type: 'customer_level', rowIndex: i, row };
            matched = true;
            break;
          }
        }

        if (!matched) {
          for (let i = 0; i < storeFilter.length; i++) {
            const row = storeFilter[i];
            // tag_label 为空 = 匹配全部网站
            const tagLabel = String(row.tag_label || '').trim();
            const sourceSite = String(vars.sourceSite || '').trim();
            if (tagLabel === '' || tagLabel === sourceSite) {
              const rate = (parseFloat(row.rate) || 0) / 100;
              const fixed = parseFloat(row.fixed_fee) || 0;
              const desc = tagLabel === '' ? '全部网站' : tagLabel;
              baseFee = baseAmount * rate + fixed;
              steps.push(`命中网站配置行 #${i+1}（${desc}）：¥${baseAmount} × ${row.rate || 0}% + 固定¥${fixed} = ¥${baseFee}`);
              matchedConfig = { type: 'store_tag', rowIndex: i, row };
              matched = true;
              break;
            }
          }
        }

        if (!matched) {
          const rate = (parseFloat(rule.simple_rate) || 0) / 100;
          const fixed = parseFloat(rule.simple_fixed_fee) || 0;
          baseFee = baseAmount * rate + fixed;
          steps.push(`使用默认费率：¥${baseAmount} × ${rule.simple_rate || 0}% + 固定¥${fixed} = ¥${baseFee}`);
        }
      }

    } else if (rule.mode === 'tiered') {
      if (isShipping) {
        // 发货阶段 tiered：按 shipping_fee_tiered_config 匹配（所有条件 AND）
        const config = rule.shipping_fee_tiered_config || [];
        const baseAmount = parseFloat(vars.shippingFee) || 0;
        let matched = false;

        for (let i = 0; i < config.length; i++) {
          const row = config[i];

          // 1. 客户等级（空=全部，OR匹配）
          if (!matchCustomerLevel(vars.customerLevel, row.customer_levels || [])) continue;

          // 2. 收货国家（空=全部，OR匹配）
          const countries = row.countries || [];
          if (countries.length > 0 && !countries.includes(vars.country || '')) continue;

          // 3. 发货方式（空=全部，OR匹配）
          const methods = row.shipping_methods || [];
          if (methods.length > 0 && !methods.includes(vars.shippingMethod || '')) continue;

          // 4. 是否中转（null=不限）
          if (row.has_transit !== null && row.has_transit !== undefined) {
            const rowTransit = row.has_transit === true || row.has_transit === 1;
            const varTransit = vars.hasTransit === 1 || vars.hasTransit === true;
            if (rowTransit !== varTransit) continue;
          }

          // 5. 重量范围
          const wFrom = row.weight_from_g !== null && row.weight_from_g !== undefined ? parseFloat(row.weight_from_g) : null;
          const wTo = row.weight_to_g !== null && row.weight_to_g !== undefined ? parseFloat(row.weight_to_g) : null;
          const w = parseFloat(vars.weight) || 0;
          if (wFrom !== null && w < wFrom) continue;
          if (wTo !== null && w >= wTo) continue;

          // 6. 入库尺寸（空=全部，OR匹配，与 item_size_title 比较）
          const sizes = row.storage_sizes || [];
          if (sizes.length > 0 && !sizes.includes(vars.storageSize || '')) continue;

          // 全部条件命中
          const rate = (parseFloat(row.rate) || 0) / 100;
          const fixed = parseFloat(row.fixed_fee_jpy) || 0;
          baseFee = baseAmount * rate + fixed;

          // 构建命中说明
          const condParts = [];
          if ((row.customer_levels || []).length > 0) condParts.push(`等级:${row.customer_levels.map(l => l.name).join('/')}`);
          if (countries.length > 0) condParts.push(`国家:${countries.join('/')}`);
          if (methods.length > 0) condParts.push(`方式:${methods.join('/')}`);
          if (row.has_transit !== null && row.has_transit !== undefined) condParts.push(`中转:${row.has_transit ? '是' : '否'}`);
          if (wFrom !== null || wTo !== null) condParts.push(`重量:${wFrom ?? 0}g~${wTo ?? '∞'}g`);
          if (sizes.length > 0) condParts.push(`尺寸:${sizes.join('/')}`);

          steps.push(`命中规则 #${i + 1}${condParts.length ? `（${condParts.join('，')}）` : '（全部用户）'}：¥${baseAmount} × ${row.rate || 0}% + 固定¥${fixed} = ¥${baseFee}`);
          matchedConfig = { rowIndex: i, row };
          matched = true;
          break;
        }

        if (!matched) {
          steps.push('未命中任何发货阶梯规则，服务费为0');
        }
      } else {
        // 下单阶段 tiered：金额范围 + 客户等级 + 下单网站 多条件匹配
        const amount = parseFloat(vars.goodsAmount) || 0;
        const tierRows = rule.tiered_config || [];
        let matched = false;
        for (let i = 0; i < tierRows.length; i++) {
          const tier = tierRows[i];

          // 1. 金额范围
          const from = parseFloat(tier.from) || 0;
          const toVal = tier.to !== null && tier.to !== undefined ? parseFloat(tier.to) : Infinity;
          if (amount < from || amount >= toVal) continue;

          // 2. 客户等级（空=全部，OR匹配）
          const levels = tier.customer_levels || [];
          if (!matchCustomerLevel(vars.customerLevel, levels)) continue;

          // 3. 下单网站（空=全部，OR匹配）
          const storeTags = tier.store_tags || [];
          if (storeTags.length > 0) {
            const sourceSite = String(vars.sourceSite || '').trim();
            if (!storeTags.some(tag => String(tag || '').trim() === sourceSite)) continue;
          }

          const rate = (parseFloat(tier.rate) || 0) / 100;
          const fixed = parseFloat(tier.fixed_fee) || 0;
          baseFee = amount * rate + fixed;

          const condParts = [`¥${from}~${tier.to ?? '∞'}`];
          if (levels.length > 0) condParts.push(`等级:${levels.map(l => l.name).join('/')}`);
          if (storeTags.length > 0) condParts.push(`网站:${storeTags.join('/')}`);

          steps.push(`命中金额阶梯 #${i + 1}（${condParts.join('，')}）：¥${amount} × ${tier.rate || 0}% + 固定¥${fixed} = ¥${baseFee}`);
          matchedConfig = { rowIndex: i, tier };
          matched = true;
          break;
        }
        if (!matched) {
          steps.push('未命中任何金额阶梯，服务费为0');
        }
      }

    } else if (rule.mode === 'formula') {
      const formula = rule.formula || '';
      if (!formula.trim()) throw new Error('公式为空');

      const tokens = tokenize(formula);
      const parser = new Parser(tokens);
      parser._vars = vars;
      baseFee = parser.parseExpr(0);
      if (parser.peek().type !== 'EOF') throw new Error('公式末尾有多余内容');
      steps.push(...parser.steps);
      steps.push(`公式结果: ${baseFee}`);
    }

    // Apply min/max
    const minFee = parseFloat(rule.min_fee) || 0;
    const maxFee = parseFloat(rule.max_fee) || 0;
    if (minFee > 0 && baseFee < minFee) {
      steps.push(`应用最低服务费: ${baseFee} → ${minFee}`);
      baseFee = minFee;
    }
    if (maxFee > 0 && baseFee > maxFee) {
      steps.push(`应用封顶服务费: ${baseFee} → ${maxFee}`);
      baseFee = maxFee;
    }

    // Rounding
    const roundUnit = parseFloat(rule.round_unit) || 1;
    const beforeRound = baseFee;
    switch (rule.round_mode || 'round') {
      case 'round':  baseFee = Math.round(baseFee / roundUnit) * roundUnit; break;
      case 'ceil':   baseFee = Math.ceil(baseFee / roundUnit) * roundUnit; break;
      case 'floor':  baseFee = Math.floor(baseFee / roundUnit) * roundUnit; break;
      case 'none':   break;
    }
    if (rule.round_mode !== 'none' && beforeRound !== baseFee) {
      steps.push(`取整(${rule.round_mode}, 单位${roundUnit}): ${beforeRound} → ${baseFee}`);
    }

    return { fee: Math.max(0, baseFee), steps, matchedConfig, error: null };

  } catch (err) {
    return { fee: 0, steps, error: err.message };
  }
}

/**
 * 验证公式语法（不计算）
 * @param {string} formula
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateFormula(formula) {
  try {
    const tokens = tokenize(formula);
    // Use dummy variables (all = 0)
    const dummyVars = {};
    ALLOWED_VARIABLES.forEach(v => { dummyVars[v] = typeof v === 'string' ? 0 : 0; });
    dummyVars.sourceSite = 'test';
    dummyVars.customerLevel = 'regular';
    dummyVars.currency = 'JPY';
    dummyVars.country = 'CN';
    dummyVars.shippingMethod = 'EMS';
    dummyVars.storageSize = 'small';
    const parser = new Parser(tokens);
    parser._vars = dummyVars;
    parser.parseExpr(0);
    if (parser.peek().type !== 'EOF') return { valid: false, error: '公式末尾有多余内容' };
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * 构建订单变量对象
 */
export function buildOrderVariables(order, userRecord = null) {
  return {
    goodsAmount: parseFloat(order.estimated_jpy) || 0,
    orderAmount: parseFloat(order.estimated_jpy) || 0,
    itemCount: parseFloat(order.quantity) || 1,
    sourceSite: order.online_store_tag || '其它',
    customerLevel: userRecord?.member_tier_name || userRecord?.role || 'user',
    customerTags: userRecord?.tags || '',
    currency: order.prepayment_currency || 'JPY',
    country: order.destination_country || '',
    shippingMethod: order.shipping_method || '',
    hasTransit: order.consolidation_pool_id ? 1 : 0,
    weight: parseFloat(order.weight_g) || 0,
    storageSize: order.item_size_title || '',
    storageDays: 0,
    shippingFee: parseFloat(order.shipping_fee_amount) || 0, // 发货阶段服务费基数
    valueAddedServiceAmount: (order.selected_addons || []).reduce((sum, a) => sum + (parseFloat(a.fee) || 0), 0),
  };
}