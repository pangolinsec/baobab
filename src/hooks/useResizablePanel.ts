import { useState, useCallback, useRef } from 'react';

interface UseResizablePanelOptions {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function useResizablePanel({
  defaultWidth = 384,
  minWidth = 256,
  maxWidth = 640,
}: UseResizablePanelOptions = {}) {
  const [width, setWidth] = useState(defaultWidth);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startWidth = width;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    const onMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const effectiveMax = Math.min(maxWidth, window.innerWidth * 0.6);
      setWidth(Math.max(minWidth, Math.min(effectiveMax, startWidth + delta)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [width, minWidth, maxWidth]);

  const onDoubleClick = useCallback(() => {
    setWidth(defaultWidth);
  }, [defaultWidth]);

  return { width, onMouseDown, onDoubleClick };
}
