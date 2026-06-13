/**
 * usePageSize - 每页条数设置，持久化到 localStorage
 * @param {string} storageKey - localStorage key
 * @param {number} defaultSize - 默认每页条数
 */
import { useState } from "react";

const PAGE_SIZES = [10, 20, 50, 100];

export function usePageSize(storageKey, defaultSize = 20) {
  const [pageSize, setPageSizeState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const n = saved ? parseInt(saved, 10) : null;
      return PAGE_SIZES.includes(n) ? n : defaultSize;
    } catch {
      return defaultSize;
    }
  });

  const [currentPage, setCurrentPage] = useState(1);

  const setPageSize = (size) => {
    setPageSizeState(size);
    setCurrentPage(1);
    try { localStorage.setItem(storageKey, String(size)); } catch {}
  };

  const resetPage = () => setCurrentPage(1);

  return { pageSize, setPageSize, currentPage, setCurrentPage, resetPage, PAGE_SIZES };
}