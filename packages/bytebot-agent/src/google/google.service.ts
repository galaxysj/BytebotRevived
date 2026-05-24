import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isComputerToolUseContentBlock,
  isImageContentBlock,
  isUserActionContentBlock,
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ThinkingContentBlock,
  ToolUseContentBlock,
} from '@bytebot/shared';
import {
  BytebotAgentService,
  BytebotAgentInterrupt,
  BytebotAgentResponse,
} from '../agent/agent.types';
import { Message, Role } from '@prisma/client';
import { googleTools } from './google.tools';
import {
  Content,
  GenerateContentResponse,
  GoogleGenAI,
  Part,
} from '@google/genai';
import { v4 as uuid } from 'uuid';
import { DEFAULT_MODEL } from './google.constants';

@Injectable()
export class GoogleService implements BytebotAgentService {
  private readonly google: GoogleGenAI;
  private readonly logger = new Logger(GoogleService.name);
  private readonly googleDebugLoggingEnabled = true;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not set. GoogleService will not work properly.',
      );
    }

    this.google = new GoogleGenAI({
      apiKey: apiKey || 'dummy-key-for-initialization',
    });
  }

  async generateMessage(
    systemPrompt: string,
    messages: Message[],
    model: string = DEFAULT_MODEL.name,
    useTools: boolean = true,
    signal?: AbortSignal,
  ): Promise<BytebotAgentResponse> {
    try {
      const maxTokens = 8192;
      const geminiThinkingConfig = {
        thinkingLevel: 'medium',
      } as any;

      // Convert our message content blocks to Anthropic's expected format
      const googleMessages = this.formatMessagesForGoogle(messages);

      if (this.googleDebugLoggingEnabled) {
        this.logger.debug(
          `Google request summary: ${JSON.stringify({
            model,
            messageCount: googleMessages.length,
            roleAndParts: googleMessages.map((msg) => ({
              role: msg.role,
              partTypes: (msg.parts || []).map((part) =>
                part.functionCall
                  ? {
                      type: 'functionCall',
                      name: part.functionCall.name,
                      id: part.functionCall.id,
                      hasThoughtSignature: Boolean(part.thoughtSignature),
                    }
                  : part.functionResponse
                    ? {
                        type: 'functionResponse',
                        name: part.functionResponse.name,
                        id: part.functionResponse.id,
                      }
                    : part.inlineData
                      ? { type: 'inlineData' }
                      : part.thought
                        ? {
                            type: 'thought',
                            hasThoughtSignature: Boolean(
                              part.thoughtSignature,
                            ),
                          }
                        : { type: 'text' },
              ),
            })),
          })}`,
        );
      }

      const response: GenerateContentResponse =
        await this.google.models.generateContent({
          model,
          contents: googleMessages,
          config: {
            thinkingConfig: geminiThinkingConfig,
            maxOutputTokens: maxTokens,
            systemInstruction: systemPrompt,
            tools: useTools
              ? [
                  {
                    functionDeclarations: googleTools,
                  },
                ]
              : [],
            abortSignal: signal,
          },
        });

      const candidate = response.candidates?.[0];

      if (this.googleDebugLoggingEnabled) {
        this.logger.debug(
          `Google response summary: ${JSON.stringify({
            candidateCount: response.candidates?.length || 0,
            usage: response.usageMetadata,
            finishReason: candidate?.finishReason,
            safetyRatings: candidate?.safetyRatings,
          })}`,
        );
      }

      if (!candidate) {
        throw new Error('No candidate found in response');
      }

      const content = candidate.content;

      if (!content) {
        throw new Error('No content found in candidate');
      }

      if (!content.parts || content.parts.length === 0) {
        throw new Error(
          `No parts found in content (finishReason=${candidate.finishReason || 'unknown'})`,
        );
      }

      return {
        contentBlocks: this.formatGoogleResponse(content.parts),
        tokenUsage: {
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      const err = error as any;

      if (String(err?.message || '').includes('AbortError')) {
        throw new BytebotAgentInterrupt();
      }

      if (this.googleDebugLoggingEnabled) {
        const errorDetails = {
          message: (error as any)?.message,
          status: (error as any)?.status,
          code: (error as any)?.code,
          cause: (error as any)?.cause,
          response: (error as any)?.response,
          error: (error as any)?.error,
        };
        this.logger.error(
          `Google raw error: ${JSON.stringify(errorDetails)}`,
        );
      }

      this.logger.error(
        `Error sending message to Google Gemini: ${err?.message || 'unknown error'}`,
        err?.stack,
      );
      throw error;
    }
  }

  /**
   * Convert our MessageContentBlock format to Google Gemini's message format
   */
  private formatMessagesForGoogle(messages: Message[]): Content[] {
    const googleMessages: Content[] = [];

    const unsignedToolUseIds = messages.flatMap((message) => {
      const blocks = message.content as MessageContentBlock[];
      return blocks
        .filter(
          (block) =>
            block.type === MessageContentType.ToolUse &&
            !(block as ToolUseContentBlock).signature,
        )
        .map((block) => (block as ToolUseContentBlock).id);
    });

    if (unsignedToolUseIds.length > 0) {
      throw new Error(
        `Missing thought_signature in functionCall parts: ${unsignedToolUseIds.join(', ')}`,
      );
    }

    // Process each message content block
    for (const message of messages) {
      const messageContentBlocks = message.content as MessageContentBlock[];

      const parts: Part[] = [];

      if (
        messageContentBlocks.every((block) => isUserActionContentBlock(block))
      ) {
        const userActionContentBlocks = messageContentBlocks.flatMap(
          (block) => block.content,
        );
        for (const block of userActionContentBlocks) {
          if (isComputerToolUseContentBlock(block)) {
            parts.push({
              text: `User performed action: ${block.name}\n${JSON.stringify(block.input, null, 2)}`,
            });
          } else if (isImageContentBlock(block)) {
            parts.push({
              inlineData: {
                data: block.source.data,
                mimeType: block.source.media_type,
              },
            });
          }
        }
      } else {
        for (const block of messageContentBlocks) {
          switch (block.type) {
            case MessageContentType.Text:
              parts.push({
                text: block.text,
              });
              break;
            case MessageContentType.ToolUse:
              if (!block.signature) {
                throw new Error(
                  `Missing thought_signature for tool call: ${block.name} (${block.id})`,
                );
              }

              parts.push({
                functionCall: {
                  id: block.id,
                  name: block.name,
                  args: block.input,
                },
                thoughtSignature: block.signature,
              });
              break;
            case MessageContentType.Image:
              parts.push({
                inlineData: {
                  data: block.source.data,
                  mimeType: block.source.media_type,
                },
              });
              break;
            case MessageContentType.ToolResult: {
              const toolResultContentBlock = block.content[0];
              const toolName =
                this.getToolName(block.tool_use_id, messages) ||
                'computer_screenshot';
              if (toolResultContentBlock.type === MessageContentType.Image) {
                parts.push({
                  functionResponse: {
                    id: block.tool_use_id,
                    name: toolName,
                    response: {
                      ...(!block.is_error && {
                        output: 'screenshot successful',
                      }),
                      ...(block.is_error && { error: block.content[0] }),
                    },
                  },
                });
                parts.push({
                  inlineData: {
                    data: toolResultContentBlock.source.data,
                    mimeType: toolResultContentBlock.source.media_type,
                  },
                });
                break;
              }

              parts.push({
                functionResponse: {
                  id: block.tool_use_id,
                  name: toolName,
                  response: {
                    ...(!block.is_error && { output: block.content[0] }),
                    ...(block.is_error && { error: block.content[0] }),
                  },
                },
              });
              break;
            }
            case MessageContentType.Thinking:
              parts.push({
                text: block.thinking,
                thoughtSignature: block.signature,
                thought: true,
              });
              break;
            default:
              parts.push({
                text: JSON.stringify(block),
              });
              break;
          }
        }
      }

      googleMessages.push({
        role: message.role === Role.USER ? 'user' : 'model',
        parts: parts,
      });
    }

    return googleMessages;
  }

  // Find the content block with the tool_use_id and return the name
  private getToolName(
    tool_use_id: string,
    messages: Message[],
  ): string | undefined {
    const toolMessage = messages.find((message) =>
      (message.content as MessageContentBlock[]).some(
        (block) =>
          block.type === MessageContentType.ToolUse && block.id === tool_use_id,
      ),
    );
    if (!toolMessage) {
      return undefined;
    }

    const toolBlock = (toolMessage.content as MessageContentBlock[]).find(
      (block) =>
        block.type === MessageContentType.ToolUse && block.id === tool_use_id,
    );
    if (!toolBlock) {
      return undefined;
    }
    return (toolBlock as ToolUseContentBlock).name;
  }

  /**
   * Convert Google Gemini's response content to our MessageContentBlock format
   */
  private formatGoogleResponse(parts: Part[]): MessageContentBlock[] {
    return parts.map((part) => {
      if (part.text) {
        // Remove HTML tags from the text response
        const cleanText = this.stripHtmlTags(part.text);
        return {
          type: MessageContentType.Text,
          text: cleanText,
        } as TextContentBlock;
      }

      if (part.thought) {
        return {
          type: MessageContentType.Thinking,
          signature: part.thoughtSignature,
          thinking: part.text,
        } as ThinkingContentBlock;
      }

      if (part.functionCall) {
        if (!part.thoughtSignature) {
          throw new Error(
            `Gemini functionCall missing thought_signature: ${part.functionCall.name} (${part.functionCall.id || 'no-id'})`,
          );
        }

        return {
          type: MessageContentType.ToolUse,
          id: part.functionCall.id || uuid(),
          name: part.functionCall.name,
          input: part.functionCall.args,
          signature: part.thoughtSignature,
        } as ToolUseContentBlock;
      }

      this.logger.warn(`Unknown content type from Google: ${JSON.stringify(part)}`);
      return {
        type: MessageContentType.Text,
        text: JSON.stringify(part),
      } as TextContentBlock;
    });
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtmlTags(text: string): string {
    return text.replace(/<[^>]*>/g, '');
  }
}
