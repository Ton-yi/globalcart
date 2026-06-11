# 公开资料页功能实现文档

**实现日期**: 2026-06-11  
**功能状态**: ✅ 核心功能已完成

---

## 📋 功能概述

为用户系统新增公开资料页功能，支持用户自定义隐私设置、唯一 Handle 标识符、以及资料页访问统计。

---

## 🗂️ 数据模型扩展

### User 实体新增字段

#### 公开资料页基础
- `handle` (String): 公开资料页唯一标识符
  - 规则：小写字母 a-z 和数字 0-9
  - 长度：3-24 位
  - 必须包含至少一个英文字母
  - 不允许纯数字
  - 全站唯一
  - 不得使用系统保留词

- `public_profile_enabled` (Boolean): 是否公开个人档案页
  - 默认值：false
  - 开启后，其他已登录用户可访问

- `public_profile_bio` (String): 个人简介
- `public_profile_bio_image_url` (String): 个人简介图片 URL

#### 访问统计
- `public_profile_views_total` (Number): 累计展示次数
- `public_profile_views_unique` (Number): 独立访客数
- `public_profile_last_viewed_at` (String): 最近被访问时间

#### 隐私设置项
- `privacy_show_registered_date` (Boolean): 是否显示注册时间
- `privacy_show_role_badges` (Boolean): 是否显示角色阶级和标签
- `privacy_show_bio` (Boolean): 是否显示个人简介
- `privacy_show_stats` (Boolean): 是否显示订单统计
- `privacy_show_orders` (Boolean): 是否显示订单记录
- `privacy_show_country` (Boolean): 是否显示所在国家地区
- `privacy_show_last_login` (Boolean): 是否显示最近登录时间

#### 其他
- `last_login_at` (String): 最近登录时间

---

## 🔧 后端函数

### 1. validateHandle.js
**功能**: 验证 Handle 的格式和唯一性

**输入**:
```json
{
  "handle": "nekoyume"
}
```

**输出**:
```json
{
  "valid": true,
  "handle": "nekoyume"
}
```

**校验规则**:
- 格式校验：正则 `^(?=.*[a-z])[a-z0-9]{3,24}$`
- 保留词检查：admin, administrator, staff, mod 等
- 唯一性检查：全站唯一

### 2. updatePublicProfileSettings.js
**功能**: 更新用户隐私设置

**输入**:
```json
{
  "public_profile_enabled": true,
  "public_profile_bio": "这是我的简介",
  "public_profile_bio_image_url": "https://...",
  "privacy_show_registered_date": true,
  "privacy_show_role_badges": true,
  "privacy_show_bio": true,
  "privacy_show_stats": true,
  "privacy_show_orders": false,
  "privacy_show_country": false,
  "privacy_show_last_login": false
}
```

**输出**:
```json
{
  "success": true
}
```

### 3. getPublicProfile.js
**功能**: 获取公开资料页数据

**输入**:
```json
{
  "handle": "nekoyume"
}
```

**输出**:
```json
{
  "publicProfile": {
    "id": "user_id",
    "handle": "nekoyume",
    "avatar_url": "https://...",
    "display_name": "用户昵称",
    "email": "user@example.com",
    "member_tier_name": "会员等级",
    "roles": ["user"],
    "created_date": "2024-01-01",
    "public_profile_bio": "个人简介",
    "public_profile_bio_image_url": "https://...",
    "last_login_at": "2024-06-11",
    "stats": {
      "totalPaidJpy": 100000,
      "totalOrders": 10,
      "totalGoodsJpy": 90000,
      "totalServiceFeeJpy": 10000,
      "lastOrderDate": "2024-06-10"
    }
  }
}
```

**访问控制**:
1. 检查 `public_profile_enabled` 是否为 true
2. 检查访问者是否为管理员或同租户用户
3. 不符合条件时返回统一 404 错误

**统计更新**:
- 每次成功访问自动更新 `public_profile_views_total`
- 独立访客统计（基于用户 ID）
- 限流：同一用户 1 小时内重复访问不重复计数

---

## 🌐 路由设计

### 多语言路由前缀
所有路由增加 `{locale}` 前缀，支持：
- `zhcn` - 简体中文
- `zhtw` - 繁体中文
- `en` - 英文
- `ja` - 日文
- `ko` - 韩文
- `ms` - 马来文

### 路由规则

#### 1. 个人中心（私有）
```
/{locale}/mypage/me
```
示例：`/ja/mypage/me`

**访问权限**:
- 仅用户本人可访问
- 显示完整个人信息和所有管理功能

#### 2. 公开资料页（公开）
```
/{locale}/u/{handle}
```
示例：`/ja/u/nekoyume`

**访问权限**:
- 已登录用户可访问同租户的公开资料页
- 管理员可访问所有公开资料页
- 未公开的资料页返回 404

#### 3. 隐私设置页
```
/{locale}/settings/privacy
```
示例：`/ja/settings/privacy`

**访问权限**:
- 仅用户本人可访问
- 用于配置公开资料页和隐私选项

---

## 🎨 前端页面

### 1. PublicProfile.jsx
**路径**: `pages/PublicProfile.jsx`

**功能**:
- 展示用户公开资料
- 根据隐私设置动态显示/隐藏字段
- 显示订单统计（如果开启）
- 显示最近订单（如果开启且访问者有权限）

**展示字段**:
- ✅ 用户头像
- ✅ 用户昵称/Handle
- ✅ 会员等级
- ✅ 角色标签
- ✅ 个人简介（含图片）
- ✅ 注册时间（如果开启）
- ✅ 订单统计（如果开启）
- ✅ 最近登录时间（如果开启）
- ✅ 订单记录（如果开启且访问者有权限）

### 2. UserPrivacySettings.jsx
**路径**: `pages/UserPrivacySettings.jsx`

**功能**:
- 开启/关闭公开资料页
- 设置 Handle（带实时验证）
- 编辑个人简介
- 配置各隐私项开关
- 查看访问统计

---

## 🔒 安全与防护

### 1. 访问控制
- ✅ 租户隔离：只能访问同租户用户资料
- ✅ 权限检查：管理员可访问所有公开资料
- ✅ 隐私保护：未公开资料页返回统一 404

### 2. 防刷机制
- ✅ 访问频率限制：同一用户 1 小时内不重复计数
- ✅ 独立访客统计：基于用户 ID 去重
- ✅ 基础限流：后端函数自动去重

### 3. 数据白名单
- ✅ 只返回公开字段
- ✅ 不返回敏感信息（密码、邮箱验证状态等）
- ✅ 不返回内部 ID（除用户 ID 外）

### 4. Handle 保护
- ✅ 系统保留词保护
- ✅ 格式强制校验
- ✅ 唯一性保证
- ✅ 小写标准化

---

## 📊 使用流程

### 用户开启公开资料页

1. **进入隐私设置**
   - 路径：`/ja/settings/privacy`
   - 点击"隐私设置"入口

2. **开启公开资料页**
   - 打开"开启公开资料页"开关
   - 设置 Handle（如：nekoyume）
   - 点击"验证"按钮确认 Handle 可用

3. **填写个人简介**
   - 开启"显示个人简介"
   - 填写简介内容
   - （可选）上传简介图片

4. **配置隐私项**
   - 选择是否显示注册时间
   - 选择是否显示角色标签
   - 选择是否显示订单统计
   - 选择是否显示订单记录
   - 选择是否显示所在国家
   - 选择是否显示最近登录时间

5. **保存设置**
   - 点击"保存设置"
   - 系统自动验证并保存

6. **查看公开资料页**
   - 复制公开资料页链接
   - 分享给其他用户
   - 查看访问统计

### 其他用户访问公开资料页

1. **通过链接访问**
   - 点击公开资料页链接
   - 或手动输入 `/ja/u/{handle}`

2. **查看资料**
   - 查看公开的个人信息
   - 查看订单统计（如果开启）
   - 查看最近订单（如果开启且有权限）

---

## ⚠️ 注意事项

### 1. 多语言路由
- 当前实现中，路由中的 `{locale}` 仅作为占位符
- 实际应用中需要：
  - 创建语言切换组件
  - 保存用户语言偏好
  - 根据语言加载对应翻译

### 2. 订单统计计算
- 当前 `getPublicProfile.js` 中订单统计为简化版本
- 生产环境需要：
  - 计算真实的 `totalPaidJpy`、`totalOrders` 等
  - 添加缓存机制避免频繁查询
  - 考虑性能优化（如预计算）

### 3. 国家地区显示
- 当前未实现国家地区获取逻辑
- 需要从用户地址簿中获取默认地址的国家
- 建议新增 `UserAddress` 实体管理地址簿

### 4. Handle 修改限制
- 当前允许自由修改 Handle
- 建议增加限制：
  - 每 30 天只能修改一次
  - 或消耗积分/货币修改

### 5. 访问统计精确性
- 当前使用简单的时间戳去重
- 建议改进：
  - 使用 Redis 或缓存记录最近访问
  - 更精确的独立访客统计（基于 IP+UserAgent+UserID）

---

## 🚀 后续优化建议

### 阶段一（已完成）
- ✅ User 实体扩展
- ✅ 后端函数实现
- ✅ 前端页面实现
- ✅ 路由配置
- ✅ 基础访问控制

### 阶段二（建议）
- [ ] 订单统计真实计算
- [ ] 国家地区数据获取
- [ ] 多语言支持完整实现
- [ ] Handle 修改频率限制
- [ ] 访问统计优化

### 阶段三（增强）
- [ ] 公开资料页主题自定义
- [ ] 支持自定义 CSS
- [ ] 支持置顶展示订单
- [ ] 支持屏蔽特定用户
- [ ] 举报功能

### 阶段四（运营）
- [ ] Handle 交易市场
- [ ] 稀有 Handle 拍卖
- [ ] 认证标识（蓝 V 等）
- [ ] 资料页 SEO 优化

---

## 📝 系统保留词列表

完整列表见 `functions/validateHandle.js`：

```javascript
const RESERVED_WORDS = new Set([
  'admin', 'administrator', 'staff', 'mod', 'moderator', 'sysop', 'system',
  'support', 'help', 'security', 'official', 'root', 'api', 'auth', 'login',
  'logout', 'register', 'settings', 'mypage', 'me', 'user', 'users', 'torrent',
  'torrents', 'forum', 'forums', 'invite', 'rules', 'profile', 'profiles',
  'account', 'accounts', 'dashboard', 'admincp', 'staffcp', 'manage', 'management',
  'password', 'email', 'verify', 'reset', 'oauth', 'callback', 'static', 'assets',
  'cdn', 'uploads', 'images', 'zhcn', 'zhtw', 'zh', 'cn', 'tw', 'en', 'ja', 'jp',
  'ko', 'kr', 'ms', 'i18n', 'locale', 'lang', 'language'
]);
```

---

## ✅ 验收清单

- [x] User 实体字段完整
- [x] validateHandle 函数正常
- [x] updatePublicProfileSettings 函数正常
- [x] getPublicProfile 函数正常
- [x] PublicProfile 页面可访问
- [x] UserPrivacySettings 页面可访问
- [x] 路由配置正确
- [x] 访问控制逻辑正确
- [x] 隐私设置生效
- [x] Handle 验证生效
- [x] 访问统计记录

---

**实现人**: Base44 AI  
**实现时间**: 2026-06-11  
**版本**: v1.0