import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X, HelpCircle, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import ReactMarkdown from "react-markdown";

export default function ProductInfoSection({ 
  form, 
  setForm, 
  productUrls, 
  setProductUrls, 
  urlMode, 
  setUrlMode,
  addonOptions,
  selectedAddons,
  setSelectedAddons,
  addonCustomFees,
  setAddonCustomFees,
  addonFeeErrors,
  setAddonFeeErrors,
  uploading,
  handleProductImageUpload,
  handleNoteImageUpload,
  settings,
  canSplitOrder,
  canSelectOrderAddons 
}) {
  const [showAdvancedNote, setShowAdvancedNote] = useState(false);
  const [showAddonOptions, setShowAddonOptions] = useState(false);

  const handleUrlChange = (idx, val) => {
    setProductUrls((prev) => prev.map((u, i) => i === idx ? val : u));
  };

  const handleUrlKeyDown = (e, idx) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      setProductUrls((prev) => [...prev.slice(0, idx + 1), "", ...prev.slice(idx + 1)]);
    }
    if (e.ctrlKey && e.shiftKey && e.code === "KeyS") {
      e.preventDefault();
      setUrlMode("textarea");
      setProductUrls([productUrls.filter((u) => u.trim()).join("\n")]);
    }
  };

  const addUrl = () => setProductUrls((prev) => [...prev, ""]);
  const removeUrl = (idx) => setProductUrls((prev) => prev.filter((_, i) => i !== idx));

  const toggleAddon = (id) => {
    setSelectedAddons((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-700">商品信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 商品链接 - 核心功能，始终显示 */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm">商品链接 *</Label>
              <div className="group relative">
                <HelpCircle className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" />
                <div className="invisible group-hover:visible absolute left-0 top-full mt-1 bg-gray-800 text-white text-xs rounded-lg px-3 py-2 w-48 z-10 pointer-events-none whitespace-normal">
                  {settings.product_url_tips || "输入日本商城的商品链接"}
                </div>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => {
                if (urlMode === "multi") {
                  setUrlMode("textarea");
                  setProductUrls([productUrls.filter((u) => u.trim()).join("\n")]);
                } else {
                  setUrlMode("multi");
                  const lines = (productUrls[0] || "").split("\n").map((s) => s.trim()).filter(Boolean);
                  setProductUrls(lines.length > 0 ? lines : [""]);
                }
              }} 
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
            >
              {urlMode === "multi" ? "切换文本框" : "切换分行"}
            </button>
          </div>
          
          {urlMode === "textarea" ? (
            <>
              <Textarea
                placeholder="https://www.amazon.co.jp/..."
                value={productUrls[0] || ""}
                onChange={(e) => setProductUrls([e.target.value])}
                className="mt-1 text-sm font-mono"
                rows={3}
              />
              {settings.allow_order_split === 'true' && canSplitOrder && (() => {
                const sections = (productUrls[0] || '').split(/\n-{3,}\n/).map((s) => s.trim()).filter(Boolean);
                if (sections.length > 1) {
                  return (
                    <div className="mt-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 text-xs text-indigo-700">
                      <span className="font-medium">检测到 {sections.length} 组链接</span> — 将自动拆分为 {sections.length} 个子订单
                    </div>
                  );
                }
                return null;
              })()}
            </>
          ) : (
            <div className="mt-1 space-y-2">
              {productUrls.map((url, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="https://www.amazon.co.jp/..."
                    value={url}
                    onChange={(e) => handleUrlChange(idx, e.target.value)}
                    onKeyDown={(e) => handleUrlKeyDown(e, idx)}
                    className="flex-1"
                  />
                  {productUrls.length > 1 && (
                    <button type="button" onClick={() => removeUrl(idx)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {idx === productUrls.length - 1 && (
                    <button type="button" onClick={addUrl} className="text-gray-400 hover:text-blue-600 flex-shrink-0">
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-1.5">
            Shift+Enter 添加下一条 · Ctrl+Shift+S 切换模式
          </p>
        </div>

        {/* 订单名称 - 核心功能 */}
        <div>
          <Label className="text-sm">订单名称 *</Label>
          <Input 
            placeholder="方便自己辨认的名字" 
            required 
            value={form.product_name}
            onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))} 
            className="mt-1" 
          />
        </div>

        {/* 商品描述 - 核心功能，但简化显示 */}
        <div>
          <Label className="text-sm">商品描述 / 规格</Label>
          <Textarea 
            placeholder="数量 颜色 尺码等（可选）" 
            value={form.product_description}
            onChange={(e) => setForm((f) => ({ ...f, product_description: e.target.value }))}
            className="mt-1" 
            rows={2} 
          />
        </div>

        {/* 日元货款 - 核心功能 */}
        <div>
          <Label className="text-sm">日元货款总价 (¥) *</Label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="15000"
            required
            value={form.estimated_jpy}
            onChange={(e) => setForm((f) => ({ ...f, estimated_jpy: e.target.value }))}
            className="mt-1"
          />
          <p className="text-xs text-gray-400 mt-1">支持四则运算，如 500+500</p>
        </div>

        {/* 增值服务 - 可折叠的高级选项 */}
        {addonOptions.length > 0 && canSelectOrderAddons && (
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setShowAddonOptions(!showAddonOptions)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showAddonOptions ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              增值服务 {selectedAddons.length > 0 && <Badge className="text-xs">{selectedAddons.length}</Badge>}
            </button>
            
            {showAddonOptions && (
              <div className="mt-2 space-y-2">
                {addonOptions.map((opt) => {
                  const isSelected = selectedAddons.includes(opt.id);
                  const isCustomizable = opt.is_user_customizable;
                  return (
                    <div key={opt.id} className={`rounded-lg border p-2.5 ${isSelected ? "border-yellow-400 bg-yellow-50" : "border-gray-100"}`}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAddon(opt.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-800">{opt.name}</span>
                            {!isCustomizable && (
                              <span className="text-sm text-red-600 font-medium">
                                +{opt.fee_currency || "JPY"} {opt.fee_currency === "JPY" ? Math.round(parseFloat(opt.fee)) : parseFloat(opt.fee)}
                              </span>
                            )}
                          </div>
                          {opt.description && <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>}
                          {isCustomizable && isSelected && (
                            <div className="mt-2 ml-6 flex items-center gap-2">
                              <Input
                                type="number"
                                className="h-7 w-28 text-xs"
                                placeholder={`${opt.min_fee}-${opt.max_fee}`}
                                value={addonCustomFees[opt.id] ?? opt.fee}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const value = val === '' ? '' : parseFloat(val) || 0;
                                  setAddonCustomFees((prev) => ({ ...prev, [opt.id]: value }));
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs text-yellow-700">{opt.fee_currency || "JPY"}</span>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 商品图片 - 简化显示，默认收起 */}
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, product_image_url: f.product_image_url ? "" : f.product_image_url }))}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 mb-2"
          >
            <Upload className="w-4 h-4" />
            商品图片 {form.product_image_url && <Badge className="bg-green-100 text-green-700">已上传</Badge>}
          </button>
          
          {form.product_image_url && (
            <div className="border-2 border-green-300 rounded-lg bg-green-50 p-3">
              <div className="flex items-center gap-3">
                <img src={form.product_image_url} alt="" className="h-12 rounded object-cover" />
                <div className="text-sm text-green-700">✓ 已上传</div>
              </div>
              <Input
                type="text"
                placeholder="或输入图片 URL..."
                value={form.product_image_url || ""}
                onChange={(e) => setForm((f) => ({ ...f, product_image_url: e.target.value }))}
                className="mt-2 text-sm border-0 shadow-none bg-transparent px-0 h-7 focus-visible:ring-0"
              />
            </div>
          )}
        </div>

        {/* 备注 - 高级选项，默认收起 */}
        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedNote(!showAdvancedNote)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {showAdvancedNote ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            备注说明 {form.user_note || form.note_image_url ? <Badge className="text-xs">已填写</Badge> : null}
          </button>
          
          {showAdvancedNote && (
            <div className="mt-2">
              <div className={`border-2 rounded-lg ${form.note_image_url ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
                <Textarea
                  placeholder="其他特殊说明..."
                  value={form.user_note}
                  onChange={(e) => setForm((f) => ({ ...f, user_note: e.target.value }))}
                  rows={2}
                  className="border-0 shadow-none bg-transparent resize-none"
                />
                {form.note_image_url && (
                  <div className="border-t border-green-200 px-3 py-2 flex items-center gap-3">
                    <img src={form.note_image_url} alt="" className="h-16 rounded object-cover border border-green-200" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, note_image_url: "" }))}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      移除图片
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}