/**
 * OrderMessageThread
 * Displays a conversation thread for an order (admin ↔ user).
 * Sending a message automatically flips the "awaiting_reply" status:
 *   - User sends  → order_status = "awaiting_reply"  (admin side shows 待回复)
 *   - Admin sends → order_status = "admin_replied"    (user side shows 待回复)
 * The status reverts to pre_reply_status once both sides have exchanged.
 */
import { useState, useEffect } from "react";
import { Send, Upload, X, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function OrderMessageThread({ order, currentUser, isAdmin, onMessageSent, contactInfo }) {
  const messages = order.messages || [];
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setImageUrl(file_url);
    setUploading(false);
  };

  const handleSend = async () => {
    if (!content.trim() && !imageUrl) return;
    setSending(true);

    const newMsg = {
      id: Date.now().toString(),
      from: currentUser.email,
      role: isAdmin ? "admin" : "user",
      content: content.trim(),
      image_url: imageUrl || "",
      contact_info: contactInfo || "",
      timestamp: new Date().toISOString(),
      prev_status: order.order_status,
    };

    const updatedMessages = [...messages, newMsg];

    // Status logic:
    // User sends   → awaiting_reply  (admin sees 待回复)
    // Admin sends  → admin_replied   (user sees 待回复)
    const newStatus = isAdmin ? "admin_replied" : "awaiting_reply";
    const updates = {
      messages: updatedMessages,
      order_status: newStatus,
    };
    // Preserve pre_reply_status so we know where to return
    if (!order.pre_reply_status) {
      updates.pre_reply_status = order.order_status;
    }

    await base44.entities.Order.update(order.id, updates);
    setContent("");
    setImageUrl("");
    setSending(false);
    onMessageSent?.();
  };

  return (
    <div className="space-y-4">
      {/* Message history */}
      {messages.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          暂无留言
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {messages.map((msg) => {
            const isMine = isAdmin ? msg.role === "admin" : msg.role === "user";
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                  isMine ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-800"
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${isMine ? "text-gray-300" : "text-gray-500"}`}>
                      {msg.role === "admin" ? "客服" : "用户"}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                  </div>
                  {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                  {msg.image_url && (
                    <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                      <img src={msg.image_url} alt="附图" className="mt-2 rounded max-h-40 cursor-pointer" />
                    </a>
                  )}
                  {msg.contact_info && (
                    <p className={`text-xs mt-1.5 ${isMine ? "text-gray-300" : "text-gray-500"}`}>
                      联系方式：{msg.contact_info}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-gray-50">
        {contactInfo && (
          <p className="text-xs text-gray-400">
            您的联系方式：<span className="text-gray-600 font-medium">{contactInfo}</span>
            <span className="ml-1">（将附在留言中）</span>
          </p>
        )}
        <Textarea
          placeholder="输入留言内容..."
          rows={3}
          value={content}
          onChange={e => setContent(e.target.value)}
          className="bg-white text-sm resize-none"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                imageUrl ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              }`}>
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "上传中..." : imageUrl ? "图片已附" : "附图片"}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            </label>
            {imageUrl && (
              <button onClick={() => setImageUrl("")} className="text-gray-400 hover:text-red-500">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            size="sm"
            className="bg-gray-900 hover:bg-gray-800 text-xs"
            onClick={handleSend}
            disabled={sending || (!content.trim() && !imageUrl)}
          >
            <Send className="w-3.5 h-3.5 mr-1" />
            {sending ? "发送中..." : "发送留言"}
          </Button>
        </div>
      </div>
    </div>
  );
}