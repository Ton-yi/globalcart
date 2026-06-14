import { NAV_REGISTRY } from "@/lib/navRegistry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, ArrowUp, ArrowDown, IndentIncrease, IndentDecrease } from "lucide-react";

// 用户入口 key 集合（用于分组显示）
const USER_ENTRY_KEYS = new Set([
  "UserHome", "UserSubmitOrder", "UserSubmitOrderPlain", "UserGroupBuy",
  "UserMyOrders", "UserShippingPool", "UserProfile", "UserHelpCenter", "UserTodoAdmin",
]);

function clone(t) { return JSON.parse(JSON.stringify(t)); }
function getList(tree, parentPath) {
  let list = tree;
  for (const i of parentPath) list = list[i].children;
  return list;
}
function subtreeDepth(node) {
  if (!node.children?.length) return 1;
  return 1 + Math.max(...node.children.map(subtreeDepth));
}

export default function NavbarSettingsManager({ group, tree, onChange }) {
  const registry = NAV_REGISTRY[group];

  const mutate = (fn) => { const t = clone(tree); fn(t); onChange(t); };

  const patch = (path, p) => mutate(t => {
    const list = getList(t, path.slice(0, -1));
    Object.assign(list[path[path.length - 1]], p);
  });

  const move = (path, dir) => mutate(t => {
    const list = getList(t, path.slice(0, -1));
    const i = path[path.length - 1];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  });

  const indent = (path) => mutate(t => {
    const list = getList(t, path.slice(0, -1));
    const i = path[path.length - 1];
    if (i === 0) return;
    const node = list[i];
    if (path.length + subtreeDepth(node) > 3) return;
    list.splice(i, 1);
    const prev = list[i - 1];
    prev.children = prev.children || [];
    prev.children.push(node);
  });

  const outdent = (path) => mutate(t => {
    if (path.length < 2) return;
    const parentPath = path.slice(0, -1);
    const list = getList(t, parentPath);
    const node = list.splice(path[path.length - 1], 1)[0];
    const grandList = getList(t, parentPath.slice(0, -1));
    grandList.splice(parentPath[parentPath.length - 1] + 1, 0, node);
  });

  const renderRow = (node, i, parentPath) => {
    const path = [...parentPath, i];
    const reg = registry[node.key];
    if (!reg) return null;
    const Icon = reg.icon;
    const depth = path.length;
    const list = getList(tree, parentPath);
    return (
      <div key={node.key}>
        <div
          className={`flex items-center gap-2 py-1.5 px-2 rounded-lg border mb-1 ${node.hidden ? "opacity-50 bg-gray-50" : "bg-white"}`}
          style={{ marginLeft: (depth - 1) * 28 }}
        >
          <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-xs text-gray-400 w-24 flex-shrink-0 truncate" title={reg.label}>{reg.label}</span>
          <Input
            value={node.label || ""}
            placeholder={reg.label}
            maxLength={30}
            className="h-7 text-sm flex-1 min-w-[90px]"
            onChange={(e) => patch(path, { label: e.target.value })}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" title={node.hidden ? "点击显示" : "点击隐藏"}
            onClick={() => patch(path, { hidden: !node.hidden })}>
            {node.hidden ? <EyeOff className="w-3.5 h-3.5 text-gray-400" /> : <Eye className="w-3.5 h-3.5 text-gray-600" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="上移" disabled={i === 0}
            onClick={() => move(path, -1)}>
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="下移" disabled={i === list.length - 1}
            onClick={() => move(path, 1)}>
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="设为上一项的子级"
            disabled={i === 0 || (depth + subtreeDepth(node)) > 3}
            onClick={() => indent(path)}>
            <IndentIncrease className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="提升一级" disabled={depth === 1}
            onClick={() => outdent(path)}>
            <IndentDecrease className="w-3.5 h-3.5" />
          </Button>
        </div>
        {node.children?.length ? renderRows(node.children, path) : null}
      </div>
    );
  };

  const renderRows = (nodes, parentPath = []) =>
    nodes.map((node, i) => renderRow(node, i, parentPath));

  // 对 admin 组：在根级将管理功能和用户入口分区展示
  if (group === "admin") {
    const adminNodes = tree.filter(n => !USER_ENTRY_KEYS.has(n.key));
    const userEntryNodes = tree.filter(n => USER_ENTRY_KEYS.has(n.key));
    // 保持路径索引与原 tree 对应
    const adminIndices = tree.map((n, i) => !USER_ENTRY_KEYS.has(n.key) ? i : null).filter(i => i !== null);
    const userIndices = tree.map((n, i) => USER_ENTRY_KEYS.has(n.key) ? i : null).filter(i => i !== null);
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2 pb-1 border-b">管理功能入口</p>
          {adminIndices.map(i => renderRow(tree[i], i, []))}
        </div>
        {userEntryNodes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-blue-500 mb-2 pb-1 border-b border-blue-100">
              用户入口（默认隐藏，可开启后出现在管理员导航中）
            </p>
            {userIndices.map(i => renderRow(tree[i], i, []))}
          </div>
        )}
      </div>
    );
  }

  return <div>{renderRows(tree)}</div>;
}