/**
 * ProfileCommentSection — 公开资料页留言区（Steam 风格）
 * 支持图片上传（点击 / 拖拽 / 粘贴剪切板）、订阅留言区通知
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Bell, BellOff, ImagePlus, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

function formatTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  return d.toLocaleDateString("zh-CN", { year: 'numeric', month: '2-digit', day: '2-digit' }) +
    " " + d.toLocaleTimeString("zh-CN", { hour: '2-digit', minute: '2-digit' });
}

export default function ProfileCommentSection({ handle }) {
  const { user } = useCurrentUser();
  const { isAdmin } = usePermissions();
  const { locale } = useParams();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [canComment, setCanComment] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subToggling, setSubToggling] = useState(false);
  const [content, setContent] = useState("");
  const [imageUrls, setImageUrls] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const res = await base44.functions.invoke('manageProfileComments', { action: 'list', handle });
    const d = res.data || {};
    setComments(d.comments || []);
    setEnabled(d.comments_enabled !== false);
    setCanComment(d.can_comment !== false);
    setIsOwner(!!d.is_owner);
    setSubscribed(!!d.is_subscribed);
    setLoading(false);
  }, [handle]);

  useEffect(() => { load().catch(() => setLoading(false)); }, [load]);

  const uploadFiles = async (files) => {
    const imgs = Array.from(files).filter(f => f && f.type?.startsWith("image/"));
    if (!imgs.length) return;
    if (imageUrls.length + imgs.length > 4) { toast.error('最多上传 4 张图片'); return; }
    setUploading(true);
    try {
      for (const f of imgs) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        setImageUrls(prev => [...prev, file_url]);
      }
    } catch {
      toast.error('图片上传失败，请重试');
    }
    setUploading(false);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const it of items) if (it.type.startsWith("image/")) files.push(it.getAsFile());
    if (files.length) { e.preventDefault(); uploadFiles(files); }
  };

  const handlePost = async () => {
    if (!content.trim() && imageUrls.length === 0) return;
    setPosting(true);
    try {
      await base44.functions.invoke('manageProfileComments', {
        action: 'create', handle, content: content.trim(), image_urls: imageUrls
      });
      setContent("");
      setImageUrls([]);
      await load();
      toast.success('留言已发布');
    } catch (e) {
      toast.error(e.response?.data?.error || '发布失败');
    }
    setPosting(false);
  };

  const handleDelete = async (id) => {
    try {
      await base44.functions.invoke('manageProfileComments', { action: 'delete', comment_id: id });
      setComments(prev => prev.filter(c => c.id !== id));
      toast.success('留言已删除');
    } catch (e) {
      toast.error(e.response?.data?.error || '删除失败');
    }
  };

  const toggleSubscribe = async () => {
    setSubToggling(true);
    try {
      await base44.functions.invoke('manageProfileComments', {
        action: subscribed ? 'unsubscribe' : 'subscribe', handle
      });
      setSubscribed(!subscribed);
      toast.success(subscribed ? '已取消订阅留言区' : '已订阅留言区，有新留言时会收到通知');
    } catch {
      toast.error('操作失败，请重试');
    }
    setSubToggling(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!enabled) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-gray-400">
          <MessageSquare className="w-5 h-5 mx-auto mb-2 opacity-50" />
          该用户已关闭留言区
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            留言板（{comments.length}）
          </CardTitle>
          <Button
            size="sm"
            variant={subscribed ? "secondary" : "outline"}
            className="h-7 text-xs"
            onClick={toggleSubscribe}
            disabled={subToggling}
          >
            {subscribed ? <BellOff className="w-3.5 h-3.5 mr-1" /> : <Bell className="w-3.5 h-3.5 mr-1" />}
            {subscribed ? '取消订阅' : '订阅留言区'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 发布留言 */}
        {canComment ? (
          <div
            className={`border rounded-lg p-3 transition-colors ${dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
          >
            <Textarea
              rows={3}
              placeholder="发布一条留言... 可拖拽或 Ctrl+V 粘贴图片"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onPaste={handlePaste}
              className="bg-white text-sm"
            />
            {imageUrls.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {imageUrls.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt="" className="h-16 w-16 rounded object-cover border" />
                    <button
                      type="button"
                      className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5 opacity-80 hover:opacity-100"
                      onClick={() => setImageUrls(prev => prev.filter((_, i) => i !== idx))}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {uploading ? '上传中...' : '添加图片'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { uploadFiles(e.target.files); e.target.value = ""; }}
              />
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handlePost}
                disabled={posting || uploading || (!content.trim() && imageUrls.length === 0)}
              >
                {posting ? '发布中...' : '发布留言'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-2">您没有在他人资料页留言的权限</p>
        )}

        {/* 留言列表 */}
        {comments.length > 0 ? (
          <div className="divide-y">
            {comments.map(c => {
              const canDelete = isAdmin || isOwner || c.author_email === user?.email;
              return (
                <div key={c.id} className="py-3 flex gap-3 group">
                  {c.author_avatar_url ? (
                    <img src={c.author_avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {(c.author_name || c.author_email)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {c.author_handle ? (
                        <Link to={`/${locale || 'ja'}/u/${c.author_handle}`} className="text-sm font-medium text-blue-700 hover:underline">
                          {c.author_name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-gray-800">{c.author_name}</span>
                      )}
                      <span className="text-xs text-gray-400">{formatTime(c.created_date)}</span>
                      {canDelete && (
                        <button
                          type="button"
                          className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {c.content && <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{c.content}</p>}
                    {(c.image_urls || []).length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {c.image_urls.map((url, idx) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="" className="h-20 max-w-[160px] rounded object-cover border hover:opacity-90" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">还没有留言，来发布第一条吧</p>
        )}
      </CardContent>
    </Card>
  );
}