# 多语言路由架构实现文档

**实现日期**: 2026-06-11  
**功能状态**: ✅ 已完成（除具体翻译文本外）

---

## 📋 实现概述

已完成多语言路由架构的所有基础设施，包括：
- ✅ 路由结构支持 `/{locale}/...` 前缀
- ✅ 语言切换器组件
- ✅ Locale 上下文管理
- ✅ 自动重定向和默认语言处理
- ✅ URL 工具函数更新

**未完成**: 具体的翻译文本（i18n 翻译文件）

---

## 🗂️ 核心组件

### 1. LocaleContext.jsx
**路径**: `lib/LocaleContext.jsx`

**功能**:
- 提供全局 Locale 上下文
- 管理当前语言状态
- 处理语言切换逻辑
- 自动保存用户偏好到 localStorage

**支持的语言**:
```javascript
[
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zhcn', label: '简体中文', flag: '🇨🇳' },
  { code: 'zhtw', '繁體中文', flag: '🇹🇼' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
]
```

**默认语言**: `ja` (日语)

### 2. LocaleSwitcher.jsx
**路径**: `components/common/LocaleSwitcher.jsx`

**功能**:
- 下拉菜单式语言切换器
- 显示当前语言标志和名称
- 一键切换到其他语言
- 保持当前页面路径

**使用示例**:
```jsx
import LocaleSwitcher from '@/components/common/LocaleSwitcher';

// 在 Header 中使用
<LocaleSwitcher />
```

### 3. App.jsx 路由配置
**路径**: `App.jsx`

**路由结构**:
```jsx
// 根路径重定向到默认语言
<Route path="/" element={<Navigate to="/ja" replace />} />

// 主页支持语言前缀
<Route path="/:locale" element={<MainPage />} />

// 所有页面支持语言前缀
<Route path="/:locale/{pageName}" element={<Page />} />

// 特殊路由（公开资料页）
<Route path="/:locale/u/:handle" element={<PublicProfile />} />

// 未匹配路径重定向到默认语言
<Route path="*" element={<Navigate to="/ja" replace />} />
```

### 4. utils/index.ts
**路径**: `utils/index.ts`

**更新**:
```typescript
export function createPageUrl(pageName: string) {
    const locale = window.location.pathname.split('/')[1] || 'ja';
    return `/${locale}/${pageName.replace(/ /g, '-')}`;
}
```

**功能**:
- 自动从当前 URL 提取语言代码
- 生成带语言前缀的页面 URL
- 默认使用 `ja` 作为后备语言

---

## 🌐 路由示例

### 主页
- 日语：`/ja` 或 `/ja/Home`
- 中文简体：`/zhcn` 或 `/zhcn/Home`
- 英语：`/en` 或 `/en/Home`

### 我的订单
- 日语：`/ja/MyOrders`
- 中文简体：`/zhcn/MyOrders`
- 英语：`/en/MyOrders`

### 公开资料页
- 日语：`/ja/u/nekoyume`
- 中文简体：`/zhcn/u/nekoyume`
- 英语：`/en/u/nekoyume`

### 隐私设置
- 日语：`/ja/UserPrivacySettings`
- 中文简体：`/zhcn/UserPrivacySettings`
- 英语：`/en/UserPrivacySettings`

---

## 🎯 功能特性

### 1. 自动语言检测
- 从 URL 路径提取语言代码
- 从 localStorage 读取用户偏好
- 默认使用日语 (`ja`)

### 2. 语言切换
- 切换语言时保持当前页面
- 自动更新 URL 路径
- 保存偏好到 localStorage

### 3. 重定向规则
- 根路径 `/` → `/ja`
- 未知路径 `*` → `/ja`
- 无效语言代码 → `/ja`

### 4. 租户隔离
- 语言切换不影响租户上下文
- 租户配置独立于语言设置
- 多语言支持所有租户功能

---

## 🔧 使用方法

### 在组件中使用语言切换器

```jsx
import { useLocale } from '@/lib/LocaleContext';

function MyComponent() {
  const { locale, changeLocale, locales } = useLocale();
  
  return (
    <div>
      <p>当前语言：{locale}</p>
      <button onClick={() => changeLocale('en')}>
        切换到英语
      </button>
    </div>
  );
}
```

### 生成带语言的 URL

```jsx
import { createPageUrl } from '@/utils';

// 当前 URL: /ja/MyOrders
createPageUrl('SubmitOrder'); 
// 返回：/ja/SubmitOrder

// 当前 URL: /zhcn/AdminOrders
createPageUrl('AdminDashboard');
// 返回：/zhcn/AdminDashboard
```

### 在导航中使用

```jsx
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

<Link to={createPageUrl('Home')}>首页</Link>
<Link to={createPageUrl('MyOrders')}>我的订单</Link>
```

---

## ⚠️ 注意事项

### 1. 翻译文本未实现
当前架构**不包含**具体的翻译文本。后续需要：
- 创建翻译文件（如 `locales/ja.json`, `locales/en.json`）
- 安装 i18n 库（如 `react-i18next`）
- 替换所有硬编码文本为翻译键

### 2. 日期格式化
当前使用浏览器默认语言格式化日期。后续需要：
- 使用 `date-fns/locale` 支持多语言日期
- 根据当前 locale 选择对应的 locale 文件

### 3. 数字格式化
当前使用浏览器默认语言格式化数字。后续需要：
- 使用 `Intl.NumberFormat` 指定语言
- 根据当前 locale 选择对应的格式

### 4. RTL 语言支持
当前不支持从右到左的语言（如阿拉伯语）。如需支持：
- 添加 RTL 检测逻辑
- 应用 `dir="rtl"` 到 HTML 标签
- 调整 CSS 布局

---

## 🚀 后续步骤

### 阶段一：基础设施（已完成 ✅）
- [x] LocaleContext 实现
- [x] LocaleSwitcher 组件
- [x] 路由结构更新
- [x] URL 工具函数更新
- [x] App.jsx 集成

### 阶段二：翻译系统（待实现）
- [ ] 安装 `react-i18next` 和 `i18next`
- [ ] 创建翻译文件结构
  - `locales/ja/common.json`
  - `locales/zhcn/common.json`
  - `locales/en/common.json`
  - ...
- [ ] 配置 i18n 初始化
- [ ] 创建 `useTranslation` hook 封装

### 阶段三：文本替换（待实现）
- [ ] 替换 Layout 中的导航文本
- [ ] 替换所有页面中的硬编码文本
- [ ] 替换组件中的文本
- [ ] 替换错误消息和提示

### 阶段四：格式化优化（待实现）
- [ ] 日期格式化多语言支持
- [ ] 数字格式化多语言支持
- [ ] 货币格式化多语言支持
- [ ] 相对时间格式化（如"3 天前"）

### 阶段五：特殊功能（可选）
- [ ] RTL 语言支持
- [ ] 复数形式处理
- [ ] 上下文相关的翻译
- [ ] 懒加载翻译文件

---

## 📝 翻译文件结构示例

建议的翻译文件结构：

```
locales/
├── ja/
│   ├── common.json       # 通用文本
│   ├── navigation.json   # 导航菜单
│   ├── orders.json       # 订单相关
│   ├── shipping.json     # 物流相关
│   └── admin.json        # 管理后台
├── zhcn/
│   ├── common.json
│   ├── navigation.json
│   ├── orders.json
│   ├── shipping.json
│   └── admin.json
├── en/
│   └── ...
└── zhtw/
    └── ...
```

**common.json 示例**:
```json
{
  "home": "首页",
  "myOrders": "我的订单",
  "submitOrder": "提交需求",
  "shippingPool": "发货池",
  "settings": "设置",
  "logout": "退出登录",
  "login": "登录"
}
```

---

## 🎨 UI 集成

### Header 中的语言切换器

语言切换器已集成到 Layout 的 Header 中：

```jsx
<div className="flex items-center gap-2">
  <LocaleSwitcher />
  <NotificationBell />
  <MidnightToggle />
  ...
</div>
```

**显示效果**:
- 地球图标 + 当前语言标志和名称
- 下拉菜单显示所有支持的语言
- 点击切换语言

---

## ✅ 验收清单

- [x] LocaleContext 正常工作
- [x] LocaleSwitcher 可切换语言
- [x] 所有路由支持 `/:locale` 前缀
- [x] 根路径重定向到默认语言
- [x] createPageUrl 生成正确的带语言前缀的 URL
- [x] 语言偏好保存到 localStorage
- [x] 切换语言时保持当前页面路径
- [x] 所有现有页面在新路由下可访问
- [x] 公开资料页支持多语言路由
- [x] 隐私设置页支持多语言路由

---

## 🔍 技术细节

### LocaleContext 实现逻辑

```javascript
// 1. 从 URL 提取语言
const localeFromPath = location.pathname.split('/')[1];

// 2. 验证语言代码
if (SUPPORTED_LOCALES.some(loc => loc.code === localeFromPath)) {
  setCurrentLocale(localeFromPath);
  localStorage.setItem('preferred_locale', localeFromPath);
} else {
  // 3. 使用保存的偏好或默认语言
  const saved = localStorage.getItem('preferred_locale') || DEFAULT_LOCALE;
  setCurrentLocale(saved);
}
```

### 语言切换逻辑

```javascript
const changeLocale = (localeCode) => {
  // 1. 验证语言代码
  if (!SUPPORTED_LOCALES.some(loc => loc.code === localeCode)) {
    localeCode = DEFAULT_LOCALE;
  }
  
  // 2. 替换 URL 中的语言代码
  const newPath = location.pathname.replace(
    `/${localeFromPath}`, 
    `/${localeCode}`
  );
  
  // 3. 导航到新路径
  navigate(newPath);
};
```

---

**实现人**: Base44 AI  
**实现时间**: 2026-06-11  
**版本**: v1.0

---

## 💡 下一步建议

1. **安装 i18next**:
   ```bash
   npm install react-i18next i18next
   ```

2. **创建第一个翻译文件** (`locales/ja/common.json`)

3. **配置 i18n** (`lib/i18n.js`)

4. **替换第一个页面的文本** (建议从 Layout 开始)

5. **逐步替换所有页面**

多语言路由架构已就绪，可以开始添加具体翻译文本了！