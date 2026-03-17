import { MessageSquare, GitBranch, Star, Flag, List, MousePointerClick, Search, Settings, RefreshCw } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTreeStore } from '../../store/useTreeStore';
import { abbreviateModelName } from '../../lib/models';

export function WelcomeScreen() {
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const defaultSystemPrompt = useSettingsStore((s) => s.defaultSystemPrompt);
  const defaultProvider = useSettingsStore((s) => s.defaultProvider);
  const currentConversation = useTreeStore((s) => s.currentConversation);

  const effectiveModel = currentConversation?.model || defaultModel;
  const effectivePrompt = currentConversation?.systemPrompt ?? defaultSystemPrompt;

  const basePath = import.meta.env.BASE_URL || '/';

  return (
    <div className="flex-1 overflow-y-auto relative">
      {/* Baobab background silhouette */}
      <div
        className="absolute inset-0 pointer-events-none dark:invert"
        style={{
          backgroundImage: `url(${basePath}baobab-bg.png)`,
          backgroundPosition: 'bottom center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '80% auto',
          opacity: 0.03,
        }}
      />
      <div className="max-w-lg w-full mx-auto py-12 px-8 space-y-6 relative z-10">
        {/* Config summary */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">New Conversation</h2>

          <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-card)] p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-muted)] w-20">Model</span>
              <span className="font-medium text-[var(--color-text)]">{abbreviateModelName(effectiveModel)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-muted)] w-20">Provider</span>
              <span className="font-medium text-[var(--color-text)] capitalize">{currentConversation?.providerId || defaultProvider}</span>
            </div>
            {effectivePrompt ? (
              <div className="flex items-start gap-2 text-xs">
                <span className="text-[var(--color-text-muted)] w-20 shrink-0 pt-0.5">System</span>
                <span className="text-[var(--color-text)] line-clamp-3">{effectivePrompt}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--color-text-muted)] w-20">System</span>
                <span className="text-[var(--color-text-muted)] italic">No system prompt</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick tips */}
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Quick tips</h3>
          <div className="grid grid-cols-2 gap-2">
            <Tip icon={<GitBranch size={14} />} text="Click any assistant node to select it and reply from there" />
            <Tip icon={<MousePointerClick size={14} />} text="Shift+click to browse a node without moving the reply target" />
            <Tip icon={<MousePointerClick size={14} />} text="Right-click nodes to resend, duplicate, summarize, or branch" />
            <Tip icon={<List size={14} />} text="Toggle Tree / Thread view in the header" />
            <Tip icon={<Star size={14} />} text="Star important messages for quick access" />
            <Tip icon={<Flag size={14} />} text="Flag dead-end branches to dim them" />
            <Tip icon={<Search size={14} />} text="Ctrl+F to search within a conversation" />
            <Tip icon={<MessageSquare size={14} />} text="Override model or system prompt per message" />
            <Tip icon={<RefreshCw size={14} />} text="Select a model, then Resend to replay a message with a different model" />
            <Tip icon={<Settings size={14} />} text="Configure providers and models in Settings" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2">
      <span className="text-[var(--color-text-muted)] shrink-0 mt-0.5">{icon}</span>
      <span className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{text}</span>
    </div>
  );
}
