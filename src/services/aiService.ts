import { requestUrl } from 'obsidian';
import type { AiProvider } from '../types';

// Response shapes per provider
interface AnthropicContentBlock {
    type: string;
    text?: string;
}
interface AnthropicResponse {
    content?: AnthropicContentBlock[];
}

interface OpenAIMessage {
    role: string;
    content?: string;
}
interface OpenAIResponse {
    choices?: Array<{ message?: OpenAIMessage }>;
}

interface GeminiPart {
    text?: string;
}
interface GeminiCandidate {
    content?: { parts?: GeminiPart[] };
}
interface GeminiResponse {
    candidates?: GeminiCandidate[];
}

function getResponseText(provider: AiProvider, data: unknown): string | undefined {
    if (provider === 'anthropic') {
        const r = data as AnthropicResponse;
        return r.content?.[0]?.text;
    }
    if (provider === 'openai' || provider === 'xai') {
        const r = data as OpenAIResponse;
        return r.choices?.[0]?.message?.content;
    }
    if (provider === 'google') {
        const r = data as GeminiResponse;
        return r.candidates?.[0]?.content?.parts?.[0]?.text;
    }
    return undefined;
}

export interface SchemaNode {
    name: string;
    isBoss?: boolean;
    description?: string;
    deadline?: string;
    blockers?: string[];
    children?: SchemaNode[];
}

export interface GenerationResult {
    success: boolean;
    schema?: SchemaNode;
    error?: string;
}

export class AIService {
    private provider: AiProvider;
    private apiKey: string;
    private model: string;

    constructor(provider: AiProvider, apiKey: string, model: string) {
        this.provider = provider;
        this.apiKey = apiKey;
        this.model = model;
    }

    updateConfig(provider: AiProvider, apiKey: string, model: string) {
        this.provider = provider;
        this.apiKey = apiKey;
        this.model = model;
    }

    isConfigured(): boolean {
        return !!this.apiKey;
    }

    private async postChat(systemPrompt: string | null, userContent: string): Promise<string> {
        const maxTokens = 4096;

        if (this.provider === 'anthropic') {
            const content = systemPrompt
                ? `${systemPrompt}\n\n${userContent}`
                : userContent;
            const response = await requestUrl({
                url: 'https://api.anthropic.com/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: maxTokens,
                    messages: [{ role: 'user', content }],
                }),
            });
            if (response.status !== 200) {
                throw new Error(`API error: ${response.status}`);
            }
            const text = getResponseText('anthropic', response.json);
            if (!text || typeof text !== 'string') throw new Error('Empty response from API');
            return text;
        }

        if (this.provider === 'openai' || this.provider === 'xai') {
            const url = this.provider === 'openai'
                ? 'https://api.openai.com/v1/chat/completions'
                : 'https://api.x.ai/v1/chat/completions';
            const messages: Array<{ role: string; content: string }> = [];
            if (systemPrompt) {
                messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userContent });
            const response = await requestUrl({
                url,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: maxTokens,
                    messages,
                }),
            });
            if (response.status !== 200) {
                throw new Error(`API error: ${response.status}`);
            }
            const text = getResponseText(this.provider, response.json);
            if (!text || typeof text !== 'string') throw new Error('Empty response from API');
            return text;
        }

        if (this.provider === 'google') {
            const userPart = systemPrompt
                ? `${systemPrompt}\n\n${userContent}`
                : userContent;
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
            const response = await requestUrl({
                url,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: userPart }] }],
                    generationConfig: {
                        maxOutputTokens: maxTokens,
                    },
                }),
            });
            if (response.status !== 200) {
                throw new Error(`API error: ${response.status}`);
            }
            const text = getResponseText('google', response.json);
            if (!text || typeof text !== 'string') throw new Error('Empty response from API');
            return text;
        }

        throw new Error('Unknown AI provider');
    }

    async generateSchema(prompt: string, existingContext?: string): Promise<GenerationResult> {
        if (!this.apiKey) {
            return {
                success: false,
                error: 'API key not configured. Please set it in plugin settings.',
            };
        }

        try {
            let contextInfo = '';
            if (existingContext) {
                contextInfo = `\n\nExisting tasks in this folder (DO NOT duplicate these):\n${existingContext}`;
            }

            const systemPrompt = `You are a task breakdown assistant. Output a SHORT hierarchical task list.

JSON format (omit description, deadline, blockers if empty):
{"name": "Goal", "children": [{"name": "Step 1", "isBoss": false, "children": []}]}

Rules:
- VERY SHORT: max 3-5 tasks total. Prefer 3.
- Task names: 2-4 words only. No sentences.
- No "description" field unless critical.
- "isBoss": true for one main milestone only.
- Max 2 levels deep, max 2 children per task.
- Deadlines only if user explicitly asks (YYYY-MM-DD).
- Blockers only if user mentions dependencies.
- Output ONLY valid JSON, no text before or after.
- DO NOT duplicate existing tasks from context.${contextInfo}`;

            const userContent = `Goal to break down:\n${prompt}`;
            const content = await this.postChat(systemPrompt, userContent);

            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch || !jsonMatch[0]) {
                return {
                    success: false,
                    error: 'Could not parse JSON from response',
                };
            }

            const schema = JSON.parse(jsonMatch[0]) as SchemaNode;

            return {
                success: true,
                schema,
            };
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async generateContent(prompt: string, existingContent?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        let systemContext = prompt;
        if (existingContent) {
            systemContext += `\n\nExisting note content for context:\n${existingContent}`;
        }

        return this.postChat(null, systemContext);
    }

    async generateMap(treeContent: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const systemPrompt = `You are a dungeon map artist for a roguelike game. Create an ASCII dungeon map that looks like a real game level.

WIDTH: 60-70 characters max (fits on screen but allows side-by-side rooms)

STYLE: Make it look like a real dungeon/game map with:
- Multiple rooms connected by corridors
- Rooms can be side by side (not just vertical)
- Interesting shapes (L-shaped, T-shaped rooms)
- Secret passages, treasure rooms
- Different room sizes based on importance
- Boss rooms should be larger and more decorated

SYMBOLS:
█ or # for walls
░ for floor/corridors  
+ for doors
* open tasks
x completed [DONE]
@ boss [BOSS] (in decorated rooms)
! blocked
♦ treasure/loot
≈ water/hazard

Make the map INTERESTING and GAME-LIKE. Use creativity!
Respond with ONLY the ASCII art, no explanations.`;

        const content = await this.postChat(systemPrompt, `Task tree:\n${treeContent}`);
        return content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    }

    async generateChart(prompt: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const systemPrompt = `You are a diagram artist. Create a COMPACT ASCII art chart/diagram.

IMPORTANT: Keep the diagram NARROW - max 50 characters wide to fit on screen.

Use box-drawing characters and symbols:
┌ ┐ └ ┘ ─ │ ├ ┤ ┬ ┴ ┼ for boxes
→ ← ↑ ↓ for arrows
* + - for bullet points

Keep it: MAX WIDTH 50 characters, vertical layout preferred, clear and readable.
Respond with ONLY the ASCII art, no explanations.`;

        const content = await this.postChat(systemPrompt, `Create a chart for:\n${prompt}`);
        return content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
    }

    async generateTitle(content: string, isSelectedText: boolean): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const systemPrompt = isSelectedText
            ? `Generate a SHORT, descriptive heading (3-7 words) for the following text. The heading should summarize the main topic. Respond with ONLY the heading text, no markdown, no #, just plain text.`
            : `Generate a SHORT, descriptive title (3-7 words) for this note based on its content. The title should capture the main topic. Respond with ONLY the title text, no markdown, no #, just plain text.`;

        const text = await this.postChat(systemPrompt, `Content:\n${content.slice(0, 2000)}`);
        return text.trim();
    }
}
