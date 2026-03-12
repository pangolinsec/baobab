import { useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useTreeStore } from '../../store/useTreeStore';
import { ModelSelector } from '../shared/ModelSelector';
import { startResearchRun } from '../../agents/research/researchRunner';
import { DEFAULT_TREE_SEARCH_PROMPT, DEFAULT_WEB_SEARCH_PROMPT } from '../../agents/research/planner';
import type { ResearchConfig, ResearchMode } from '../../types';

interface ResearchConfigModalProps {
  triggerNodeId: string;
  initialMode?: ResearchMode;
  initialGoal?: string;
  onClose: () => void;
}

export function ResearchConfigModal({
  triggerNodeId,
  initialMode = 'tree-search',
  initialGoal = '',
  onClose,
}: ResearchConfigModalProps) {
  const currentConversation = useTreeStore((s) => s.currentConversation);

  const defaultProvider = useSettingsStore((s) => s.defaultProvider);
  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const researchDefaultPlannerProviderId = useSettingsStore((s) => s.researchDefaultPlannerProviderId);
  const researchDefaultPlannerModelId = useSettingsStore((s) => s.researchDefaultPlannerModelId);
  const researchDefaultSubAgentProviderId = useSettingsStore((s) => s.researchDefaultSubAgentProviderId);
  const researchDefaultSubAgentModelId = useSettingsStore((s) => s.researchDefaultSubAgentModelId);
  const researchMaxSubTasks = useSettingsStore((s) => s.researchMaxSubTasks);
  const researchMaxToolCallsPerSubAgent = useSettingsStore((s) => s.researchMaxToolCallsPerSubAgent);
  const researchMaxTotalToolCalls = useSettingsStore((s) => s.researchMaxTotalToolCalls);
  const researchTreeSearchPrompt = useSettingsStore((s) => s.researchTreeSearchPrompt);
  const researchWebSearchPrompt = useSettingsStore((s) => s.researchWebSearchPrompt);

  const [mode, setMode] = useState<ResearchMode>(initialMode);
  const [goal, setGoal] = useState(initialGoal);

  const defaultPromptForMode = mode === 'tree-search'
    ? (researchTreeSearchPrompt || DEFAULT_TREE_SEARCH_PROMPT)
    : (researchWebSearchPrompt || DEFAULT_WEB_SEARCH_PROMPT);

  const [prompt, setPrompt] = useState(defaultPromptForMode);
  const [promptDirty, setPromptDirty] = useState(false);

  // Model selections — stored as "providerId:modelId" for simplicity
  const [plannerModelId, setPlannerModelId] = useState(researchDefaultPlannerModelId || defaultModel);
  const [subAgentModelId, setSubAgentModelId] = useState(researchDefaultSubAgentModelId || defaultModel);

  // Limits as strings (validated on submit)
  const [maxSubTasks, setMaxSubTasks] = useState(String(researchMaxSubTasks ?? 7));
  const [maxToolCallsPerAgent, setMaxToolCallsPerAgent] = useState(String(researchMaxToolCallsPerSubAgent ?? 20));
  const [maxTotalToolCalls, setMaxTotalToolCalls] = useState(String(researchMaxTotalToolCalls ?? 100));

  const [error, setError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const handleModeChange = (newMode: ResearchMode) => {
    if (newMode === mode) return;

    if (promptDirty) {
      const confirmed = window.confirm('You have edited the prompt. Switching modes will reset it to the default. Continue?');
      if (!confirmed) return;
    }

    setMode(newMode);
    const newDefault = newMode === 'tree-search'
      ? (researchTreeSearchPrompt || DEFAULT_TREE_SEARCH_PROMPT)
      : (researchWebSearchPrompt || DEFAULT_WEB_SEARCH_PROMPT);
    setPrompt(newDefault);
    setPromptDirty(false);
  };

  const handleStart = async () => {
    if (!goal.trim()) {
      setError('Please enter a research goal.');
      return;
    }
    if (!currentConversation) {
      setError('No conversation loaded.');
      return;
    }

    const parsedMaxSubTasks = parseInt(maxSubTasks, 10);
    const parsedMaxToolCallsPerAgent = parseInt(maxToolCallsPerAgent, 10);
    const parsedMaxTotalToolCalls = parseInt(maxTotalToolCalls, 10);

    if (Number.isNaN(parsedMaxSubTasks) || parsedMaxSubTasks < 1) {
      setError('Max sub-tasks must be at least 1.');
      return;
    }

    setIsStarting(true);
    setError('');

    const config: ResearchConfig = {
      goal: goal.trim(),
      prompt,
      plannerModelId,
      plannerProviderId: researchDefaultPlannerProviderId || defaultProvider,
      subAgentModelId,
      subAgentProviderId: researchDefaultSubAgentProviderId || defaultProvider,
      maxSubTasks: Math.min(parsedMaxSubTasks, 10),
      maxToolCallsPerSubAgent: Number.isNaN(parsedMaxToolCallsPerAgent) ? 20 : parsedMaxToolCallsPerAgent,
      maxTotalToolCalls: Number.isNaN(parsedMaxTotalToolCalls) ? 100 : parsedMaxTotalToolCalls,
    };

    try {
      await startResearchRun(currentConversation.id, triggerNodeId, mode, config);
      useTreeStore.getState().setViewMode('research');
      onClose();
    } catch (err) {
      setError(String(err));
      setIsStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[560px] max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Research</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Mode */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Mode</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={mode === 'tree-search'}
                  onChange={() => handleModeChange('tree-search')}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text)]">Tree Search</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={mode === 'web-search'}
                  onChange={() => handleModeChange('web-search')}
                  className="accent-[var(--color-accent)]"
                />
                <span className="text-sm text-[var(--color-text)]">Web Search</span>
              </label>
            </div>
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Goal</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What do you want to research?"
              className="w-full h-20 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text)] placeholder-[var(--color-placeholder)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-[var(--color-text)]">Prompt</label>
              {promptDirty && (
                <button
                  onClick={() => { setPrompt(defaultPromptForMode); setPromptDirty(false); }}
                  className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  <RotateCcw size={12} />
                  Reset to default
                </button>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setPromptDirty(true); }}
              className="w-full h-24 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text)] font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>

          {/* Models */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Models</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)] w-32 shrink-0">Planner / Synthesizer</span>
                <ModelSelector
                  value={plannerModelId}
                  onChange={(m) => setPlannerModelId(m || defaultModel)}
                  showInherit={false}
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)] w-32 shrink-0">Sub-agents</span>
                <ModelSelector
                  value={subAgentModelId}
                  onChange={(m) => setSubAgentModelId(m || defaultModel)}
                  showInherit={false}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-2">Limits</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Max sub-tasks</label>
                <input
                  type="number"
                  value={maxSubTasks}
                  onChange={(e) => setMaxSubTasks(e.target.value)}
                  min={1}
                  max={10}
                  className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Calls / agent</label>
                <input
                  type="number"
                  value={maxToolCallsPerAgent}
                  onChange={(e) => setMaxToolCallsPerAgent(e.target.value)}
                  min={1}
                  className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Total calls</label>
                <input
                  type="number"
                  value={maxTotalToolCalls}
                  onChange={(e) => setMaxTotalToolCalls(e.target.value)}
                  min={1}
                  className="w-full px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-sm text-[var(--color-text)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={isStarting || !goal.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isStarting ? 'Starting...' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
