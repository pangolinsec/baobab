import Dexie, { type Table } from 'dexie';
import type { TreeNode, Conversation, AppSettings, Project, LocalProjectFile, ResearchRun } from '../types';

export class BaobabDB extends Dexie {
  conversations!: Table<Conversation, string>;
  nodes!: Table<TreeNode, string>;
  settings!: Table<AppSettings, number>;
  projects!: Table<Project, string>;
  projectFiles!: Table<LocalProjectFile, string>;
  researchRuns!: Table<ResearchRun, string>;

  constructor() {
    super('baobab');
    this.version(1).stores({
      conversations: 'id, createdAt, updatedAt',
      nodes: 'id, conversationId, parentId',
      settings: '++id',
    });
    this.version(2).stores({
      conversations: 'id, createdAt, updatedAt',
      nodes: 'id, conversationId, parentId',
      settings: '++id',
    }).upgrade(tx => {
      return tx.table('nodes').toCollection().modify(node => {
        if (node.nodeType === undefined) node.nodeType = 'standard';
        if (node.userModified === undefined) node.userModified = false;
        if (node.starred === undefined) node.starred = false;
        if (node.deadEnd === undefined) node.deadEnd = false;
      });
    });
    this.version(3).stores({
      conversations: 'id, createdAt, updatedAt, *tags',
      nodes: 'id, conversationId, parentId, starred',
      settings: '++id',
    }).upgrade(tx => {
      return tx.table('conversations').toCollection().modify(conv => {
        if (conv.tags === undefined) conv.tags = [];
      });
    });
    this.version(4).stores({
      conversations: 'id, createdAt, updatedAt, *tags, projectId',
      nodes: 'id, conversationId, parentId, starred, nodeType',
      settings: '++id',
      projects: 'id, createdAt, updatedAt',
    }).upgrade(tx => {
      return tx.table('conversations').toCollection().modify(conv => {
        if (conv.projectId === undefined) conv.projectId = undefined;
      });
    });
    this.version(5).stores({
      conversations: 'id, createdAt, updatedAt, *tags, projectId',
      nodes: 'id, conversationId, parentId, starred, nodeType',
      settings: '++id',
      projects: 'id, createdAt, updatedAt',

    });
    this.version(6).stores({
      conversations: 'id, createdAt, updatedAt, *tags, projectId',
      nodes: 'id, conversationId, parentId, starred, nodeType',
      settings: '++id',
      projects: 'id, createdAt, updatedAt',

      projectFiles: 'id, projectId, createdAt',
    });
    this.version(7).stores({
      conversations: 'id, createdAt, updatedAt, *tags, projectId',
      nodes: 'id, conversationId, parentId, starred, nodeType',
      settings: '++id',
      projects: 'id, createdAt, updatedAt',

      projectFiles: 'id, projectId, createdAt',
      researchRuns: 'id, conversationId, triggerNodeId, status',
    });

    // Feature 39: Migrate thinking string → thinkingBlocks array
    this.version(8).stores({
      conversations: 'id, createdAt, updatedAt, *tags, projectId',
      nodes: 'id, conversationId, parentId, starred, nodeType',
      settings: '++id',
      projects: 'id, createdAt, updatedAt',

      projectFiles: 'id, projectId, createdAt',
      researchRuns: 'id, conversationId, triggerNodeId, status',
    }).upgrade(tx => {
      return tx.table('nodes').toCollection().modify(node => {
        if (typeof node.thinking === 'string' && node.thinking.length > 0) {
          node.thinkingBlocks = [{
            id: crypto.randomUUID(),
            text: node.thinking,
            providerId: 'anthropic',
            isOriginal: true,
            plaintextEnabled: false,
            active: true,
          }];
        }
        delete node.thinking;
      });
    });

    // Add active field to existing thinking blocks (default true)
    this.version(9).stores({
      conversations: 'id, createdAt, updatedAt, *tags, projectId',
      nodes: 'id, conversationId, parentId, starred, nodeType',
      settings: '++id',
      projects: 'id, createdAt, updatedAt',

      projectFiles: 'id, projectId, createdAt',
      researchRuns: 'id, conversationId, triggerNodeId, status',
    }).upgrade(tx => {
      return tx.table('nodes').toCollection().modify(node => {
        if (node.thinkingBlocks && Array.isArray(node.thinkingBlocks)) {
          for (const block of node.thinkingBlocks) {
            if (block.active === undefined) {
              block.active = true;
            }
          }
        }
      });
    });

    // ADR-022: Backfill id/round on existing tool call records
    this.version(11).stores({
      conversations: 'id, createdAt, updatedAt, *tags, projectId',
      nodes: 'id, conversationId, parentId, starred, nodeType',
      settings: '++id',
      projects: 'id, createdAt, updatedAt',

      projectFiles: 'id, projectId, createdAt',
      researchRuns: 'id, conversationId, triggerNodeId, status',
    }).upgrade(tx => {
      return tx.table('nodes').toCollection().modify(node => {
        if (node.toolCalls && Array.isArray(node.toolCalls)) {
          for (const tc of node.toolCalls) {
            if (tc.id === undefined) tc.id = crypto.randomUUID();
            if (tc.round === undefined) tc.round = 0;
          }
        }
      });
    });
  }
}

export const db = new BaobabDB();
