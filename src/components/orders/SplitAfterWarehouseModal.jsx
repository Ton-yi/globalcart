/**
 * SplitAfterWarehouseModal
 * 用户对已入库订单提交拆单申请的表单弹窗。
 * 必填：新订单名称、商品图片
 * 可填：备注、商品链接
 */
import { useState } from "react";
import { X, Upload, CheckCircle, Loader2, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { updateOrder } from "@/lib/tenantApi";

export default function SplitAfterWarehouseModal({ order, currentUser, onClose, onSuccess }) {
  const [productName, setProductName] = useState("");
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productLink, setProductLink] = useState("");
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const uploadFile = async (file) => {
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setProductImageUrl(file_url);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!productName.trim() || !productImageUrl) return;
    setSubmitting(true);

    // Store the split request in order messages as a structured system request
    const request = {
      id: `split_req_${Date.now()}`,
      from: currentUser.full_name || currentUser.email,
      from_email: currentUser.email,
      role: "user",
      content: `__SPLIT_REQUEST__`,
      split_request: {
        product_name: productName.trim(),
        product_image_url: productImageUrl,
        product_link: productLink.trim(),
        note: note.trim(),
        submitted_at: new Date().toISOString(),
        status: "pending", // pending | approved | rejected
      },
      timestamp: new Date().toISOString(),
    };

    const currentMessages = order.messages || [];
    const currentUnread = order.unread_roles || [];

    await updateOrder(order.id, {
      messages: [...currentMessages, request],
      unread_roles: [...new Set([...currentUnread, "admin"])],
    });

    setSubmitting(false);
    onSuccess?.();
  };

  const canSubmit = productName.trim() && productImageUrl && !submitting && !uploading;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Scissors className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-gray-900">申请拆单</h3>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2.5 text-xs text-indigo-700">
            <p className="font-medium mb-0.5">请填写要从此订单中拆出的商品信息</p>
            <p className="text-indigo-500">管理员审批后，将为您生成独立的新订单（已入库状态）。</p>
          </div>

          {/* 必填：订单名称 */}
          <div>
            <Label className="text-sm">
              新订单商品名称 <span className="text-red-500">*</span>
            </Label>
            <Input
              className="mt-1"
              placeholder="请输入拆出商品的名称"
              value={productName}
              onChange={e => setProductName(e.target.value)}
            />
          </div>

          {/* 必填：商品图片 */}
          <div>
            <Label className="text-sm">
              商品图片 <span className="text-red-500">*</span>
            </Label>
            <label
              className="cursor-pointer block mt-1"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith("image/")) uploadFile(file);
              }}
            >
              <div className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg p-3 text-sm transition-colors ${
                productImageUrl
                  ? "border-green-300 bg-green-50 text-green-700"
                  : uploading
                  ? "border-blue-200 bg-blue-50 text-blue-500"
                  : "border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500"
              }`}>
                {productImageUrl
                  ? <><CheckCircle className="w-4 h-4" />图片已上传，点击更换</>
                  : uploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />上传中...</>
                  : <><Upload className="w-4 h-4" />点击选择或拖拽图片</>}
              </div>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { if (e.target.files[0]) uploadFile(e.target.files[0]); }} />
            </label>
            {/* 也可粘贴URL */}
            <Input
              className="mt-1.5 text-xs"
              placeholder="或直接输入图片URL"
              value={productImageUrl}
              onChange={e => setProductImageUrl(e.target.value)}
              onPaste={e => {
                const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"));
                if (item) {
                  e.preventDefault();
                  const file = item.getAsFile();
                  if (file) uploadFile(file);
                }
              }}
            />
            {productImageUrl && (
              <img src={productImageUrl} alt="" className="mt-1.5 h-16 w-16 rounded-lg object-cover border border-gray-200" />
            )}
          </div>

          {/* 可选：商品链接 */}
          <div>
            <Label className="text-sm text-gray-600">商品链接（可选）</Label>
            <Input
              className="mt-1 text-sm"
              placeholder="https://..."
              value={productLink}
              onChange={e => setProductLink(e.target.value)}
            />
          </div>

          {/* 可选：备注 */}
          <div>
            <Label className="text-sm text-gray-600">备注（可选）</Label>
            <Textarea
              className="mt-1 text-sm"
              rows={2}
              placeholder="其他说明..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />提交中...</> : <><Scissors className="w-3.5 h-3.5 mr-1.5" />提交申请</>}
          </Button>
        </div>
      </div>
    </div>
  );
}