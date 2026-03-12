import { useState, useRef, useEffect } from 'react';
import { X, Plus } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  allTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}

export function TagInput({ tags, allTags, onAdd, onRemove }: TagInputProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  useEffect(() => {
    if (input.trim()) {
      const filtered = allTags.filter(
        t => t.includes(input.toLowerCase()) && !tags.includes(t)
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, [input, allTags, tags]);

  const handleAdd = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInput('');
    setIsAdding(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd(input);
    } else if (e.key === 'Escape') {
      setIsAdding(false);
      setInput('');
      setSuggestions([]);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="hover:text-red-500 transition-colors"
          >
            <X size={10} />
          </button>
        </span>
      ))}

      {isAdding ? (
        <div className="relative">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              // Delay to allow suggestion click
              setTimeout(() => {
                if (input.trim()) {
                  handleAdd(input);
                } else {
                  setIsAdding(false);
                }
              }, 150);
            }}
            placeholder="Tag name"
            className="w-24 px-2 py-0.5 rounded-full text-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]/40"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 min-w-[120px]">
              {suggestions.map(s => (
                <button
                  key={s}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAdd(s);
                  }}
                  className="w-full text-left px-3 py-1.5 text-[10px] text-[var(--color-text)] hover:bg-[var(--color-bg-hover)] first:rounded-t-lg last:rounded-b-lg"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          <Plus size={10} />
          tag
        </button>
      )}
    </div>
  );
}
