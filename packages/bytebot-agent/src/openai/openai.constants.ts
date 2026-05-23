import { BytebotAgentModel } from 'src/agent/agent.types';

export const OPENAI_MODELS: BytebotAgentModel[] = [
  {
    provider: 'openai',
    name: 'gpt-5.5-2026-04-23',
    title: 'GPT-5.5',
    contextWindow: 200000,
  },
  {
    provider: 'openai',
    name: 'gpt-5.4-2026-03-05',
    title: 'GPT-5.4',
    contextWindow: 1047576,
  },
  {
    provider: 'openai',
    name: 'gpt-5.4-mini-2026-03-17',
    title: 'GPT-5.4 Mini',
    contextWindow: 1047576,
  },
  {
    provider: 'openai',
    name: 'gpt-5.4-nano-2026-03-17',
    title: 'GPT-5.4 Nano',
    contextWindow: 1047576,
  },
];

export const DEFAULT_MODEL = OPENAI_MODELS[0];
