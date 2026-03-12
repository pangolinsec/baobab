import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  Info,
  Database,
} from 'lucide-react';
import { useTreeStore } from '../../store/useTreeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { getPathToRoot, resolveModel, resolveSystemPrompt, resolveProviderCascade } from '../../lib/tree';
import { abbreviateModelName } from '../../lib/models';
import type { TreeNode } from '../../types';

interface RawContextTabProps {
  node: TreeNode;
}

function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-2 w-full text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[10px]">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div className="border-l-2 border-[var(--color-accent)]/30 pl-3">
          {children}
        </div>
      )}
    </div>
  );
}

function KeyValue({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2 py-1 text-xs">
      <span className="text-[var(--color-text-muted)] shrink-0 min-w-[100px]">{label}</span>
      <span className={`text-[var(--color-text)] break-all ${mono ? 'font-mono text-[11px]' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const isUser = role === 'user';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
      isUser
        ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]'
    }`}>
      {role}
    </span>
  );
}

function ExpandableText({ text, maxChars = 150, mono = false }: { text: string; maxChars?: number; mono?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxChars;

  return (
    <div>
      <div className={`text-xs text-[var(--color-text)] whitespace-pre-wrap break-all ${mono ? 'font-mono text-[11px]' : ''}`}>
        {needsTruncation && !expanded ? text.slice(0, maxChars) + '…' : text}
      </div>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-[var(--color-accent)] hover:underline mt-0.5"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function JsonBlock({ data, maxLines = 20 }: { data: unknown; maxLines?: number }) {
  const [expanded, setExpanded] = useState(false);
  const formatted = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const lines = formatted.split('\n');
  const needsTruncation = lines.length > maxLines;

  return (
    <div>
      <pre className="text-[11px] font-mono text-[var(--color-text)] bg-[var(--color-bg-secondary)] rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[400px] overflow-y-auto">
        {needsTruncation && !expanded
          ? lines.slice(0, maxLines).join('\n') + '\n…'
          : formatted}
      </pre>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-[var(--color-accent)] hover:underline mt-1"
        >
          {expanded ? 'Show less' : `Show all (${lines.length} lines)`}
        </button>
      )}
    </div>
  );
}

export function RawContextTab({ node }: RawContextTabProps) {
  const nodes = useTreeStore((s) => s.nodes);
  const currentConversation = useTreeStore((s) => s.currentConversation);
  const isStreaming = useTreeStore((s) => s.isStreaming);

  const {
    defaultModel,
    defaultSystemPrompt,
    defaultProvider,
    availableModels,
    providers,
    thinkingEnabled,
    thinkingBudget,
    temperature,
    maxOutputTokens,
    topP,
    topK,
    captureRawApiData,
  } = useSettingsStore();

  const [copied, setCopied] = useState(false);

  // Resolve current settings for this node position
  const resolved = useMemo(() => {
    if (!currentConversation) return null;

    const { model, providerId } = resolveModel(
      node.id,
      nodes,
      currentConversation.model,
      defaultModel,
      availableModels,
      currentConversation.providerId,
      defaultProvider
    );

    const systemPrompt = node.usedSystemPrompt !== undefined
      ? node.usedSystemPrompt
      : resolveSystemPrompt(
          node.id,
          nodes,
          currentConversation.systemPrompt,
          defaultSystemPrompt
        );

    const resolvedProviderId = resolveProviderCascade(
      node.id,
      nodes,
      currentConversation.providerId,
      defaultProvider
    );

    const providerConfig = providers.find(p => p.id === resolvedProviderId);

    return { model, providerId, systemPrompt, resolvedProviderId, providerName: providerConfig?.name || resolvedProviderId };
  }, [node.id, nodes, currentConversation, defaultModel, defaultSystemPrompt, defaultProvider, availableModels, providers]);

  // Build messages array
  const messages = useMemo(() => {
    const path = getPathToRoot(node.id, nodes);
    return path
      .filter(n => n.content && !(n.parentId === null && n.role === 'assistant'))
      .map(n => ({ role: n.role, content: n.content }));
  }, [node.id, nodes]);

  // Build tools info
  const toolsInfo = useMemo(() => {
    if (!currentConversation?.webSearchEnabled) return null;
    const searchProvider = currentConversation.searchProvider || 'duckduckgo';
    const providerLabels: Record<string, string> = { duckduckgo: 'DuckDuckGo', tavily: 'Tavily', bing: 'Bing' };
    return { toolName: 'web_search', searchProvider: providerLabels[searchProvider] || searchProvider };
  }, [currentConversation]);

  const handleCopyJson = async () => {
    const json: Record<string, unknown> = {
      request: {
        model: resolved?.model || node.model,
        system: resolved?.systemPrompt || undefined,
        messages,
        max_tokens: maxOutputTokens,
        temperature,
        ...(thinkingEnabled ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } } : {}),
        ...(topP !== null ? { top_p: topP } : {}),
        ...(topK !== null ? { top_k: topK } : {}),
        ...(toolsInfo ? { tools: [{ type: 'web_search', name: toolsInfo.toolName }] } : {}),
      },
    };

    if (node.role === 'assistant') {
      json.response = {
        content: node.content,
        ...(node.thinkingBlocks?.length ? { thinking_blocks: node.thinkingBlocks } : {}),
        ...(node.tokenUsage ? { token_usage: { input_tokens: node.tokenUsage.inputTokens, output_tokens: node.tokenUsage.outputTokens } } : {}),
        ...(node.toolCalls?.length ? { tool_calls: node.toolCalls } : {}),
      };
    }

    if (node.rawApiRequest) {
      json.raw_request = node.rawApiRequest;
    }
    if (node.rawApiResponse) {
      json.raw_response = node.rawApiResponse;
    }

    json.metadata = {
      node_id: node.id,
      conversation_id: node.conversationId,
      created_at: new Date(node.createdAt).toISOString(),
      role: node.role,
      provider_id: node.providerId || resolved?.resolvedProviderId,
    };

    await navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Captured Raw API Data */}
        {node.role === 'assistant' && (node.rawApiRequest || node.rawApiResponse) && (
          <>
            {node.rawApiRequest && (
              <CollapsibleSection title="Captured API Request" defaultOpen>
                <KeyValue label="Endpoint" value={node.rawApiRequest.url} mono />
                <KeyValue label="Method" value={node.rawApiRequest.method} />
                <KeyValue label="Provider" value={`${node.rawApiRequest.providerName} (${node.rawApiRequest.providerId})`} />
                <KeyValue label="Captured at" value={new Date(node.rawApiRequest.timestamp).toLocaleString()} />
                <div className="mt-2">
                  <span className="text-[var(--color-text-muted)] text-xs">Request body</span>
                  <div className="mt-1">
                    <JsonBlock data={node.rawApiRequest.body} />
                  </div>
                </div>
              </CollapsibleSection>
            )}
            {node.rawApiResponse && (
              <CollapsibleSection title="Captured API Response" defaultOpen>
                {node.rawApiResponse.statusCode !== undefined && (
                  <KeyValue label="Status" value={String(node.rawApiResponse.statusCode)} />
                )}
                <KeyValue label="Provider" value={node.rawApiResponse.providerId} />
                <KeyValue label="Captured at" value={new Date(node.rawApiResponse.timestamp).toLocaleString()} />
                {node.rawApiResponse.headers ? (
                  <div className="mt-2">
                    <span className="text-[var(--color-text-muted)] text-xs">Response headers</span>
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(node.rawApiResponse.headers).map(([k, v]) => (
                        <div key={k} className="text-[11px] font-mono">
                          <span className="text-[var(--color-text-muted)]">{k}:</span>{' '}
                          <span className="text-[var(--color-text)] break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-[var(--color-text-muted)] italic mt-1">
                    Headers not available for this provider.
                  </div>
                )}
                {node.rawApiResponse.body && (
                  <div className="mt-2">
                    <span className="text-[var(--color-text-muted)] text-xs">Response body</span>
                    <div className="mt-1">
                      <JsonBlock data={node.rawApiResponse.body} />
                    </div>
                  </div>
                )}
              </CollapsibleSection>
            )}
          </>
        )}

        {/* Notice when raw data is not available */}
        {node.role === 'assistant' && !node.rawApiRequest && !node.rawApiResponse && (
          <div className="mb-4 flex items-start gap-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded-lg p-3">
            <Database size={14} className="shrink-0 mt-0.5" />
            <span>
              {captureRawApiData
                ? 'Raw API data was not captured for this node (generated before capture was enabled).'
                : "Enable 'Capture Raw API Data' in Settings \u2192 Advanced to record request/response data."}
            </span>
          </div>
        )}

        {/* Section 1: Request Parameters */}
        <CollapsibleSection title="Request Parameters" defaultOpen={!node.rawApiRequest}>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
            <Info size={10} />
            Current settings — parameters may have differed at generation time.
          </div>
          <KeyValue label="Model" value={resolved ? `${abbreviateModelName(resolved.model)} (${resolved.model})` : node.model} />
          <KeyValue label="Provider" value={resolved?.providerName} />
          {resolved?.systemPrompt && (
            <div className="py-1">
              <span className="text-[var(--color-text-muted)] text-xs">System prompt</span>
              <div className="mt-1">
                <ExpandableText text={resolved.systemPrompt} maxChars={200} />
              </div>
            </div>
          )}
          <KeyValue label="Temperature" value={String(temperature)} />
          <KeyValue label="Max output tokens" value={String(maxOutputTokens)} />
          {topP !== null && <KeyValue label="Top P" value={String(topP)} />}
          {topK !== null && <KeyValue label="Top K" value={String(topK)} />}
          <KeyValue label="Thinking" value={thinkingEnabled ? `Enabled (budget: ${thinkingBudget.toLocaleString()})` : 'Disabled'} />
          {toolsInfo && (
            <KeyValue label="Tools" value={`web_search (${toolsInfo.searchProvider})`} />
          )}
        </CollapsibleSection>

        {/* Section 2: Messages Array */}
        <CollapsibleSection title="Messages Array" badge={String(messages.length)} defaultOpen={!node.rawApiRequest}>
          {messages.length === 0 ? (
            <div className="text-xs text-[var(--color-text-muted)] py-2">No messages in path.</div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg, i) => (
                <MessageRow key={i} index={i} role={msg.role} content={msg.content} />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {/* Section 3: Response Metadata (assistant only) */}
        {node.role === 'assistant' && (
          <CollapsibleSection title="Response Metadata" defaultOpen={!node.rawApiRequest}>
            <KeyValue
              label="Token usage"
              value={
                isStreaming
                  ? 'Pending…'
                  : node.tokenUsage
                    ? `${node.tokenUsage.inputTokens.toLocaleString()} in / ${node.tokenUsage.outputTokens.toLocaleString()} out`
                    : undefined
              }
            />
            {node.thinkingBlocks && node.thinkingBlocks.length > 0 && (
              <div className="py-1">
                <span className="text-[var(--color-text-muted)] text-xs">
                  Thinking blocks ({node.thinkingBlocks.length})
                </span>
                {node.thinkingBlocks.map((block, i) => (
                  <div key={block.id} className="mt-1 mb-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] mb-0.5">
                      <span>Block {i + 1}</span>
                      <span className="px-1 py-0.5 rounded bg-[var(--color-bg-secondary)]">{block.providerId}</span>
                      {block.signature && <span className="text-emerald-500">signed</span>}
                      {block.isOriginal ? <span>original</span> : <span className="text-violet-500">injected</span>}
                      <span>plaintext: {block.plaintextEnabled ? 'on' : 'off'}</span>
                    </div>
                    <ExpandableText text={block.text} maxChars={200} mono />
                    {block.signature && (
                      <div className="mt-0.5">
                        <span className="text-[10px] text-[var(--color-text-muted)]">Signature: </span>
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)] break-all">
                          {block.signature.slice(0, 40)}…
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {node.toolCalls && node.toolCalls.length > 0 && (
              <div className="py-1">
                <span className="text-[var(--color-text-muted)] text-xs">Tool calls ({node.toolCalls.length})</span>
                <div className="mt-1 space-y-2">
                  {node.toolCalls.map((tc, i) => (
                    <div key={i} className="text-[11px] bg-[var(--color-bg-secondary)] rounded-lg p-2">
                      <div className="font-medium text-[var(--color-text)]">{tc.toolName}</div>
                      <div className="font-mono text-[var(--color-text-muted)] mt-0.5 break-all">
                        {JSON.stringify(tc.input)}
                      </div>
                      {tc.result && (
                        <div className="mt-1 text-[var(--color-text-muted)] max-h-32 overflow-y-auto whitespace-pre-wrap">
                          {tc.result}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <KeyValue label="Content length" value={`${node.content.length.toLocaleString()} chars`} />
          </CollapsibleSection>
        )}

        {/* Section 4: Node Metadata */}
        <CollapsibleSection title="Node Metadata">
          <KeyValue label="ID" value={<NodeIdDisplay id={node.id} />} mono />
          <KeyValue label="Created" value={new Date(node.createdAt).toLocaleString()} />
          <KeyValue label="Role" value={node.role} />
          <KeyValue label="Source" value={node.source || 'user'} />
          <KeyValue label="Node type" value={node.nodeType} />
          <KeyValue label="Model (stored)" value={node.model ? abbreviateModelName(node.model) : undefined} />
          <KeyValue label="Provider ID" value={node.providerId} />
          <KeyValue label="Model override" value={node.modelOverride ? abbreviateModelName(node.modelOverride) : undefined} />
          <KeyValue label="System prompt override" value={
            node.systemPromptOverride !== undefined
              ? (node.systemPromptOverride || '(cleared)')
              : undefined
          } />
          <KeyValue label="Provider override" value={node.providerOverride} />
          <KeyValue label="User modified" value={node.userModified ? 'Yes' : 'No'} />
          <KeyValue label="Starred" value={node.starred ? 'Yes' : 'No'} />
          <KeyValue label="Dead end" value={node.deadEnd ? 'Yes' : 'No'} />
        </CollapsibleSection>
      </div>

      {/* Copy as JSON footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border-soft)]">
        <button
          onClick={handleCopyJson}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors w-full justify-center"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy as JSON'}
        </button>
      </div>
    </div>
  );
}

function MessageRow({ index, role, content }: { index: number; role: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = content.length > 150;

  return (
    <div
      className="text-xs cursor-pointer hover:bg-[var(--color-bg-secondary)]/50 rounded-lg p-1.5 -mx-1.5 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-[var(--color-text-muted)] text-[10px] font-mono w-4">{index}</span>
        <RoleBadge role={role} />
      </div>
      <div className="text-[var(--color-text)] whitespace-pre-wrap break-all pl-6">
        {truncated && !expanded ? content.slice(0, 150) + '…' : content}
      </div>
    </div>
  );
}

function NodeIdDisplay({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span title={id}>{id.slice(0, 8)}…</span>
      <button
        onClick={handleCopy}
        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        title="Copy full ID"
      >
        {copied ? <Check size={10} /> : <Copy size={10} />}
      </button>
    </span>
  );
}
