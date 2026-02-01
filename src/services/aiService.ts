import { requestUrl } from 'obsidian';

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
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    updateConfig(apiKey: string, model: string) {
        this.apiKey = apiKey;
        this.model = model;
    }

    isConfigured(): boolean {
        return !!this.apiKey;
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
                    max_tokens: 4096,
                    messages: [
                        {
                            role: 'user',
                            content: `${systemPrompt}\n\nGoal to break down:\n${prompt}`,
                        },
                    ],
                }),
            });

            if (response.status !== 200) {
                return {
                    success: false,
                    error: `API error: ${response.status}`,
                };
            }

            const data = response.json;
            const content = data.content?.[0]?.text;

            if (!content) {
                return {
                    success: false,
                    error: 'Empty response from API',
                };
            }

            // Parse JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
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

    // Generate content for filling notes
    async generateContent(prompt: string, existingContent?: string): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        let systemContext = prompt;
        if (existingContent) {
            systemContext += `\n\nExisting note content for context:\n${existingContent}`;
        }

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
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: systemContext,
                    },
                ],
            }),
        });

        if (response.status !== 200) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = response.json;
        const content = data.content?.[0]?.text;

        if (!content) {
            throw new Error('Empty response from API');
        }

        return content;
    }

    // Generate dungeon map ASCII art (game-like style)
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

EXAMPLE:
\`\`\`
██████████████████████████████████████████████████████
█░░░░░░░░░░░░░█░░░░░░░░░░░░░░░░░░░█░░░░░░░░░░░░░░░░░░█
█░[Planning]░░█░░░░[Development]░░█░░░[Testing]░░░░░█
█░ * Research░+░░░ * Backend░░░░░+░░░ * Unit tests░░█
█░ x Analysis░█░░░ * Frontend░░░░█░░░ * E2E tests░░░█
█░░░░░░░░░░░░░█░░░ @ Deploy [BOSS]█░░░░░░░░░░░░░░░░░█
██████████+███████████████████████████████+██████████
          ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
██████████+█████████████████████████████████████████
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░░░░░[Launch Zone]░░░░░░░░░░░░░░░░░░░░░░░░░█
█░░░░░░░░░░░░ @ SHIP IT! [BOSS]░░░░░░░░░░░░♦░░░░░░░█
█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█
████████████████████████████████████████████████████

Legend: * Task  x Done  @ Boss  ♦ Loot  + Door
\`\`\`

Make the map INTERESTING and GAME-LIKE. Use creativity!
Respond with ONLY the ASCII art, no explanations.`;

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
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: `${systemPrompt}\n\nTask tree:\n${treeContent}`,
                    },
                ],
            }),
        });

        if (response.status !== 200) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = response.json;
        const content = data.content?.[0]?.text;

        if (!content) {
            throw new Error('Empty response from API');
        }

        // Extract just the ASCII art (remove any markdown code blocks)
        let map = content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        
        return map;
    }

    // Generate chart/schema ASCII art (narrow)
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

Keep it:
- MAX WIDTH: 50 characters
- Vertical layout preferred
- Clear and readable
- No unnecessary decoration

Example (notice narrow width):
\`\`\`
┌─────────────────┐
│     Input       │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│    Process      │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│     Output      │
└─────────────────┘
\`\`\`

Create a NARROW chart (max 50 chars wide).
Respond with ONLY the ASCII art, no explanations.`;

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
                max_tokens: 4096,
                messages: [
                    {
                        role: 'user',
                        content: `${systemPrompt}\n\nCreate a chart for:\n${prompt}`,
                    },
                ],
            }),
        });

        if (response.status !== 200) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = response.json;
        const content = data.content?.[0]?.text;

        if (!content) {
            throw new Error('Empty response from API');
        }

        // Extract just the ASCII art
        let chart = content.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        
        return chart;
    }

    // Generate title for note or selected text
    async generateTitle(content: string, isSelectedText: boolean): Promise<string> {
        if (!this.apiKey) {
            throw new Error('API key not configured');
        }

        const systemPrompt = isSelectedText 
            ? `Generate a SHORT, descriptive heading (3-7 words) for the following text. 
               The heading should summarize the main topic.
               Respond with ONLY the heading text, no markdown, no #, just plain text.`
            : `Generate a SHORT, descriptive title (3-7 words) for this note based on its content.
               The title should capture the main topic.
               Respond with ONLY the title text, no markdown, no #, just plain text.`;

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
                max_tokens: 100,
                messages: [
                    {
                        role: 'user',
                        content: `${systemPrompt}\n\nContent:\n${content.slice(0, 2000)}`,
                    },
                ],
            }),
        });

        if (response.status !== 200) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = response.json;
        const title = data.content?.[0]?.text;

        if (!title) {
            throw new Error('Empty response from API');
        }

        return title.trim();
    }
}
