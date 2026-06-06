/**
 * GroupBuyJoinForm - 用户加入拼单的表单
 */
import { useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";

export default function GroupBuyJoinForm({ request, currentUser, onSuccess, onCancel, isCreateMode = false, onDataChange }) {
  const [form, setForm] = useState({
    product_url: '',
    product_name: '',
    product_description: '',
    product_image_url: '',
    estimated_jpy: '',
    user_note: '',
    custom_deadline: request?.deadline || '',
    deadline_action: 'cancel',
  });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const sf = (k, v) => {
    const updated = { ...form, [k]: v };
    setForm(updated);
    onDataChange?.(updated);
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    sf('product_image_url', file_url);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.product_name || !form.estimated_jpy) return;
    setSubmitting(true);
    await base44.functions.invoke('manageGroupBuy', {
      action: 'join_request',
      request_id: request.id,
      ...form,
      estimated_jpy: parseFloat(form.estimated_jpy) || 0,
    });
    setSubmitting(false);
    onSuccess?.();
  };

  const isEarlier = form.custom_deadline && request?.deadline && form.custom_deadline < request.deadline;
  const isLater   = form.custom_deadline && request?.deadline && form.custom_deadline > request.deadline;

  return (
    <div className={`${!isCreateMode ? 'border border-indigo-200 rounded-xl p-4 bg-indigo-50/20 space-y-3' : 'space-y-3'}`}>
      {!isCreateMode && <h4 className="text-sm font-semibold text-indigo-800">填写我的需求</h4>}

      <div>
        <Label className="text-xs text-gray-500">商品链接</Label>
        <Input className="mt-1 h-8 text-sm" placeholder="https://..." value={form.product_url}
          onChange={e => sf('product_url', e.target.value)} />
      </div>

      <div>
        <Label className="text-xs text-gray-500">商品名称 *</Label>
        <Input className="mt-1 h-8 text-sm" placeholder="商品名称" required value={form.product_name}
          onChange={e => sf('product_name', e.target.value)} />
      </div>

      <div>
        <Label className="text-xs text-gray-500">商品描述/规格</Label>
        <Textarea className="mt-1 text-sm" rows={2} placeholder="颜色、尺码、数量..." value={form.product_description}
          onChange={e => sf('product_description', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">日元金额 (JPY) *</Label>
          <Input className="mt-1 h-8 text-sm" type="number" min={0} placeholder="0"
            value={form.estimated_jpy} onChange={e => sf('estimated_jpy', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-500">商品图片（可选）</Label>
          <div className="mt-1 h-8 border border-dashed border-gray-200 rounded-md flex items-center px-2 cursor-pointer hover:border-indigo-300 text-xs text-gray-400"
            onClick={() => document.getElementById('gb-img-input')?.click()}>
            {form.product_image_url ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <img src={form.product_image_url} alt="" className="h-5 w-5 object-cover rounded" />
                <span className="truncate text-green-600">已上传</span>
                <button type="button" className="ml-auto text-gray-400 hover:text-red-500" onClick={e => { e.stopPropagation(); sf('product_image_url', ''); }}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : uploading ? (
              <span className="text-blue-400">上传中...</span>
            ) : (
              <span><Upload className="w-3 h-3 inline mr-1" />点击上传</span>
            )}
          </div>
          <input id="gb-img-input" type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files[0]; if (f) handleImageUpload(f); }} />
        </div>
      </div>

      {/* Custom deadline */}
      <div>
        <Label className="text-xs text-gray-500">我的截止日期（可选，默认与申请一致）</Label>
        <Input type="date" className="mt-1 h-8 text-sm" value={form.custom_deadline}
          onChange={e => sf('custom_deadline', e.target.value)} />
        {isEarlier && (
          <div className="mt-1 space-y-1">
            <p className="text-xs text-orange-500">比申请截止日早，到期时如何处理？</p>
            <Select value={form.deadline_action} onValueChange={v => sf('deadline_action', v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cancel">退出拼单（取消）</SelectItem>
                <SelectItem value="extend">延后至申请截止日继续参团</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {isLater && (
          <p className="text-xs text-blue-500 mt-1">比申请截止日晚，将在原截止日后更新期限，继续参团</p>
        )}
      </div>

      <div>
        <Label className="text-xs text-gray-500">备注</Label>
        <Textarea className="mt-1 text-sm" rows={1} value={form.user_note}
          onChange={e => sf('user_note', e.target.value)} placeholder="特殊要求..." />
      </div>

      {!isCreateMode && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !form.product_name || !form.estimated_jpy}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs h-8">
            {submitting ? '提交中...' : '确认加入'}
          </Button>
          <Button size="sm" variant="outline" onClick={onCancel} className="text-xs h-8">取消</Button>
        </div>
      )}
    </div>
  );
}