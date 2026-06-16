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
    
    // DEFAULT_SETTINGS descriptions
    serviceFeeRate: "服务费率 (%)",
    prepayRate: "预付款比率 (%)",
    prepayEnabled: "是否开启预付款",
    jpyUsdIncrement: "日元/美元汇率增量（叠加在平台增量之上）",
    jpyCnyIncrement: "日元/人民币汇率增量（叠加在平台增量之上）",
    defaultPackingFeeSingle: "默认单独发货捆包作业手续费 (JPY)",
    defaultPackingFeeConsolidation: "默认拼邮发货捆包手续费 (JPY)",
    transitLocationFeeSplitEnabled: "中转地手续费是否平分",
    allowShipWithoutPayment: "允许未付款时进入已发货状态（总开关）",
    allowShipWithoutPaymentSingle: "单独发货 - 允许未付款直接发货",
    allowShipWithoutPaymentUserPool: "用户拼邮发货 - 允许未付款直接发货",
    allowShipWithoutPaymentOfficialPool: "官方拼邮发货 - 允许未付款直接发货",
    fullpayOnceEnabled: "开启一次付款功能",
    fullpayOnceTolerance: "一次付款运费误差容忍值（JPY）",
    siteName: "网站名称",
    contactEmail: "联系邮箱",
    whatsapp: "WhatsApp",
    lineId: "Line ID",
    wechatId: "微信号",
    paidOrderReminder: "已付款订单的提示消息",
    adminContactInfo: "管理员联系方式（用于订单取消通知等）",
    alipayAccount: "支付宝账号",
    alipayAccountName: "支付宝收款人姓名",
    alipayQrUrl: "支付宝收款码图片 URL",
    alipayPaymentNote: "支付宝付款备注提示",
    
    // Category labels
    catFee: "费率设置",
    catPayment: "支付设置",
    catShipping: "运输设置",
    catGeneral: "基本信息",
    
    // LocalShippingTwoCol
    shippingMethodEditor: "运输方式编辑",
    shippingMethodEditorDesc: "点击右侧条目后在此编辑详情，或新增运输方式",
    shippingCompanyTree: "运输公司 & 方式排序",
    shippingCompanyTreeDesc: "管理运输公司分组及方式排列顺序",
    
    // CustomsHazmatTextEditor
    customsHazmatText: "危险物品确认文本（报关单）",
    customsHazmatTextDesc: "用户通知发货时，报关单中会显示此内容并要求用户勾选同意。支持 Markdown 格式。留空则不显示。",
    customsHazmatPlaceholder: "例：\\n## 危险物品确认\\n本次邮件中**不含**以下物品：\\n- 锂电池、液体、粉末",
    
    // Addons
    addonSettingsTitle: "增值服务设置",
    addonSettingsDesc: "下单增值服务在提交订单时展示，发货增值服务在通知发货/预出货时展示。",
    
    // Fee rules
    defaultFeeSettingsTitle: "默认服务费设置",
    defaultFeeSettingsDesc: "作为兜底规则：当订单未命中任何服务费规则时使用此处设置。也适合不需要复杂规则的轻量场景。",
    orderFeeRateLabel: "下单服务费率（%）",
    orderFeeRateDesc: "基于商品货款金额的百分比",
    orderFixedFeeLabel: "下单固定手续费（JPY）",
    orderFixedFeeDesc: "每笔订单额外收取的固定费用",
    feeCalculationNote: "最终服务费 = 货款 × 费率% + 固定手续费，再应用最低/封顶限制（如在规则中心配置）",
    feeRuleEngineTitle: "服务费规则引擎（高级）",
    feeRuleEngineDesc: "支持按客户等级、下单网站、金额阶梯及自定义公式设置差异化服务费，优先级高于上方默认设置。",
    enterFeeRuleCenter: "进入服务费规则中心",
    feeRuleCenterDesc: "在规则中心可以创建多条规则、设置生效时间和优先级、使用高级公式，并在保存前进行实时测试预览。",
    
    // Payment methods
    paymentMethodManagementTitle: "支付方式管理",
    paymentMethodManagementDesc: "支付宝自动支付的密钥可在添加后点击「密钥」按钮配置。",
    paymentPendingReminderTitle: "待付款页面提示",
    paymentPendingReminderDesc: "用户进入付款页时，显示在订单金额下方的提示文字。留空不显示。",
    paymentPendingPlaceholder: "请在付款截止日期前完成支付，以免订单被取消。",
    
    // Member tiers
    memberTierManagementTitle: "会员阶级管理",
    memberTierManagementDesc: "设置会员阶级，为不同等级用户配置记账功能和结帐规则。",
    creditApplicationSettingsTitle: "记账申请设置",
    creditApplicationSettingsDesc: "开启后，没有记账权限的普通用户可在个人设置中申请开启记账功能。",
    allowCreditApplicationLabel: "允许用户申请记账功能",
    allowCreditApplicationDesc: "开启后用户可在个人设置中提交记账申请",
    
    // Box templates
    boxTemplateManagementTitle: "外箱模板管理",
    boxTemplateManagementDesc: "管理员填写发货信息时可选取外箱，外箱自重和费用将计入发货记录。",
    
    // Countries
    countriesSettingsTitle: "国家·地区设置",
    countriesSettingsDesc: "控制哪些国家·地区出现在收货地址选框中，并设置显示顺序。置顶的国家在所有下拉框中优先显示。",
    
    // Storage
    storageFeatureDesc: "功能说明",
    storageModular: "模块化功能：",
    storageModularDesc: "管理员可选择开启或关闭库存管理功能。关闭后，相关设置和功能不再显示，不影响其他功能正常使用。",
    storagePeriod: "存放期限：",
    storagePeriodDesc: "从订单入库日开始计算，管理员可设置默认存放天数（默认 90 天）。",
    storageDeadline: "到期行为：",
    storageDeadlineDesc: "管理员可设置到期后自动执行的操作：发送提醒、追加仓储费用、更新订单状态为「已超时」。",
    storageFee: "仓储管理费：",
    storageFeeDesc: "可设置每日仓储费用，支持按外箱模板单独设置（优先级高于默认设置）。费用累计至运费结算时一并收取。",
    storageNotification: "通知模板：",
    storageNotificationDesc: "系统自动创建 3 个通知模板：即将到期通知、已到期通知、需要支付逾期费用通知。可在通知模板管理中自定义内容。",
    storageAutoCheck: "自动化检查：",
    storageAutoCheckDesc: "系统每日自动检查超期订单，执行管理员设置的操作（提醒、收费、变更状态）。",
    
    // Permissions
    permissionsTitle: "权限一览",
    permissionsDesc: "系统支持的所有权限项，可用于角色配置与用户权限覆写。",
    
    // Notifications
    notificationTemplateTitle: "通知模板管理",
    notificationTemplateDesc: "管理当前租户的通知模板，包括标题、内容模板和默认发送方式",
    notificationDefaultsTitle: "通知默认设置",
    notificationDefaultsDesc: "设置新用户的默认通知偏好，包括站内通知和邮件通知的开关",
    gmailSettingsTitle: "Gmail 邮箱设置",
    gmailSettingsDesc: "配置租户 Gmail 邮箱，用于发送通知邮件",
    smtpSettingsTitle: "SMTP 邮箱设置",
    smtpSettingsDesc: "配置自定义 SMTP 服务器发送通知邮件，支持所有主流邮箱服务商",
    
    // Reminder texts
    adminContactTitle: "管理员联系方式",
    adminContactDesc: "用于订单取消通知等场景，用户可联系的管理员信息",
    adminContactPlaceholder: "例如：微信：admin123 / Line: tokunyi / 邮箱：support@tongyi.com",
    adminContactNote: "此联系方式将显示在订单取消通知中，用户可通过此方式联系管理员处理退款等事宜",
    
    // Theme
    themeTitle: "界面主题",
    themeDesc: "选择网站整体视觉风格，设置仅对当前浏览器生效",
    
    // Home customize
    faqManagement: "帮助中心 · 问答内容管理",
    faqManagementDesc: "创建分类、编写问答内容（支持 Markdown），供主页 FAQ 区块和帮助中心页使用",
    
    // Transit methods
    transitFeeSplitTitle: "中转地手续费平分",
    transitFeeSplitDesc: "控制中转地手续费的计算方式",
    transitFeeSplitLabel: "中转地手续费平分",
    transitFeeSplitNote: "开启后，中转地的手续费将按重量比例平摊给参与拼邮的所有客户；关闭则每个客户单独计算一次中转地手续费",
    
    // Pickup location
    pickupLocationTitle: "自提地点设置",
    pickupLocationDesc: "独立管理自提取货地点，包括名称、手续费、说明及图片",
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
    
    // Addons
    addonName: "名称",
    addonDescription: "説明",
    addonFee: "費用",
    addonType: "タイプ",
    addonMinFee: "最低費用",
    addonMaxFee: "最高費用",
    addonUserCustomizable: "ユーザーカスタマイズ可能",
    addonOrder: "注文付加価値サービス",
    addonShipping: "発送付加価値サービス",
    addonActive: "有効",
    
    // Member tiers
    tierName: "階級名称",
    tierDescription: "階級説明",
    tierPrice: "価格 (JPY)",
    tierPermanent: "永久保有",
    tierPurchasable: "購入可能",
    tierTriggerEnabled: "自動アップグレード",
    tierCreditEnabled: "掛売機能",
    tierCreditLimit: "デフォルト掛売上限 (JPY)",
    tierCreditCycle: "決済サイクル",
    tierCreditOverdueDays: "延滞上限 (日)",
    
    // Storage
    storageEnabled: "在庫管理有効",
    defaultStorageDays: "デフォルト保管日数",
    defaultReminderDays: "事前通知日数",
    defaultStorageFeePerDay: "日次保管料 (JPY)",
    onDeadlineAction: "期限後アクション",
    deadlineStatus: "期限切れ注文ステータス",
    actionNothing: "アクションなし",
    actionMarkOverdue: "期限切れとしてマーク",
    actionChargeFee: "保管料を請求",
    
    // Notifications
    emailSender: "メール送信者",
    emailSenderPlaceholder: "例：noreply@example.com",
    smtpHost: "SMTP サーバー",
    smtpPort: "SMTP ポート",
    smtpSecure: "SSL/TLS を使用",
    smtpUsername: "SMTP ユーザー名",
    smtpPassword: "SMTP パスワード",
    testEmail: "テストメール",
    sendTestEmail: "テストメールを送信",
    
    // Payment
    alipayAccount: "アリペイアカウント",
    alipayAccountName: "アリペイ受取人名",
    alipayQrCode: "アリペイ QR コード",
    alipayPaymentNote: "アリペイ支払い備考ヒント",
    prepayEnabled: "前払い有効",
    prepayRate: "前払い比率 (%)",
    allowShipWithoutPayment: "未支払い発送を許可",
    fullpayOnceEnabled: "一回払い有効",
    fullpayOnceTolerance: "一回払い送料誤差許容値 (JPY)",
    
    // Shipping
    shippingMethodCode: "輸送方法コード",
    shippingMethodIcon: "アイコン",
    shippingMethodColor: "色",
    shippingMethodTransitDays: "配送日数",
    shippingMethodDescription: "説明",
    shippingMethodMinWeight: "最小重量 (g)",
    shippingMethodMaxWeight: "最大重量 (g)",
    shippingMethodRateMode: "料金モード",
    shippingMethodSimpleRate: "簡易料金",
    shippingMethodDetailedRate: "詳細料金",
    shippingMethodOfficialPoolEstimate: "公式拼郵估算料金",
    
    // Order management
    orderSplitEnabled: "注文分割有効",
    paymentTimeoutDays: "支払い期限日数",
    autoArchiveDeliveredDays: "配達済み自動アーカイブ (日)",
    
    // Home customization
    bannerEnabled: "バナー広告有効",
    heroSectionEnabled: "メインビジュアル有効",
    quickActionsEnabled: "クイックアクション有効",
    exchangeRateWidgetEnabled: "為替ウィジェット有効",
    stepsSectionEnabled: "フロー手順有効",
    logisticsStatusBoardEnabled: "物流ステータスボード有効",
    faqSectionEnabled: "FAQ セクション有効",
    
    // Exchange rates
    jpyUsdIncrement: "円/米ドル為替増分",
    jpyCnyIncrement: "円/人民元為替増分",
    navbarExchangeRateEnabled: "ナビゲーションバー為替表示",
    navbarExchangeRateCurrencies: "表示通貨",
    
    // Ticket orders
    ticketOrderEnabled: "チケット機能有効",
    ticketConfirmDeliveryEnabled: "到场確認機能",
    ticketSupplementEnabled: "追加支払い機能",
    
    // Permissions
    permissionName: "権限名称",
    permissionDescription: "権限説明",
    permissionModule: "権限モジュール",
    
    // Announcements
    announcementTitle: "お知らせタイトル",
    announcementContent: "お知らせ内容",
    announcementType: "お知らせタイプ",
    announcementTargetAudience: "対象ユーザー",
    announcementDisplayPosition: "表示位置",
    announcementExpiresAt: "有効期限",
    announcementDismissible: "閉じる可能",
    announcementAllowedPages: "許可ページ",
    
    // Countries
    countryName: "国名",
    countryCode: "国コード",
    countryEnabled: "有効",
    countrySortOrder: "排序",
    
    // Category labels
    catFee: "料金設定",
    catPayment: "支払い設定",
    catShipping: "輸送設定",
    catGeneral: "基本情報",
    
    // LocalShippingTwoCol
    shippingMethodEditor: "輸送方法編集",
    shippingMethodEditorDesc: "右側の項目をクリックして詳細を編集、または輸送方法を新規追加",
    shippingCompanyTree: "輸送会社＆方法排序",
    shippingCompanyTreeDesc: "輸送会社のグループ化と方法の並べ替えを管理",
    
    // CustomsHazmatTextEditor
    customsHazmatText: "危険物品確認テキスト（申告書）",
    customsHazmatTextDesc: "発送通知時、申告書に表示され、ユーザーが同意をチェックする内容。Markdown 形式対応。空欄の場合は表示されません。",
    customsHazmatPlaceholder: "例：\\n## 危険物品確認\\n今回のメールには**含まれていません**：\\n- リチウム電池、液体、粉末",
    
    // Addons
    addonSettingsTitle: "付加価値サービス設定",
    addonSettingsDesc: "注文付加価値サービスは注文提出時に表示、発送付加価値サービスは発送通知/予想出荷時に表示。",
    
    // Fee rules
    defaultFeeSettingsTitle: "デフォルトサービス料設定",
    defaultFeeSettingsDesc: "バックアップルール：注文がサービス料ルールにヒットしない場合に使用。複雑なルールが不要な軽量シーンにも適しています。",
    orderFeeRateLabel: "注文サービス料率 (%)",
    orderFeeRateDesc: "商品代金金額に基づく百分比",
    orderFixedFeeLabel: "注文固定手数料 (JPY)",
    orderFixedFeeDesc: "注文ごとに追加徴収される固定費用",
    feeCalculationNote: "最終サービス料 = 商品代金 × 料率% + 固定手数料、その後最低/上限制限を適用（ルールセンターで設定の場合）",
    feeRuleEngineTitle: "サービス料ルールエンジン（高級）",
    feeRuleEngineDesc: "顧客等級、注文サイト、金額階段、カスタム数式による差異化サービス料を設定可能。上記デフォルト設定より優先度が高い。",
    enterFeeRuleCenter: "サービス料ルールセンターへ",
    feeRuleCenterDesc: "ルールセンターでは複数のルール作成、有効時間と優先度の設定、高級数式の使用、保存前のリアルタイムテストプレビューが可能。",
    
    // Payment methods
    paymentMethodManagementTitle: "支払い方法管理",
    paymentMethodManagementDesc: "アリペイ自動支払いの鍵は追加後「鍵」ボタンをクリックして設定。",
    paymentPendingReminderTitle: "支払い待機ページヒント",
    paymentPendingReminderDesc: "ユーザーが支払いページに入った時、注文金額の下に表示するヒントテキスト。空欄の場合は表示されません。",
    paymentPendingPlaceholder: "支払い期限日までに支払いを完了し、注文キャンセルを避けてください。",
    
    // Member tiers
    memberTierManagementTitle: "会員階級管理",
    memberTierManagementDesc: "会員階級を設定し、異なる等級のユーザーに掛売機能と決済ルールを付与。",
    creditApplicationSettingsTitle: "掛売申請設定",
    creditApplicationSettingsDesc: "有効化後、掛売権限のない通常ユーザーは個人設定で掛売機能の申請が可能。",
    allowCreditApplicationLabel: "ユーザーの掛売申請を許可",
    allowCreditApplicationDesc: "有効化後ユーザーは個人設定で掛売申請を提出可能",
    
    // Box templates
    boxTemplateManagementTitle: "外箱テンプレート管理",
    boxTemplateManagementDesc: "管理者が発送情報入力時に外箱を選択可能。外箱自重と費用は発送記録に計上。",
    
    // Countries
    countriesSettingsTitle: "国・地域設定",
    countriesSettingsDesc: "荷物受取住所選択枠に表示する国・地域を制御し、表示順序を設定。トップの国がすべてのドロップダウンで優先表示。",
    
    // Storage
    storageFeatureDesc: "機能説明",
    storageModular: "モジュール機能：",
    storageModularDesc: "管理者は在庫管理機能の有効化/無効化を選択可能。無効化後、関連設定と機能は表示されず、他の機能の通常使用に影響しません。",
    storagePeriod: "保管期限：",
    storagePeriodDesc: "注文入庫日から計算、管理者はデフォルト保管日数を設定可能（デフォルト 90 日）。",
    storageDeadline: "期限後アクション：",
    storageDeadlineDesc: "管理者は期限後に自動実行するアクションを設定：通知送信、保管費用追加、注文ステータスを「期限切れ」に更新。",
    storageFee: "保管管理費：",
    storageFeeDesc: "日次保管費用を設定可能、外箱テンプレートごとに個別設定も対応（デフォルト設定より優先）。費用は送料精算時に一括徴収。",
    storageNotification: "通知テンプレート：",
    storageNotificationDesc: "システムは自動的に 3 つの通知テンプレートを作成：期限接近通知、期限切れ通知、延滞費用支払い必要通知。通知テンプレート管理で内容をカスタマイズ可能。",
    storageAutoCheck: "自動化チェック：",
    storageAutoCheckDesc: "システムは毎日自動的に期限切れ注文をチェックし、管理者が設定したアクションを実行（通知、費用請求、ステータス変更）。",
    
    // Permissions
    permissionsTitle: "権限一覧",
    permissionsDesc: "システムがサポートするすべての権限項目。ロール設定とユーザー権限オーバーライドに使用可能。",
    
    // Notifications
    notificationTemplateTitle: "通知テンプレート管理",
    notificationTemplateDesc: "現在のテナントの通知テンプレートを管理。タイトル、内容テンプレート、デフォルト送信方式を含む",
    notificationDefaultsTitle: "通知デフォルト設定",
    notificationDefaultsDesc: "新規ユーザーのデフォルト通知嗜好を設定。サイト内通知とメール通知のスイッチを含む",
    gmailSettingsTitle: "Gmail メール設定",
    gmailSettingsDesc: "テナント Gmail メールボックスを設定。通知メール送信に使用",
    smtpSettingsTitle: "SMTP メール設定",
    smtpSettingsDesc: "カスタム SMTP サーバーを設定して通知メールを送信。すべての主流メールサービスプロバイダーをサポート",
    
    // Reminder texts
    adminContactTitle: "管理者連絡先",
    adminContactDesc: "注文キャンセル通知などのシーンで使用。ユーザーが管理者に連絡できる情報",
    adminContactPlaceholder: "例：WeChat: admin123 / Line: tokunyi / メール：support@tongyi.com",
    adminContactNote: "この連絡先は注文キャンセル通知に表示され、ユーザーはこの方法で管理者に連絡して返金などの処理を行う",
    
    // Theme
    themeTitle: "インターフェーステーマ",
    themeDesc: "サイト全体の視覚スタイルを選択。設定は現在のブラウザにのみ有効",
    
    // Home customize
    faqManagement: "ヘルプセンター · 質問回答内容管理",
    faqManagementDesc: "カテゴリ作成、質問回答内容作成（Markdown 対応）。ホーム FAQ セクションとヘルプセンターページで使用",
    
    // Transit methods
    transitFeeSplitTitle: "中継地手数料按分",
    transitFeeSplitDesc: "中継地手数料の計算方式を制御",
    transitFeeSplitLabel: "中継地手数料按分",
    transitFeeSplitNote: "有効化後、中継地の手数料は重量比例で拼郵に参加するすべての顧客に按分。無効化後は各顧客ごとに中継地手数料を個別計算",
    
    // Pickup location
    pickupLocationTitle: "自己受取場所設定",
    pickupLocationDesc: "自己受取荷受場所を個別管理。名称、手数料、説明、画像を含む",
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