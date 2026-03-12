import { User, Sparkles, Star } from 'lucide-react';
import { useSearchStore } from '../../store/useSearchStore';

export function SearchFilters() {
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);

  const toggleRole = (role: 'user' | 'assistant') => {
    const current = filters.roles;
    if (current.includes(role)) {
      if (current.length === 1) return; // Don't allow empty
      setFilters({ roles: current.filter(r => r !== role) });
    } else {
      setFilters({ roles: [...current, role] });
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border-soft)]">
      <span className="text-[10px] text-[var(--color-text-muted)]">Filter:</span>
      <button
        onClick={() => toggleRole('user')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
          filters.roles.includes('user')
            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
        }`}
      >
        <User size={10} />
        User
      </button>
      <button
        onClick={() => toggleRole('assistant')}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
          filters.roles.includes('assistant')
            ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
        }`}
      >
        <Sparkles size={10} />
        Claude
      </button>
      <button
        onClick={() => setFilters({ starredOnly: !filters.starredOnly })}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
          filters.starredOnly
            ? 'bg-amber-500/15 text-amber-600'
            : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
        }`}
      >
        <Star size={10} />
        Starred
      </button>
    </div>
  );
}
