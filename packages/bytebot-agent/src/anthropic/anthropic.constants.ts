import { BytebotAgentModel } from '../agent/agent.types';

export const ANTHROPIC_MODELS: BytebotAgentModel[] = [
  {
    provider: 'anthropic',
    name: 'claude-opus-4-7',
    title: 'Claude Opus 4.7',
    contextWindow: 200000,
  },
  {
    provider: 'anthropic',
    name: 'claude-sonnet-4-6',
    title: 'Claude Sonnet 4.6',
    contextWindow: 200000,
  },
  {
    provider: 'anthropic',
    name: 'claude-haiku-4-5-20251001',
    title: 'Claude Haiku 4.5',
    contextWindow: 200000,
  },
];

export const DEFAULT_MODEL = ANTHROPIC_MODELS[0];
