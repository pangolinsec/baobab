import { Trash2 } from 'lucide-react';
import type { ToolCallRecord } from '../../api/providers/types';

interface ToolCallEditorProps {
  toolCall: ToolCallRecord;
  rawInput: string;
  onChange: (tc: ToolCallRecord, rawInput: string) => void;
  onRemove: () => void;
}

export function ToolCallEditor({ toolCall, rawInput, onChange, onRemove }: ToolCallEditorProps) {
  let jsonError: string | null = null;
  try {
    JSON.parse(rawInput);
  } catch (e) {
    jsonError = (e as Error).message;
  }

  const handleRawInputChange = (newRaw: string) => {
    try {
      const parsed = JSON.parse(newRaw);
      onChange({ ...toolCall, input: parsed }, newRaw);
    } catch {
      // Keep the raw string but don't update parsed input
      onChange(toolCall, newRaw);
    }
  };

  return (
    <div className="border-l-2 border-emerald-500/30 pl-3 space-y-2">
      {/* Header: tool name + remove */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={toolCall.toolName}
          onChange={(e) => onChange({ ...toolCall, toolName: e.target.value }, rawInput)}
          placeholder="Tool name"
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
        />
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
          title="Remove tool call"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Input JSON */}
      <div>
        <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Input</label>
        <textarea
          value={rawInput}
          onChange={(e) => handleRawInputChange(e.target.value)}
          rows={4}
          className={`w-full mt-1 resize-y rounded-lg border bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 transition-all ${
            jsonError
              ? 'border-red-400 focus:ring-red-400/40 focus:border-red-400'
              : 'border-[var(--color-border)] focus:ring-emerald-500/40 focus:border-emerald-500'
          }`}
          placeholder="{}"
        />
        {jsonError && (
          <p className="mt-1 text-[10px] text-red-500">{jsonError}</p>
        )}
      </div>

      {/* Result */}
      <div>
        <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Result</label>
        <textarea
          value={toolCall.result || ''}
          onChange={(e) => onChange({ ...toolCall, result: e.target.value }, rawInput)}
          rows={3}
          className="w-full mt-1 resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-xs text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
          placeholder="Tool result..."
        />
      </div>

      {/* Search provider (only if present) */}
      {toolCall.searchProvider !== undefined && (
        <div>
          <label className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Search Provider</label>
          <input
            type="text"
            value={toolCall.searchProvider || ''}
            onChange={(e) => onChange({ ...toolCall, searchProvider: e.target.value || undefined }, rawInput)}
            className="w-full mt-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs text-[var(--color-text)] placeholder-[var(--color-placeholder)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all"
            placeholder="e.g. tavily"
          />
        </div>
      )}
    </div>
  );
}
