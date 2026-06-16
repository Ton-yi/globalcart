# i18n 国际化翻译系统使用指南

## 概述

本项目已实现简单的 i18n 翻译系统，支持中文 (zh)、日语 (ja) 和英语 (en)。

## 核心文件

### 1. `lib/i18n.js` - 翻译系统核心

包含所有翻译字典和翻译函数。

### 2. `lib/LocaleContext.jsx` - 语言环境上下文

提供全局的 locale 状态和切换功能。

## 使用方法

### 在组件中使用翻译

```jsx
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";

export default function MyComponent() {
  const { locale } = useLocale();
  
  return (
    <div>
      <h1>{t("欢迎", locale)}</h1>
      <button>{t("登录", locale)}</button>
    </div>
  );
}
```

### 添加新的翻译文本

1. 在 `lib/i18n.js` 的 `translations.zh` 中添加中文原文
2. 在 `translations.ja` 中添加日语翻译
3. 在 `translations.en` 中添加英语翻译（可选）

```js
export const translations = {
  zh: {
    "新的文本": "新的文本",
  },
  ja: {
    "新的文本": "新しいテキスト",
  },
  en: {
    "新的文本": "New Text",
  },
};
```

## 已翻译的内容

### Layout 布局
- 账户停用提示
- 导航菜单项
- 登录/登出按钮
- 页脚链接

### 导航菜单
- 平台设置、租户管理
- 订单管理、发货池管理
- 用户管理、后台设置
- 我的订单、发货 & 拼邮

### Home 页面
- 代购流程步骤
- 快速操作网格
- 物流状态看板

## 切换语言

用户可以通过导航栏右上角的语言切换器切换语言。

切换后会自动：
1. 更新 localStorage 中的偏好设置
2. 触发 `localeChanged` 事件
3. 重新渲染使用 `t()` 函数的组件

## 注意事项

1. **始终使用 `t()` 函数**：所有用户可见的文本都应该通过 `t()` 函数翻译
2. **使用中文作为 key**：翻译字典使用中文原文作为键
3. **保持翻译完整**：不要省略标点符号或特殊字符
4. **测试所有语言**：切换不同语言确保 UI 正常显示

## 后续计划

- [ ] 翻译所有管理后台页面
- [ ] 翻译所有用户页面
- [ ] 翻译所有弹窗和提示
- [ ] 翻译所有表单标签
- [ ] 翻译所有错误消息
- [ ] 添加更多语言支持

## 示例

### 完整组件示例

```jsx
import { useLocale } from "@/lib/LocaleContext";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export default function Example() {
  const { locale } = useLocale();
  
  return (
    <div>
      <h1>{t("欢迎", locale)}</h1>
      <p>{t("这是一段示例文本", locale)}</p>
      <Button>{t("保存", locale)}</Button>
      <Button variant="outline">{t("取消", locale)}</Button>
    </div>
  );
}
```

## 日语翻译示例

| 中文 | 日语 |
|------|------|
| 登录 | ログイン |
| 保存 | 保存 |
| 取消 | キャンセル |
| 订单管理 | 注文管理 |
| 我的订单 | マイオーダー |
| 发货池 | 発送プール |