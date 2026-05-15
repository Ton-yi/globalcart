import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";
import { Check } from "lucide-react";

const ACCENT_CLASSES = {
  green: { on: "bg-green-500 border-green-500", row: "bg-green-50 hover:bg-green-100", text: "text-green-900", cat: "bg-green-50 text-green-700 border-green-200" },
  purple: { on: "bg-purple-500 border-purple-500", row: "bg-purple-50 hover:bg-purple-100", text: "text-purple-900", cat: "bg-purple-50 text-purple-700 border-purple-200" },
  blue: { on: "bg-blue-500 border-blue-500", row: "bg-blue-50 hover:bg-blue-100", text: "text-blue-900", cat: "bg-blue-50 text-blue-700 border-blue-200" },
};

/**
 * PermissionGrid — shared permission selection component.
 *
 * Props:
 *   selected   : string[]   — array of selected permission name strings
 *   onToggle   : (names: string[], forceOn?: boolean) => void
 *                — called with an array of names + optional forceOn flag
 *   accentColor: "green" | "purple" | "blue"
 *   disabled   : boolean (optional)
 */
export default function PermissionGrid({ selected = [], onToggle, accentColor = "green", disabled = false }) {
  const accent = ACCENT_CLASSES[accentColor] || ACCENT_CLASSES.green;
  const selectedSet = new Set(selected);

  const handleParentToggle = (perm) => {
    const children = (perm.children || []).map(c => c.name);
    const allNames = [perm.name, ...children];
    const anyOn = allNames.some(n => selectedSet.has(n));
    onToggle(allNames, !anyOn);
  };

  const handleChildToggle = (parent, child) => {
    // toggling child: if child is being turned on, also turn on parent
    const childOn = selectedSet.has(child.name);
    if (!childOn) {
      // turn on child + ensure parent is on
      const toAdd = [child.name];
      if (!selectedSet.has(parent.name)) toAdd.push(parent.name);
      onToggle(toAdd, true);
    } else {
      onToggle([child.name], false);
    }
  };

  const handleCategoryToggle = (cat) => {
    const allNames = [];
    cat.permissions.forEach(p => {
      allNames.push(p.name);
      (p.children || []).forEach(c => allNames.push(c.name));
    });
    const anyOn = allNames.some(n => selectedSet.has(n));
    onToggle(allNames, !anyOn);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
      {PERMISSIONS_PRESET.map(cat => {
        const allCatNames = [];
        cat.permissions.forEach(p => {
          allCatNames.push(p.name);
          (p.children || []).forEach(c => allCatNames.push(c.name));
        });
        const catOnCount = allCatNames.filter(n => selectedSet.has(n)).length;
        const catAllOn = catOnCount === allCatNames.length;

        return (
          <div key={cat.category}>
            {/* Category header — click to bulk toggle */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleCategoryToggle(cat)}
              className={`w-full px-3 py-1.5 text-left flex items-center justify-between transition-colors ${
                catOnCount > 0 ? `${accent.cat}` : "bg-gray-50 text-gray-600"
              } text-xs font-semibold hover:opacity-80`}
            >
              <span>{cat.category}</span>
              <span className="font-normal opacity-70">{catOnCount}/{allCatNames.length}</span>
            </button>

            {/* Permissions in this category */}
            <div className="divide-y divide-gray-50">
              {cat.permissions.map(perm => {
                const parentOn = selectedSet.has(perm.name);
                const children = perm.children || [];
                const childOnCount = children.filter(c => selectedSet.has(c.name)).length;
                const hasPartialChildren = children.length > 0 && childOnCount > 0 && childOnCount < children.length;

                return (
                  <div key={perm.name}>
                    {/* Parent permission row */}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleParentToggle(perm)}
                      className={`flex items-center gap-2.5 px-3 py-1.5 text-left w-full transition-colors ${
                        parentOn ? accent.row : "bg-white hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                        parentOn
                          ? accent.on
                          : hasPartialChildren
                          ? "border-gray-400 bg-gray-100"
                          : "border-gray-300 bg-white"
                      }`}>
                        {parentOn && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                        {!parentOn && hasPartialChildren && <span className="w-1.5 h-0.5 bg-gray-500 rounded" />}
                      </span>
                      <span className={`text-xs flex-1 ${parentOn ? `${accent.text} font-medium` : "text-gray-600"}`}>
                        {perm.display_name}
                      </span>
                    </button>

                    {/* Child permissions */}
                    {children.length > 0 && (
                      <div className="pl-6 border-l-2 border-gray-100 ml-3 divide-y divide-gray-50">
                        {children.map(child => {
                          const childOn = selectedSet.has(child.name);
                          return (
                            <button
                              key={child.name}
                              type="button"
                              disabled={disabled}
                              onClick={() => handleChildToggle(perm, child)}
                              className={`flex items-center gap-2 px-3 py-1 text-left w-full transition-colors ${
                                childOn ? accent.row : "bg-white hover:bg-gray-50"
                              }`}
                            >
                              <span className={`w-3 h-3 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                                childOn ? accent.on : "border-gray-300 bg-white"
                              }`}>
                                {childOn && <Check className="w-1.5 h-1.5 text-white" strokeWidth={3} />}
                              </span>
                              <span className={`text-xs flex-1 ${childOn ? `${accent.text} font-medium` : "text-gray-500"}`}>
                                {child.display_name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}