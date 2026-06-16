/**
 * Settings page translations
 * Centralized translation keys for AdminSettings page
 */

export const SETTINGS_TRANSLATIONS = {
  zh: {
    // Page title
    pageTitle: "网站后台设置",
    noAccess: "仅管理员可访问此页面",
    
    // Navigation groups
    navBasic: "基本设置",
    navOrder: "订单管理",
    navShipping: "发货设置",
    navAdminPages: "管理页面入口",
    
    // Navigation items
    homeCustomize: "主页自定义",
    countries: "国家·地区设置",
    exchangeRates: "汇率设置",
    notifications: "通知设置",
    reminderTexts: "提醒文案",
    theme: "界面主题",
    orderManagement: "商城标签规则",
    orderSplit: "订单管理",
    ticketOrders: "票务功能",
    paymentMethods: "支付方式",
    addons: "增值服务",
    feeRules: "服务费规则",
    memberTiers: "会员阶级",
    shippingMethods: "国际运输方式",
    localShipping: "本地运输方式",
    transitMethods: "中转运输",
    itemSizes: "物品尺寸",
    boxTemplates: "外箱模板",
    storage: "库存存放",
    officialPool: "官方拼邮",
    permissions: "权限一览",
    announcements: "公告管理",
    navbar: "导航栏设置",
    users: "用户管理",
    
    // Actions
    save: "保存",
    saving: "保存中...",
    saved: "已保存 ✓",
    loading: "加载中...",
    edit: "编辑",
    delete: "删除",
    add: "新增",
    cancel: "取消",
    confirm: "确认",
    enterManagement: "进入管理",
    
    // Fee settings
    defaultFeeSettings: "默认服务费设置",
    orderFeeRate: "下单服务费率（%）",
    orderFixedFee: "下单固定手续费（JPY）",
    feeRuleEngine: "服务费规则引擎（高级）",
    enterFeeRuleCenter: "进入服务费规则中心",
    
    // Payment
    paymentMethodManagement: "支付方式管理",
    paymentPendingReminder: "待付款页面提示",
    
    // Member tiers
    memberTierManagement: "会员阶级管理",
    creditApplicationSettings: "记账申请设置",
    allowCreditApplication: "允许用户申请记账功能",
    
    // Shipping
    transitFeeSplit: "中转地手续费平分",
    boxTemplateManagement: "外箱模板管理",
    
    // Notifications
    notificationTemplateManagement: "通知模板管理",
    notificationDefaults: "通知默认设置",
    gmailSettings: "Gmail 邮箱设置",
    smtpSettings: "SMTP 邮箱设置",
    
    // Other
    adminContact: "管理员联系方式",
    featureDescription: "功能说明",
    shippingEditor: "运输方式编辑",
    shippingTree: "运输公司 & 方式排序",
    hazmatText: "危险物品确认文本（报关单）",
    
    // Addons
    addonName: "名称",
    addonDescription: "描述",
    addonFee: "费用",
    addonType: "类型",
    addonMinFee: "最低费用",
    addonMaxFee: "最高费用",
    addonUserCustomizable: "用户可自定义",
    addonOrder: "下单增值服务",
    addonShipping: "发货增值服务",
    addonActive: "启用",
    
    // Member tiers
    tierName: "阶级名称",
    tierDescription: "阶级描述",
    tierPrice: "价格 (JPY)",
    tierPermanent: "永久保留",
    tierPurchasable: "允许购买",
    tierTriggerEnabled: "自动升级触发",
    tierCreditEnabled: "记账功能",
    tierCreditLimit: "默认欠款上限 (JPY)",
    tierCreditCycle: "结账周期",
    tierCreditOverdueDays: "逾期上限 (天)",
    
    // Storage
    storageEnabled: "开启库存管理",
    defaultStorageDays: "默认存放天数",
    defaultReminderDays: "提前提醒天数",
    defaultStorageFeePerDay: "每日仓储费 (JPY)",
    onDeadlineAction: "到期后操作",
    deadlineStatus: "超期订单状态",
    actionNothing: "无操作",
    actionMarkOverdue: "标记为超期",
    actionChargeFee: "收取仓储费",
    
    // Notifications
    emailSender: "邮件发件人",
    emailSenderPlaceholder: "例如：noreply@example.com",
    smtpHost: "SMTP 服务器",
    smtpPort: "SMTP 端口",
    smtpSecure: "使用 SSL/TLS",
    smtpUsername: "SMTP 用户名",
    smtpPassword: "SMTP 密码",
    testEmail: "测试邮件",
    sendTestEmail: "发送测试邮件",
    
    // Payment
    alipayAccount: "支付宝账号",
    alipayAccountName: "支付宝收款人姓名",
    alipayQrCode: "支付宝收款码",
    alipayPaymentNote: "支付宝付款备注提示",
    prepayEnabled: "开启预付款",
    prepayRate: "预付款比率 (%)",
    allowShipWithoutPayment: "允许未付款发货",
    fullpayOnceEnabled: "开启一次付款",
    fullpayOnceTolerance: "一次付款运费误差容忍值 (JPY)",
    
    // Shipping
    shippingMethodCode: "运输方式代码",
    shippingMethodIcon: "图标",
    shippingMethodColor: "颜色",
    shippingMethodTransitDays: "时效",
    shippingMethodDescription: "描述",
    shippingMethodMinWeight: "最小重量 (g)",
    shippingMethodMaxWeight: "最大重量 (g)",
    shippingMethodRateMode: "费率模式",
    shippingMethodSimpleRate: "简易费率",
    shippingMethodDetailedRate: "详细费率",
    shippingMethodOfficialPoolEstimate: "官方拼邮估算费率",
    
    // Order management
    orderSplitEnabled: "开启订单拆分",
    paymentTimeoutDays: "付款超期天数",
    autoArchiveDeliveredDays: "自动归档已送达订单 (天)",
    
    // Home customization
    bannerEnabled: "开启横幅广告",
    heroSectionEnabled: "开启主页主视觉区",
    quickActionsEnabled: "开启快捷操作",
    exchangeRateWidgetEnabled: "开启汇率小组件",
    stepsSectionEnabled: "开启流程步骤",
    logisticsStatusBoardEnabled: "开启物流状态板",
    faqSectionEnabled: "开启 FAQ 区块",
    
    // Exchange rates
    jpyUsdIncrement: "日元/美元汇率增量",
    jpyCnyIncrement: "日元/人民币汇率增量",
    navbarExchangeRateEnabled: "导航栏汇率显示",
    navbarExchangeRateCurrencies: "显示币种",
    
    // Ticket orders
    ticketOrderEnabled: "开启票务功能",
    ticketConfirmDeliveryEnabled: "确认到场功能",
    ticketSupplementEnabled: "补款功能",
    
    // Permissions
    permissionName: "权限名称",
    permissionDescription: "权限描述",
    permissionModule: "权限模块",
    
    // Announcements
    announcementTitle: "公告标题",
    announcementContent: "公告内容",
    announcementType: "公告类型",
    announcementTargetAudience: "目标受众",
    announcementDisplayPosition: "显示位置",
    announcementExpiresAt: "过期日期",
    announcementDismissible: "可关闭",
    announcementAllowedPages: "允许页面",
    
    // Countries
    countryName: "国家名称",
    countryCode: "国家代码",
    countryEnabled: "启用",
    countrySortOrder: "排序",
  },
  
  ja: {
    // Page title
    pageTitle: "サイトバックヤード設定",
    noAccess: "管理者のみアクセス可能",
    
    // Navigation groups
    navBasic: "基本設定",
    navOrder: "注文管理",
    navShipping: "発送設定",
    navAdminPages: "管理ページエントリー",
    
    // Navigation items
    homeCustomize: "ホームカスタマイズ",
    countries: "国・地域設定",
    exchangeRates: "為替設定",
    notifications: "通知設定",
    reminderTexts: "リマインダー文言",
    theme: "インターフェーステーマ",
    orderManagement: "モールタグルール",
    orderSplit: "注文管理",
    ticketOrders: "チケット機能",
    paymentMethods: "支払い方法",
    addons: "付加価値サービス",
    feeRules: "サービス料ルール",
    memberTiers: "会員階級",
    shippingMethods: "国際輸送方法",
    localShipping: "ローカル輸送方法",
    transitMethods: "中継輸送",
    itemSizes: "物品サイズ",
    boxTemplates: "外箱テンプレート",
    storage: "在庫保管",
    officialPool: "公式拼郵",
    permissions: "権限一覧",
    announcements: "お知らせ管理",
    navbar: "ナビゲーション設定",
    users: "ユーザー管理",
    
    // Actions
    save: "保存",
    saving: "保存中...",
    saved: "保存済み ✓",
    loading: "読み込み中...",
    edit: "編集",
    delete: "削除",
    add: "追加",
    cancel: "キャンセル",
    confirm: "確認",
    enterManagement: "管理へ",
    
    // Fee settings
    defaultFeeSettings: "デフォルトサービス料設定",
    orderFeeRate: "注文サービス料率 (%)",
    orderFixedFee: "注文固定手数料 (JPY)",
    feeRuleEngine: "サービス料ルールエンジン（高級）",
    enterFeeRuleCenter: "サービス料ルールセンターへ",
    
    // Payment
    paymentMethodManagement: "支払い方法管理",
    paymentPendingReminder: "支払い待機ページヒント",
    
    // Member tiers
    memberTierManagement: "会員階級管理",
    creditApplicationSettings: "掛売申請設定",
    allowCreditApplication: "ユーザーの掛売申請を許可",
    
    // Shipping
    transitFeeSplit: "中継地手数料按分",
    boxTemplateManagement: "外箱テンプレート管理",
    
    // Notifications
    notificationTemplateManagement: "通知テンプレート管理",
    notificationDefaults: "通知初期設定",
    gmailSettings: "Gmail メール設定",
    smtpSettings: "SMTP メール設定",
    
    // Other
    adminContact: "管理者連絡先",
    featureDescription: "機能説明",
    shippingEditor: "輸送方法編集",
    shippingTree: "輸送会社＆方法排序",
    hazmatText: "危険物品確認テキスト（申告書）",
  },
  
  en: {
    // Page title
    pageTitle: "Admin Settings",
    noAccess: "Admin access only",
    
    // Navigation groups
    navBasic: "Basic Settings",
    navOrder: "Order Management",
    navShipping: "Shipping Settings",
    navAdminPages: "Admin Pages",
    
    // Navigation items
    homeCustomize: "Home Customization",
    countries: "Countries & Regions",
    exchangeRates: "Exchange Rates",
    notifications: "Notifications",
    reminderTexts: "Reminder Texts",
    theme: "Theme",
    orderManagement: "Store Tag Rules",
    orderSplit: "Order Management",
    ticketOrders: "Ticket Orders",
    paymentMethods: "Payment Methods",
    addons: "Value-added Services",
    feeRules: "Service Fee Rules",
    memberTiers: "Member Tiers",
    shippingMethods: "International Shipping",
    localShipping: "Local Shipping",
    transitMethods: "Transit Shipping",
    itemSizes: "Item Sizes",
    boxTemplates: "Box Templates",
    storage: "Storage",
    officialPool: "Official Consolidation",
    permissions: "Permissions",
    announcements: "Announcements",
    navbar: "Navigation Bar",
    users: "User Management",
    
    // Actions
    save: "Save",
    saving: "Saving...",
    saved: "Saved ✓",
    loading: "Loading...",
    edit: "Edit",
    delete: "Delete",
    add: "Add",
    cancel: "Cancel",
    confirm: "Confirm",
    enterManagement: "Enter Management",
    
    // Fee settings
    defaultFeeSettings: "Default Service Fee",
    orderFeeRate: "Order Fee Rate (%)",
    orderFixedFee: "Order Fixed Fee (JPY)",
    feeRuleEngine: "Service Fee Rule Engine (Advanced)",
    enterFeeRuleCenter: "Enter Fee Rule Center",
    
    // Payment
    paymentMethodManagement: "Payment Methods",
    paymentPendingReminder: "Payment Pending Reminder",
    
    // Member tiers
    memberTierManagement: "Member Tiers",
    creditApplicationSettings: "Credit Application",
    allowCreditApplication: "Allow Credit Application",
    
    // Shipping
    transitFeeSplit: "Transit Fee Split",
    boxTemplateManagement: "Box Templates",
    
    // Notifications
    notificationTemplateManagement: "Notification Templates",
    notificationDefaults: "Notification Defaults",
    gmailSettings: "Gmail Settings",
    smtpSettings: "SMTP Settings",
    
    // Other
    adminContact: "Admin Contact",
    featureDescription: "Feature Description",
    shippingEditor: "Shipping Method Editor",
    shippingTree: "Shipping Companies & Order",
    hazmatText: "Hazardous Materials Text",
  },
};

/**
 * Get translation by key
 * @param {string} key - Translation key
 * @param {string} locale - Locale (zh, ja, en)
 * @returns {string} Translated text
 */
export function t(key, locale = 'zh') {
  return SETTINGS_TRANSLATIONS[locale]?.[key] || SETTINGS_TRANSLATIONS.zh[key] || key;
}