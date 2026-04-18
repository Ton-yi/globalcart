/**
 * OrderMessageThread
 * Displays a conversation thread for an order (admin ↔ user).
 * Fix: message list updates immediately after sending (local state append).
 * Feature: shows sender avatar, name, and timestamp.
 */
import { useState, useEffect, useRef } from "react";
import { Send, Upload, X, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { updateOrder } from "@/lib/tenantApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Avatar({ name, imageUrl, size = "sm" }) {
  const dim = size === "sm" ? "w-7 h-7 text-xs" : "w-8 h-8 text-sm";
  if (imageUrl) {
    return <img src={imageUrl} alt={name} className={`${dim} rounded-full object-cover flex-shrink-0 border border-gray-200`} />;
  }
  return (
    <div className={`${dim} rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 font-medium text-gray-600`}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

export default function OrderMessageThread({ order, currentUser, isAdmin, onMessageSent, contactInfo, composeOnly = false, hideHistory = false, userProfileMap = {} }) {
  const [localMessages, setLocalMessages] = useState(order.messages || []);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

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

    const userData = userProfileMap[currentUser.email] || {};
    const displayName = userData.display_name || userData.full_name || currentUser.full_name || currentUser.email;
    const newMsg = {
      id: Date.now().toString(),
      from: displayName,
      from_email: currentUser.email,
      avatar_url: userData.avatar_url || currentUser.avatar_url || '',
      role: isAdmin ? "admin" : "user",
      content: content.trim(),
      image_url: imageUrl || "",
      timestamp: new Date().toISOString(),
      prev_status: order.order_status,
    };

    const updatedMessages = [...localMessages, newMsg];

    // Optimistically update local state immediately
    setLocalMessages(updatedMessages);
    setContent("");
    setImageUrl("");

    // 标记对方角色有未读消息
    const unreadRoles = isAdmin ? ["user"] : ["admin"];

    const updates = {
      messages: updatedMessages,
      unread_roles: unreadRoles,
    };

    await updateOrder(order.id, updates);
    setSending(false);
    onMessageSent?.();
  };

  const getSenderName = (msg) => {
    if (msg.role === "admin") return "客服";
    // Return msg.from which contains display_name or full_name
    return msg.from || order.user_name || msg.from_email || "匿名";
  };

  const getSenderAvatar = (msg) => {
    // First try the avatar stored on the message itself, then look up the profile map
    return msg.avatar_url || (msg.from_email ? userProfileMap[msg.from_email]?.avatar_url : null) || null;
  };

  return (
    <div className="space-y-4">
      {/* Message history */}
      {!hideHistory && localMessages.length === 0 && (
        <div className="text-center py-4 text-gray-400 text-sm">
          <MessageCircle className="w-7 h-7 mx-auto mb-2 opacity-30" />
          暂无留言，可在下方发起留言
        </div>
      )}
      {!hideHistory && localMessages.length > 0 && (
        <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
          {localMessages.map((msg) => {
            const isMine = isAdmin ? msg.role === "admin" : msg.role === "user";
            const senderName = getSenderName(msg);
            const senderAvatar = getSenderAvatar(msg);
            const isAdminMsg = msg.role === "admin";

            return (
              <div key={msg.id} className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className="flex-shrink-0 mt-0.5">
                  <Avatar
                    name={isAdminMsg ? "客服" : senderName}
                    imageUrl={senderAvatar}
                  />
                </div>

                {/* Bubble */}
                <div className={`flex flex-col max-w-[75%] ${isMine ? "items-end" : "items-start"}`}>
                  {/* Sender info row */}
                  <div className={`flex items-center gap-1.5 mb-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                    <span className="text-xs font-medium text-gray-700">{senderName}</span>
                    <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                  </div>

                  {/* Content */}
                  <div className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                    isMine
                      ? "bg-gray-900 text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}>
                    {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}
                    {msg.image_url && (
                      <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.image_url} alt="附图" className="mt-2 rounded-lg max-h-40 cursor-pointer" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Compose */}
      <div className="border border-gray-200 rounded-xl p-3 space-y-2.5 bg-gray-50">
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