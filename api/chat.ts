import type { IncomingMessage, ServerResponse } from 'http';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || process.env.VITE_EMBEDDING_MODEL || 'text-embedding-3-small';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.VITE_PINECONE_API_KEY || '';
const PINECONE_HOST = (process.env.PINECONE_HOST || process.env.VITE_PINECONE_HOST || '').replace(/\/+$/, '');

const SYSTEM_PROMPT = `You are Libby, an AI assistant built exclusively for OU Libraries employees — Student Library Assistants (SLAs), library leads, and staff.

CRITICAL FRAMING:
- Every person asking you a question is a LIBRARY EMPLOYEE on duty
- They need help with procedures, policies, or how to handle a situation at work
- Frame EVERY answer as instructions for the EMPLOYEE, never as advice for a patron
- Always address the user as a fellow staff member

EMPLOYEE-FOCUSED LANGUAGE (MANDATORY):
- Start responses with phrases like: "Here's what you need to do:", "Follow these steps:", "As staff, you should:", "The procedure for this is:"
- When the question involves patrons, use: "Tell the patron...", "Direct them to...", "Let them know that...", "Inform the patron..."
- NEVER use "you can visit", "you should go to", "bring your ID" — these sound patron-facing
- ALWAYS use "instruct the patron to visit", "have them go to", "ask them to bring their ID"

EXAMPLES OF CORRECT TONE:
- "Here's the hold procedure you need to follow: 1. Log into Alma and click Fulfillment..."
- "When a patron asks about this, tell them that alumni can check out up to 30 items..."
- "As staff, you should direct them to the Circulation Desk on the Main Floor..."
WRONG: "You can check out books at the Circulation Desk" (sounds patron-facing)
WRONG: "Visit the library website to reserve a room" (sounds patron-facing)

KNOWLEDGE BOUNDARIES:
- Answer ONLY using the retrieved documents below
- Do NOT make up or infer information not in the documents
- PRIORITY: Internal documents (marked [DOCUMENT]) take priority over website content (marked [WEBSITE])
- If the answer is not in the documents, say: "I don't have that information in my knowledge base. Please check with your supervisor or the OU Libraries website."

RESPONSE GUIDELINES:
1. Be CONCISE: 2-4 key points maximum
2. Use numbered lists (1, 2, 3) for steps
3. Frame everything as staff instructions
4. Keep responses under 150 words unless detailed procedures are needed

FORMATTING RULES:
- Start with a direct, employee-framed answer
- Each numbered point on a separate line with a line break after
- DO NOT use asterisks (*), dashes (-), or bullet points
- Keep each point brief and actionable

Be professional and helpful — you're talking to a colleague.`;

type Match = {
  id: string;
  score?: number;
  metadata?: Record<string, any>;
};

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embedding error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { data: { embedding: number[] }[] };
  return data.data[0].embedding;
}

async function pineconeQuery(vector: number[], topK: number): Promise<Match[]> {
  const res = await fetch(`${PINECONE_HOST}/query`, {
    method: 'POST',
    headers: {
      'Api-Key': PINECONE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vector, topK, includeMetadata: true }),
  });
  if (!res.ok) {
    throw new Error(`Pinecone query error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { matches?: Match[] };
  return data.matches || [];
}

async function chatCompletion(userPrompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI chat error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content || '';
}

function buildContext(matches: Match[]): string {
  return matches
    .map((m) => {
      const text = m.metadata?.text || m.metadata?.content || '';
      const label = m.metadata?.sourceType === 'document' ? '[DOCUMENT]' : '[WEBSITE]';
      const src = m.metadata?.source || 'Unknown';
      return `${label} Source: ${src}\n${text}`;
    })
    .filter((s) => s.trim().length > 0)
    .join('\n\n---\n\n');
}

function extractSources(matches: Match[]) {
  return matches.map((m) => ({
    name: m.metadata?.source || m.id,
    page: m.metadata?.page || 1,
    url: m.metadata?.url,
    content: ((m.metadata?.text || '') as string).substring(0, 200) + '...',
  }));
}

async function readBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body) return (req as any).body;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!OPENAI_API_KEY || !PINECONE_API_KEY || !PINECONE_HOST) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Server missing OPENAI_API_KEY, PINECONE_API_KEY, or PINECONE_HOST env vars' }));
    return;
  }

  try {
    const body = await readBody(req);
    const message = (body?.message || '').toString().trim();
    if (!message) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing "message" in request body' }));
      return;
    }

    const embedding = await generateEmbedding(message);
    const matches = await pineconeQuery(embedding, 5);
    const filtered = matches.filter((m) => (m.score || 0) > 0.3);
    const docs = filtered.length > 0 ? filtered : matches;

    let answer: string;
    let sources: ReturnType<typeof extractSources> = [];

    if (docs.length === 0) {
      answer = "I don't have that information in my knowledge base. Please check with your supervisor or the OU Libraries website.";
    } else {
      const context = buildContext(docs);
      const userPrompt = `Context from library documents:\n${context}\n\nQuestion: ${message}\n\nProvide a concise, well-organized answer using only the information from the context above. Use numbered lists (1, 2, 3) if listing procedures or multiple points. Each numbered point MUST be on a separate line. Do not use asterisks, dashes, or bullet points.`;
      answer = await chatCompletion(userPrompt);
      sources = extractSources(docs);
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ answer, sources }));
  } catch (err: any) {
    console.error('api/chat error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
  }
}
