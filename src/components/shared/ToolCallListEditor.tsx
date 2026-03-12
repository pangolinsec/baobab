import { useState } from 'react';
import { Globe, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { ToolCallEditor } from './ToolCallEditor';
import type { ToolCallRecord } from '../../api/providers/types';

interface ToolCallListEditorProps {
  toolCalls: ToolCallRecord[];
  rawInputs: string[];
  onChange: (toolCalls: ToolCallRecord[], rawInputs: string[]) => void;
  defaultExpanded?: boolean;
}

export function ToolCallListEditor({ toolCalls, rawInputs, onChange, defaultExpanded }: ToolCallListEditorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? toolCalls.length > 0);

  const handleToolCallChange = (index: number, tc: ToolCallRecord, rawInput: string) => {
    const newToolCalls = [...toolCalls];
    const newRawInputs = [...rawInputs];
    newToolCalls[index] = tc;
    newRawInputs[index] = rawInput;
    onChange(newToolCalls, newRawInputs);
  };

  const handleRemove = (index: number) => {
    const newToolCalls = toolCalls.filter((_, i) => i !== index);
    const newRawInputs = rawInputs.filter((_, i) => i !== index);
    onChange(newToolCalls, newRawInputs);
  };

  const handleAdd = () => {
    onChange(
      [...toolCalls, { id: crypto.randomUUID(), toolName: '', input: {}, result: '', round: 0 }],
      [...rawInputs, '{}'],
    );
    if (!expanded) setExpanded(true);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Globe size={14} />
          <span>Tool Calls</span>
          {toolCalls.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-[10px]">
              {toolCalls.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
          title="Add tool call"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {expanded && toolCalls.length > 0 && (
        <div className="mt-2 space-y-3">
          {toolCalls.map((tc, i) => (
            <ToolCallEditor
              key={i}
              toolCall={tc}
              rawInput={rawInputs[i] ?? '{}'}
              onChange={(updatedTc, updatedRaw) => handleToolCallChange(i, updatedTc, updatedRaw)}
              onRemove={() => handleRemove(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
