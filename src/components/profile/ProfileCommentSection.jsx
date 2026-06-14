/**
 * ProfileCommentSection — 公开资料页留言区（Steam 风格）
 * 支持图片上传（点击 / 拖拽 / 粘贴剪切板）、订阅留言区通知
 */
import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bell, BellOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageWithViewer } from "@/components/common/ImageViewer";
import RichTextInput from "@/components/common/RichTextInput";

function formatTime(dateStr) {
  if (!dateStr) return "";
  // 后端存储的是 UTC 时间但不带时区标记，直接 new Date() 会被当作本地时间解析（东京时区会偏差 9 小时）
  const normalized = /Z|[+-]\d{2}:?\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
  const d = new Date(normalized);
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
  const [posting, setPosting] = useState(false);

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
          <RichTextInput
            value={content}
            onChange={setContent}
            imageUrls={imageUrls}
            onImageUrls={setImageUrls}
            onSubmit={handlePost}
            placeholder="发布一条留言... 可拖拽或 Ctrl+V 粘贴图片，Ctrl+Enter 发送"
            submitLoading={posting}
            submitLabel="发布留言"
          />
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
                    <ImageWithViewer src={c.author_avatar_url}>
                      <img src={c.author_avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    </ImageWithViewer>
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
                          <ImageWithViewer key={idx} src={url} thumbClassName="h-20 max-w-[160px] rounded object-cover border hover:opacity-90" />
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