import { BytebotAgentModel } from '../agent/agent.types';

export const GOOGLE_MODELS: BytebotAgentModel[] = [
  {
    provider: 'google',
    name: 'gemini-3-flash-preview',
    title: 'Gemini 3 Flash',
    contextWindow: 1000000,
  },
  {
    provider: 'google',
    name: 'gemini-3.1-pro-preview',
    title: 'Gemini 3.1 Pro',
    contextWindow: 1000000,
  },
  {
    provider: 'google',
    name: 'gemini-3.1-flash-lite',
    title: 'Gemini 3.1 Flash Lite',
    contextWindow: 1000000,
  },
  {
    provider: 'google',
    name: 'gemini-3.5-flash',
    title: 'Gemini 3.5 Flash',
    contextWindow: 1000000,
  },
];

export const DEFAULT_MODEL = GOOGLE_MODELS[0];
