// Canonical permissions preset — used for display in AdminSettings and PlatformAdminSettings
// Each category contains a list of permissions; permissions may have `children` for visual nesting.

export const PERMISSIONS_PRESET = [
  {
    category: "下单",
    color: "bg-blue-100 text-blue-700",
    permissions: [
      {
        name: "order:submit_purchase_request",
        display_name: "可提交购买需求",
        description: "取消则无法提交购买需求创建新订单",
        children: [
          {
            name: "order:submit_group_buy_request",
            display_name: "可提交拼下单",
            description: "取消则不可发起或加入拼下单申请"
          },
          {
            name: "order:submit_group_buy_template",
            display_name: "可添加拼下单店铺模板",
            description: "取消则不可提交拼下单店铺模板（供管理员审核）"
          }
        ]
      },
      {
        name: "order:submit_split_request",
        display_name: "可提交分单申请",
        description: "可在商品链接框中使用分割线以提交需要分割多批入库的购买需求"
      }
    ]
  },
  {
    category: "中转发货",
    color: "bg-indigo-100 text-indigo-700",
    permissions: [
      {
        name: "shipping:view_transit_panel",
        display_name: "可见中转面板",
        description: "可看见中转地发货面板及中转地工作面板并编辑",
        children: [
          {
            name: "shipping:edit_transit_pool",
            display_name: "可编辑中转包裹",
            description: "可查看所有拼邮到中转地或单独发货到中转地以及发货申请中的包裹信息并编辑"
          }
        ]
      }
    ]
  },
  {
    category: "发货",
    color: "bg-teal-100 text-teal-700",
    permissions: [
      {
        name: "shipping:notify_shipment",
        display_name: "可通知发货",
        description: "取消则无法通知发货",
        children: [
          {
            name: "shipping:direct_shipment",
            display_name: "可直接发货",
            description: "可提交单独发往收货地址的发货申请"
          },
          {
            name: "shipping:consolidate_to_transit",
            display_name: "可拼邮到中转地",
            description: "可提交申请以拼邮到中转地"
          },
          {
            name: "shipping:consolidate_to_other_address",
            display_name: "可拼邮到其它地址",
            description: "可提交申请以拼邮到其它地址"
          }
        ]
      },
      {
        name: "shipping:request_rewarehouse",
        display_name: "可申请再入库",
        description: "可对已提交发货申请的订单申请再入库"
      },
      {
        name: "shipping:international_shipment",
        display_name: "可国际发货",
        description: "可在发货申请详情中查看到管理员操作并填写信息发货",
        children: [
          {
            name: "shipping:direct_international_shipment",
            display_name: "可单独发货（国际）",
            description: "单独的发货申请，可在发货申请详情中查看到管理员操作并填写信息发货"
          },
          {
            name: "shipping:consolidated_international_shipment",
            display_name: "可拼邮发货（国际）",
            description: "用户拼邮的发货申请，可在发货申请详情中查看到管理员操作并填写信息发货"
          },
          {
            name: "shipping:official_consolidated_international_shipment",
            display_name: "可官方拼邮发货（国际）",
            description: "待官方拼邮发货完善后再追加细化"
          }
        ]
      },

      {
        name: "shipping:edit_shipment_request",
        display_name: "可编辑发货申请",
        description: "可编辑发货申请标题、计划发货日期、备注等"
      },
      {
        name: "shipping:edit_package",
        display_name: "可编辑包裹",
        description: "可编辑单个发货申请中的包裹，移动到其它发货申请或重新入库"
      },
      {
        name: "shipping:delete_shipment_request",
        display_name: "可删除发货申请",
        description: "可以删除一个发货申请",
        children: [
          {
            name: "shipping:delete_direct_shipment",
            display_name: "可删除单独发货",
            description: "可以删除单独发货的发货申请"
          },
          {
            name: "shipping:delete_user_consolidated_shipment",
            display_name: "可删除用户拼邮发货",
            description: "可以删除用户拼邮发货的发货申请"
          },
          {
            name: "shipping:delete_official_consolidated_shipment",
            display_name: "可删除官方拼邮发货",
            description: "可以删除官方拼邮发货的发货申请"
          }
        ]
      },
      {
        name: "shipping:manage_transit_locations",
        display_name: "可管理中转地",
        description: "可添加新的中转地，可编辑已有中转地"
      }
    ]
  },
  {
    category: "留言",
    color: "bg-purple-100 text-purple-700",
    permissions: [
      {
        name: "message:send_message",
        display_name: "可发送留言",
        description: "取消则不可发送留言信息",
        children: [
          {
            name: "message:send_order_message",
            display_name: "可发送订单留言",
            description: "取消则不可在单个订单中留言"
          },
          {
            name: "message:send_shipping_message",
            display_name: "可发送发货申请留言",
            description: "取消则不可在发货申请中留言"
          },
          {
            name: "message:send_image",
            display_name: "可传送图片",
            description: "取消则不可在留言中传送图片"
          },
          {
            name: "message:send_profile_comment",
            display_name: "可在个人资料页留言",
            description: "关闭则不可在他人公开资料页留言"
          }
        ]
      }
    ]
  },
  {
    category: "付款",
    color: "bg-green-100 text-green-700",
    permissions: [
      {
        name: "payment:self_pay",
        display_name: "可自助付款",
        description: "可使用自动回调付款方式"
      },
      {
        name: "payment:manual_pay",
        display_name: "可手动付款",
        description: "可使用手动确认付款方式"
      },
      {
        name: "payment:pay_jpy",
        display_name: "可付日元",
        description: "可使用支付货币单位为JPY的支付方式"
      },
      {
        name: "payment:apply_credit",
        display_name: "可记账",
        description: "可申请记账付款"
      },
      {
        name: "payment:deferred_pay",
        display_name: "可后付款",
        description: "可使用后付款功能"
      },
      {
        name: "payment:pre_pay",
        display_name: "可预付款",
        description: "可使用预付款功能"
      },
      {
        name: "payment:pay_full_amount",
        display_name: "可付全款",
        description: "可使用全额付款功能"
      },
      {
        name: "payment:skip_proof_upload",
        display_name: "可不传凭证",
        description: "可跳过付款凭证上传直接点击已付款按钮完成付款"
      }
    ]
  },
  {
    category: "订单管理",
    color: "bg-orange-100 text-orange-700",
    permissions: [
      {
        name: "order:archive_order",
        display_name: "可存档订单",
        description: "若设置不可则个人档案页自动存档设置也失效"
      },
      {
        name: "order:edit_order",
        display_name: "可编辑订单",
        description: "可打开订单编辑面板进行编辑",
        children: [
          {
            name: "order:edit_order_status",
            display_name: "可编辑订单状态",
            description: "可编辑订单的状态"
          },
          {
            name: "order:edit_order_amount",
            display_name: "可编辑金额",
            description: "可编辑订单的金额相关数据"
          }
        ]
      },
      {
        name: "order:place_order",
        display_name: "可下单",
        description: "可对待下单状态的订单进行下单操作（可在订单详情上传下单截图，更新订单状态已下单）"
      },
      {
        name: "order:warehouse_in",
        display_name: "可入库",
        description: "可对待入库状态的订单进行入库操作"
      }
    ]
  },
  {
    category: "个人档案页",
    color: "bg-pink-100 text-pink-700",
    permissions: [
      {
        name: "profile:change_display_name",
        display_name: "可改名",
        description: "默认第一次设置后的更改都需要申请等候管理员允许",
        children: [
          {
            name: "profile:change_display_name_anytime",
            display_name: "可随时改名",
            description: "开启则更改显示名称无需经过管理员允许"
          }
        ]
      },
      {
        name: "profile:change_avatar",
        display_name: "可改头像",
        description: "取消则不可更改头像"
      },
      {
        name: "profile:change_auto_archive_settings",
        display_name: "可改自动存档设置",
        description: "取消则不可更改自动存档设置"
      }
    ]
  },
  {
    category: "查看",
    color: "bg-gray-100 text-gray-700",
    permissions: [
      {
        name: "view:other_user_consolidation_pool",
        display_name: "可查看他人拼邮",
        description: "取消则不显示用户拼邮"
      },
      {
        name: "view:official_consolidation_kanban",
        display_name: "可查看官方拼邮看板",
        description: "取消则不显示官方拼邮看板"
      },
      {
        name: "view:my_orders_module",
        display_name: "可查看我的订单",
        description: "取消则不显示我的订单模块"
      },
      {
        name: "view:admin_dashboard",
        display_name: "可查看管理总览",
        description: "取消则无法查看管理总览页"
      },
      {
        name: "view:order_management_page",
        display_name: "可查看订单管理",
        description: "取消则无法查看订单管理页"
      },
      {
        name: "view:user_management_page",
        display_name: "可查看用户管理",
        description: "取消则无法查看用户管理页"
      },
      {
        name: "view:announcement_management_page",
        display_name: "可查看公告管理",
        description: "取消则无法查看公告管理页"
      }
    ]
  },
  {
    category: "增值服务",
    color: "bg-yellow-100 text-yellow-700",
    permissions: [
      {
        name: "addon:select_value_added_services",
        display_name: "可选增值服务",
        description: "取消则无法选取增值服务",
        children: [
          {
            name: "addon:select_order_value_added_services",
            display_name: "可选择下单增值服务",
            description: "取消则无法选取下单增值服务"
          },
          {
            name: "addon:select_shipping_value_added_services",
            display_name: "可选择发货增值服务",
            description: "取消则无法选取发货增值服务"
          }
        ]
      }
    ]
  },
  {
    category: "用户",
    color: "bg-red-100 text-red-700",
    permissions: [
      {
        name: "user:edit_user_permissions",
        display_name: "可编辑用户权限",
        description: "包括用户权限分配、角色分配"
      },
      {
        name: "user:audit_credit_application",
        display_name: "可审核记账",
        description: "可完全管理用户的记账申请"
      },
      {
        name: "user:add_disable_user",
        display_name: "可添加停用用户",
        description: "可添加一个新用户或设置停用已有用户"
      },
      {
        name: "user:delete_user",
        display_name: "可删除用户",
        description: "可以删除任一没有删除用户权限的用户"
      },
      {
        name: "role:edit_role",
        display_name: "可编辑角色",
        description: "可创建或修改或停用或删除角色"
      }
    ]
  },
  {
    category: "公告",
    color: "bg-blue-100 text-blue-700",
    permissions: [
      {
        name: "announcement:create_announcement",
        display_name: "可新增公告",
        description: "可以新发布公告"
      },
      {
        name: "announcement:edit_announcement",
        display_name: "可编辑公告",
        description: "可编辑已有公告内容属性"
      },
      {
        name: "announcement:delete_announcement",
        display_name: "可删除公告",
        description: "可删除已有公告"
      }
    ]
  },
  {
    category: "网站后台设置",
    color: "bg-gray-100 text-gray-700",
    permissions: [
      {
        name: "admin_settings:manage_backend_settings",
        display_name: "可管理网站后台设置",
        description: "具体可设置项待完善网站后台设置后再细化"
      }
    ]
  }
];