/**
 * 设置页面翻译辅助
 */

import { t, getLocale } from "@/lib/i18n";

export function getSettingTranslations() {
  const locale = getLocale();
  
  return {
    // 页面标题
    pageTitle: t("网站后台设置", locale),
    noAccess: t("仅管理员可访问此页面", locale),
    
    // 导航分类
    navBasic: t("基本设置", locale),
    navOrder: t("订单管理", locale),
    navShipping: t("发货设置", locale),
    navAdminPages: t("管理页面入口", locale),
    
    // 导航项
    homeCustomize: t("主页自定义", locale),
    countries: t("国家·地区设置", locale),
    exchangeRates: t("汇率设置", locale),
    notifications: t("通知设置", locale),
    reminderTexts: t("提醒文案", locale),
    theme: t("界面主题", locale),
    orderManagement: t("商城标签规则", locale),
    orderSplit: t("订单管理", locale),
    ticketOrders: t("票务功能", locale),
    paymentMethods: t("支付方式", locale),
    addons: t("增值服务", locale),
    feeRules: t("服务费规则", locale),
    memberTiers: t("会员阶级", locale),
    shippingMethods: t("国际运输方式", locale),
    localShipping: t("本地运输方式", locale),
    transitMethods: t("中转运输", locale),
    itemSizes: t("物品尺寸", locale),
    boxTemplates: t("外箱模板", locale),
    storage: t("库存存放", locale),
    officialPool: t("官方拼邮", locale),
    permissions: t("权限一览", locale),
    announcements: t("公告管理", locale),
    navbar: t("导航栏设置", locale),
    users: t("用户管理", locale),
    
    // 通用操作
    save: t("保存", locale),
    saving: t("保存中...", locale),
    saved: t("已保存 ✓", locale),
    loading: t("加载中...", locale),
    edit: t("编辑", locale),
    delete: t("删除", locale),
    add: t("新增", locale),
    
    // 费率设置
    defaultFeeSettings: t("默认服务费设置", locale),
    orderFeeRate: t("下单服务费率（%）", locale),
    orderFixedFee: t("下单固定手续费（JPY）", locale),
    feeRuleEngine: t("服务费规则引擎（高级）", locale),
    enterFeeRuleCenter: t("进入服务费规则中心", locale),
    
    // 支付方式
    paymentMethodManagement: t("支付方式管理", locale),
    paymentPendingReminder: t("待付款页面提示", locale),
    
    // 会员阶级
    memberTierManagement: t("会员阶级管理", locale),
    creditApplicationSettings: t("记账申请设置", locale),
    allowCreditApplication: t("允许用户申请记账功能", locale),
    
    // 运输设置
    transitFeeSplit: t("中转地手续费平分", locale),
    boxTemplateManagement: t("外箱模板管理", locale),
    
    // 通知设置
    notificationTemplateManagement: t("通知模板管理", locale),
    notificationDefaults: t("通知默认设置", locale),
    gmailSettings: t("Gmail 邮箱设置", locale),
    smtpSettings: t("SMTP 邮箱设置", locale),
    
    // 其他
    adminContact: t("管理员联系方式", locale),
    featureDescription: t("功能说明", locale),
    shippingEditor: t("运输方式编辑", locale),
    shippingTree: t("运输公司 & 方式排序", locale),
    hazmatText: t("危险物品确认文本（报关单）", locale),
  };
}