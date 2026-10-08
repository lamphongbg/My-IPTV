import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Layers, Star, History, Filter } from 'lucide-react';

interface CategoryScrollNavProps {
  categories: string[];
  groupCounts?: Record<string, number>;
  activeGroup: string;
  onSelectGroup: (group: string) => void;
  totalChannels: number;
  favoritesCount: number;
  recentCount: number;
}

export const CategoryScrollNav: React.FC<CategoryScrollNavProps> = ({
  categories,
  groupCounts,
  activeGroup,
  onSelectGroup,
  totalChannels,
  favoritesCount,
  recentCount,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Mouse drag-to-scroll state
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);
  const [isDraggingState, setIsDraggingState] = useState(false);

  const checkScrollPosition = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  };

  useEffect(() => {
    checkScrollPosition();
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleResize = () => checkScrollPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [categories]);

  // Scroll smoothly by delta
  const handleScrollBy = (distance: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: distance, behavior: 'smooth' });
  };

  // Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    setIsDraggingState(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Drag speed multiplier
    if (Math.abs(walk) > 4) {
      hasMovedRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
    checkScrollPosition();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDraggingState(false);
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDraggingState(false);
    }
  };

  // Click on a category button (prevent click if dragging)
  const handleItemClick = (group: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      return;
    }
    onSelectGroup(group);

    // Scroll active item into center view
    e.currentTarget.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  };

  return (
    <div className="flex flex-col gap-1.5 w-full select-none">
      {/* Top Header for Categories with Quick Select Dropdown */}
      <div className="flex items-center justify-between text-xs text-neutral-400 px-0.5">
        <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-amber-500" />
          <span>Danh mục kênh ({categories.length} nhóm)</span>
        </span>

        {/* Dropdown Quick Select */}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-neutral-500 hidden sm:inline">Chọn nhanh:</span>
          <select
            value={activeGroup}
            onChange={(e) => onSelectGroup(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-amber-500 transition cursor-pointer max-w-[200px] truncate"
          >
            <option value="all">Tất cả kênh ({totalChannels})</option>
            {favoritesCount > 0 && <option value="favorites">★ Yêu thích ({favoritesCount})</option>}
            {recentCount > 0 && <option value="recent">⏱ Gần đây ({recentCount})</option>}
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} {groupCounts?.[cat] ? `(${groupCounts[cat]})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Scrollable Nav with Arrow Controls */}
      <div className="relative flex items-center gap-1 group">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollBy(-220)}
          disabled={!canScrollLeft}
          className={`w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0 transition z-10 ${
            canScrollLeft
              ? 'text-neutral-200 hover:text-white hover:bg-neutral-800 hover:border-neutral-700 shadow-md cursor-pointer'
              : 'text-neutral-600 opacity-40 cursor-not-allowed'
          }`}
          title="Cuộn sang trái"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable & Swipeable Pills Container */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollPosition}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className={`flex-1 flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar drag-scroll-container transition-all text-xs ${
            isDraggingState ? 'cursor-grabbing select-none' : 'cursor-grab'
          }`}
          style={{ scrollBehavior: isDraggingState ? 'auto' : 'smooth' }}
        >
          {/* All Channels Button */}
          <button
            type="button"
            onClick={(e) => handleItemClick('all', e)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 flex-shrink-0 ${
              activeGroup === 'all'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tất cả ({totalChannels})</span>
          </button>

          {/* Favorites Button */}
          {favoritesCount > 0 && (
            <button
              type="button"
              onClick={(e) => handleItemClick('favorites', e)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 flex-shrink-0 ${
                activeGroup === 'favorites'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Yêu thích ({favoritesCount})</span>
            </button>
          )}

          {/* Recently Played Button */}
          {recentCount > 0 && (
            <button
              type="button"
              onClick={(e) => handleItemClick('recent', e)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 flex-shrink-0 ${
                activeGroup === 'recent'
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Gần đây ({recentCount})</span>
            </button>
          )}

          {/* Dynamic Categories Pills */}
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={(e) => handleItemClick(cat, e)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition flex-shrink-0 ${
                activeGroup === cat
                  ? 'bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800/80'
              }`}
            >
              <span>{cat}</span>
              {groupCounts?.[cat] !== undefined && (
                <span className={`ml-1 text-[10px] px-1 py-0.2 rounded font-normal ${
                  activeGroup === cat ? 'bg-neutral-950/20 text-neutral-950 font-semibold' : 'text-neutral-500'
                }`}>
                  {groupCounts[cat]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={() => handleScrollBy(220)}
          disabled={!canScrollRight}
          className={`w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0 transition z-10 ${
            canScrollRight
              ? 'text-neutral-200 hover:text-white hover:bg-neutral-800 hover:border-neutral-700 shadow-md cursor-pointer'
              : 'text-neutral-600 opacity-40 cursor-not-allowed'
          }`}
          title="Cuộn sang phải"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
