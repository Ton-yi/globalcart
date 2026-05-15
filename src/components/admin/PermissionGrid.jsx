import { PERMISSIONS_PRESET } from "@/lib/permissionsPreset";
import { Check } from "lucide-react";

const ACCENT_CLASSES = {
  green:  { pill: "bg-green-100 text-green-800 border-green-300", pillOn: "bg-green-500 text-white border-green-500", cat: "bg-green-50 text-green-700 border-green-200", check: "text-white" },
  purple: { pill: "bg-gray-100 text-gray-600 border-gray-200",  pillOn: "bg-purple-500 text-white border-purple-500", cat: "bg-purple-50 text-purple-700 border-purple-200", check: "text-white" },
  blue:   { pill: "bg-gray-100 text-gray-600 border-gray-200",  pillOn: "bg-blue-500 text-white border-blue-500",   cat: "bg-blue-50 text-blue-700 border-blue-200",     check: "text-white" },
};

/**
 * PermissionGrid — pill-style inline permission selector.
 * Parents and children render as compact inline pills, grouped by category.
 *
 * Props:
 *   selected   : string[]
 *   onToggle   : (names: string[], forceOn?: boolean) => void
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
    const childOn = selectedSet.has(child.name);
    if (!childOn) {
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

        return (
          <div key={cat.category}>
            {/* Category header */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => handleCategoryToggle(cat)}
              className={`w-full px-3 py-1 text-left flex items-center justify-between transition-colors hover:opacity-80 text-xs font-semibold ${
                catOnCount > 0 ? accent.cat : "bg-gray-50 text-gray-500"
              }`}
            >
              <span>{cat.category}</span>
              <span className="font-normal opacity-60">{catOnCount}/{allCatNames.length}</span>
            </button>

            {/* Pills row */}
            <div className="px-3 py-2 flex flex-wrap gap-1.5 bg-white">
              {cat.permissions.map(perm => {
                const parentOn = selectedSet.has(perm.name);
                const children = perm.children || [];
                const childOnCount = children.filter(c => selectedSet.has(c.name)).length;
                const hasPartial = children.length > 0 && childOnCount > 0 && childOnCount < children.length;

                return (
                  <div key={perm.name} className="flex flex-wrap gap-1">
                    {/* Parent pill */}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleParentToggle(perm)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all cursor-pointer select-none ${
                        parentOn ? accent.pillOn : hasPartial ? "bg-gray-100 text-gray-600 border-gray-300 border-dashed" : accent.pill
                      }`}
                    >
                      {parentOn && <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />}
                      {perm.display_name}
                    </button>

                    {/* Child pills — indented inline after parent */}
                    {children.map(child => {
                      const childOn = selectedSet.has(child.name);
                      return (
                        <button
                          key={child.name}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleChildToggle(perm, child)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs transition-all cursor-pointer select-none ml-1 ${
                            childOn ? accent.pillOn : "bg-gray-50 text-gray-500 border-gray-200 border-dashed"
                          }`}
                        >
                          {childOn && <Check className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={3} />}
                          <span className="opacity-70 mr-0.5">↳</span>{child.display_name}
                        </button>
                      );
                    })}
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