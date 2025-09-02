import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom';
};

const Tooltip: React.FC<TooltipProps> = ({ content, children, position = 'top' }) => {
  const isTop = position === 'top';
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const positionTip = useCallback(() => {
    const wrap = wrapRef.current;
    const tip = tipRef.current;
    if (!wrap || !tip) return;
    // Measure
    const margin = 8;
    const vw = window.innerWidth;
    // Temporarily reset transform to measure natural width
    tip.style.transform = isTop ? 'translateY(-100%)' : 'translateY(100%)';
    tip.style.left = '0px';
    const wrapRect = wrap.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const centerX = wrapRect.left + wrapRect.width / 2;
    let leftVp = Math.round(centerX - tipRect.width / 2);
    // Clamp within viewport
    leftVp = Math.max(margin, Math.min(leftVp, vw - tipRect.width - margin));
    // Apply relative left
    tip.style.left = `${leftVp - wrapRect.left}px`;
    tip.style.transform = isTop ? 'translateY(-100%)' : 'translateY(100%)';
    // Position arrow towards the trigger center, clamped to tooltip bounds
    const arrow = arrowRef.current;
    if (arrow) {
      const tipLeftVp = leftVp; // tooltip's left in viewport coords
      const desired = centerX - tipLeftVp; // px from tooltip left
      const clamped = Math.max(6, Math.min(desired, tipRect.width - 6));
      arrow.style.left = `${Math.round(clamped)}px`;
      arrow.style.transform = 'translateX(-50%)';
    }
  }, [isTop]);

  useLayoutEffect(() => {
    if (!open) return;
    positionTip();
  }, [open, positionTip, content]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => positionTip();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, positionTip]);

  return (
    <div
      ref={wrapRef}
      className="relative inline-block align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <div
        ref={tipRef}
        className={[
          'pointer-events-none absolute rounded-md text-xs px-3 py-1.5 z-50',
          open ? 'opacity-100' : 'opacity-0',
          'transition-opacity duration-150',
          'bg-gray-900 text-white shadow-lg ring-1 ring-black/10 dark:bg-gray-700',
          'whitespace-nowrap min-w-max text-center',
          isTop ? '-top-2' : '-bottom-2',
        ].join(' ')}
        role="tooltip"
      >
        {content}
        <span
          ref={arrowRef}
          className={[
            'absolute w-1.5 h-1.5 rotate-45',
            isTop ? 'bottom-[-3px]' : 'top-[-3px]',
            'bg-gray-900 dark:bg-gray-700',
          ].join(' ')}
        />
      </div>
    </div>
  );
};

export default Tooltip;
