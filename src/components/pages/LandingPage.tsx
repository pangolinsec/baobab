import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, AlertCircle } from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { ChatInput } from '../chat/ChatInput';
import { WelcomeScreen } from '../tree/WelcomeScreen';

export function LandingPage() {
  const navigate = useNavigate();
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const conversations = useTreeStore((s) => s.conversations);
  const createConversation = useTreeStore((s) => s.createConversation);
  const apiKey = useSettingsStore((s) => s.apiKey);

  // Draft conversation state — user clicked "+" and has an empty conversation
  if (currentConversation) {
    return (
      <div className="flex-1 flex flex-col">
        <WelcomeScreen />
        <ChatInput />
      </div>
    );
  }

  // Normal landing page
  const recentConversations = conversations.slice(0, 5);

  const handleNewConversation = async () => {
    await createConversation();
    // Stay on / — the component will re-render with draft state
  };

  const basePath = import.meta.env.BASE_URL || '/';

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
      {/* Baobab background silhouette */}
      <div
        className="absolute inset-0 pointer-events-none dark:invert"
        style={{
          backgroundImage: `url(${basePath}baobab-bg.png)`,
          backgroundPosition: 'bottom center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '90% auto',
          opacity: 0.04,
        }}
      />
      <div className="max-w-md w-full px-6 relative z-10">
        {/* Title + description */}
        <div className="text-center mb-8">
          <img
            src={`${basePath}icon-192.png`}
            alt="Baobab"
            className="w-12 h-12 mx-auto mb-4 opacity-80"
          />
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">
            Baobab
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Explore conversations as branching trees. Reply to any message to
            create a new branch, and visualize the full structure of your
            dialogue.
          </p>
        </div>

        {/* API key warning */}
        {!apiKey && (
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-2 mb-6 px-4 py-3 rounded-xl bg-[var(--color-accent)]/10 text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
          >
            <AlertCircle size={16} />
            <span>Set your API key in Settings to start chatting</span>
          </button>
        )}

        {/* New conversation button */}
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors mb-6"
        >
          <Plus size={18} />
          New Conversation
        </button>

        {/* Recent conversations */}
        {recentConversations.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Recent
            </h3>
            <div className="space-y-1">
              {recentConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/c/${conv.id}`)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-soft)] transition-colors text-left"
                >
                  <MessageSquare size={14} className="shrink-0 opacity-60" />
                  <span className="truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
