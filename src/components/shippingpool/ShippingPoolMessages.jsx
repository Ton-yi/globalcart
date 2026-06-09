import React, { useState } from "react";
import { Send, Image, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ImageWithViewer from "@/components/common/ImageWithViewer";

export default function ShippingPoolMessages({
  messages,
  tenantUserMap,
  onSendMessage,
  sendingMsg,
  canSendShippingMessage,
  canSendImage,
}) {
  const [messageText, setMessageText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [composeDragOver, setComposeDragOver] = useState(false);

  const handleSendMessage = () => {
    if (!messageText.trim() && !imageFile) return;
    onSendMessage(messageText, imageFile);
    setMessageText("");
    setImageFile(null);
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">留言沟通</h3>
      
      {/* Message list */}
      {messages.length > 0 ? (
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {messages.map((msg) => {
            const senderAvatar = msg.avatar_url || (msg.from_email ? tenantUserMap[msg.from_email]?.avatar_url : '') || '';
            const senderDisplayName = msg.from || (msg.from_email ? (tenantUserMap[msg.from_email]?.display_name || tenantUserMap[msg.from_email]?.full_name) : null) || msg.from_email || "?";
            const senderInitial = senderDisplayName[0].toUpperCase();
            
            return (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "admin" ? "flex-row-reverse" : ""}`}>
                {senderAvatar ? (
                  <img src={senderAvatar} alt={senderDisplayName} className="w-6 h-6 rounded-full object-cover flex-shrink-0 self-start mt-0.5" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-medium flex-shrink-0 self-start mt-0.5">
                    {senderInitial}
                  </div>
                )}
                <div className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${msg.role === "admin" ? "bg-red-50 text-red-900 rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                  <p className="text-xs text-gray-400 mb-0.5 font-medium">{senderDisplayName}</p>
                  {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                  {msg.image_url && (
                    <ImageWithViewer src={msg.image_url} alt="留言图片">
                      <img src={msg.image_url} alt="" className="mt-1.5 max-w-full rounded-lg max-h-40 object-contain cursor-pointer hover:opacity-80 transition-opacity" />
                    </ImageWithViewer>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 mb-3">暂无留言</p>
      )}

      {/* Compose message */}
      <div className="space-y-2">
        <div
          className={`relative rounded-md border transition-colors ${composeDragOver ? "border-blue-400 bg-blue-50" : "border-input"}`}
          onDragOver={(e) => { e.preventDefault(); setComposeDragOver(true); }}
          onDragLeave={() => setComposeDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setComposeDragOver(false);
            const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
            if (file) setImageFile(file);
          }}
        >
          <Textarea
            rows={2}
            placeholder="输入留言… Enter 发送，Shift+Enter 换行，可拖拽或粘贴图片"
            className={`text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent resize-none ${composeDragOver ? "opacity-40 pointer-events-none" : ""}`}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            onPaste={(e) => {
              const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
              if (item) {
                const file = item.getAsFile();
                if (file) setImageFile(file);
              }
            }}
          />
          
          {composeDragOver && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-xs text-blue-500 font-medium">放开以附加图片</p>
            </div>
          )}
        </div>
        
        {imageFile && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
            <img src={URL.createObjectURL(imageFile)} alt="预览" className="w-8 h-8 rounded object-cover border border-gray-200" />
            <span className="text-xs text-gray-600 flex-1 truncate">{imageFile.name}</span>
            <button type="button" onClick={() => setImageFile(null)} className="text-gray-400 hover:text-red-500 text-xs">×</button>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          {canSendImage && canSendShippingMessage && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              <Image className="w-3.5 h-3.5" />
              {imageFile ? "更换图片" : "附加图片"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files[0])} />
            </label>
          )}
          <Button 
            size="sm" 
            className="h-7 text-xs bg-gray-800 hover:bg-gray-900"
            onClick={handleSendMessage} 
            disabled={sendingMsg || (!messageText.trim() && !imageFile) || !canSendShippingMessage}
          >
            <Send className="w-3 h-3 mr-1" />{sendingMsg ? "发送中..." : "发送"}
          </Button>
        </div>
      </div>
    </div>
  );
}