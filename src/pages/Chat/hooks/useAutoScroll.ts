import { useEffect, useRef, useCallback } from 'react';

export function useAutoScroll(deps: unknown[]) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    shouldAutoScroll.current = atBottom;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !shouldAutoScroll.current) return;
    el.scrollTop = el.scrollHeight;
  }, deps);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    shouldAutoScroll.current = true;
  }, []);

  return { containerRef, scrollToBottom };
}
