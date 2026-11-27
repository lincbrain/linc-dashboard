import { useEffect } from "react";

// Shifts an element sideways to keep it between `left` and `right` (in viewport pixels)
export function keepInside(element, left, right) {
  element.style.transform = "";
  const box = element.getBoundingClientRect();
  const shift = box.left < left ? left - box.left : box.right > right ? right - box.right : 0;
  if (shift) element.style.transform = `translateX(${shift}px)`;
}

// Calls `onClose(escaped)` on a click outside `rootRef` or on Escape, while open
export function useDismiss(open, rootRef, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current.contains(event.target)) onClose(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") onClose(true);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, rootRef, onClose]);
}
