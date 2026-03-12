import { User, Sparkles, Star, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SearchResult } from '../../lib/search';
import { useTreeStore } from '../../store/useTreeStore';
import { useSearchStore } from '../../store/useSearchStore';

interface SearchResultsProps {
  results: SearchResult[];
  onResultClick?: () => void;
}

export function SearchResults({ results, onResultClick }: SearchResultsProps) {
  const navigate = useNavigate();
  const { clearGlobalSearch } = useSearchStore.getState();

  if (results.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] px-4 py-8 text-center">
        No results found
      </p>
    );
  }

  return (
    <div className="py-2">
      {results.map((result) => (
        <div
          key={result.node.id}
          className="group flex items-start gap-2 px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors duration-150 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
          onClick={() => {
            // Navigate to the conversation and select the node
            navigate(`/c/${result.conversationId}`);
            // Delay to let conversation load, then select node
            setTimeout(() => {
              useTreeStore.getState().selectNode(result.node.id);
            }, 100);
            clearGlobalSearch();
            onResultClick?.();
          }}
        >
          {/* Role icon */}
          {result.node.role === 'user' ? (
            <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center shrink-0 mt-0.5">
              <User size={10} className="text-white" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={10} className="text-[var(--color-accent)]" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Conversation name */}
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                {result.conversationTitle}
              </span>
              {result.node.starred && (
                <Star size={10} className="text-amber-500 fill-amber-500 shrink-0" />
              )}
              {result.node.deadEnd && (
                <Flag size={10} className="text-[var(--color-text-muted)] shrink-0" />
              )}
            </div>
            {/* Highlighted snippet */}
            <p className="text-xs text-[var(--color-text)] line-clamp-2">
              {result.snippet}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
