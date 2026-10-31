'use client';

import { type RefObject, useLayoutEffect, useState } from 'react';

/** Follow the actual cell centres, including cabinet padding and responsive gaps. */
export function PaylineTrace({ gridRef, rows, line, usedWild, amount }: {
  gridRef: RefObject<HTMLDivElement | null>;
  rows: readonly number[];
  line: number;
  usedWild: boolean;
  amount: string;
}) {
  const [geometry, setGeometry] = useState({ points: '', width: 1, height: 1 });

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const columns = Array.from(grid.querySelectorAll<HTMLElement>(':scope > .reel-column'));
    const measure = () => {
      const points = columns.map((column, reel) => {
        const cell = column.children[rows[reel]] as HTMLElement;
        // Layout offsets deliberately ignore the winning/landing sprite transforms.
        return `${column.offsetLeft + cell.offsetLeft + cell.offsetWidth / 2},${column.offsetTop + cell.offsetTop + cell.offsetHeight / 2}`;
      }).join(' ');
      setGeometry({ points, width: grid.clientWidth, height: grid.clientHeight });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    columns.forEach((column) => observer.observe(column));
    measure();
    return () => observer.disconnect();
  }, [gridRef, rows]);

  return (
    <div className={`payline-trace line-${line} ${usedWild ? 'has-wild' : ''}`} aria-live="polite">
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} preserveAspectRatio="none" aria-hidden="true">
        <polyline key={line} points={geometry.points} pathLength="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <b>LINE {line}</b>
      <span>{amount}</span>
    </div>
  );
}
