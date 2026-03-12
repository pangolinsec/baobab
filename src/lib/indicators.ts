import type { TreeNode } from '../types';
import { abbreviateModelName } from './models';

export interface NodeIndicators {
  modelOverridden: boolean;   // model differs from previous turn
  modelName: string;          // display name: override model if set, else actual model
  systemOverridden: boolean;  // THIS node has systemPromptOverride set
  settingsOverridden: boolean; // placeholder (always false for now)
  hasAnyOverride: boolean;    // any of the above
}

export function getNodeIndicators(
  node: TreeNode,
  nodes: Record<string, TreeNode>,
  _conversationModel: string,
  _settingsDefaultModel: string,
  _availableModels: { id: string }[]
): NodeIndicators {
  const hasCascadeModelOverride = node.modelOverride !== undefined;

  // One-shot: user node's model differs from parent's actual model,
  // indicating the model was changed for this message without a cascade override.
  // Only checked on user nodes — assistant nodes inherit from their parent user node.
  let isOneShotModelChange = false;
  if (node.role === 'user' && node.parentId && !hasCascadeModelOverride) {
    const parent = nodes[node.parentId];
    if (parent && parent.model) {
      isOneShotModelChange = node.model !== parent.model;
    }
  }

  const modelOverridden = hasCascadeModelOverride || isOneShotModelChange;

  const displayModel = node.modelOverride || node.model;
  const modelName = abbreviateModelName(displayModel);
  // System prompt: cascade override OR one-shot change (usedSystemPrompt stored on node)
  const systemOverridden = node.systemPromptOverride !== undefined || node.usedSystemPrompt !== undefined;
  const settingsOverridden = false;

  return {
    modelOverridden,
    modelName,
    systemOverridden,
    settingsOverridden,
    hasAnyOverride: modelOverridden || systemOverridden || settingsOverridden,
  };
}
