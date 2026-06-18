import type { IncomingMessage, ServerResponse } from 'http';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || process.env.VITE_EMBEDDING_MODEL || 'text-embedding-3-small';
const PINECONE_API_KEY = process.env.PINECONE_API_KEY || process.env.VITE_PINECONE_API_KEY || '';
const PINECONE_HOST = (process.env.PINECONE_HOST || process.env.VITE_PINECONE_HOST || '').replace(/\/+$/, '');

// ── Retrieval tuning ──────────────────────────────────────────────
const RETRIEVE_TOPK = 8;       // candidates pulled from Pinecone
const CONTEXT_MAX = 5;         // chunks actually sent to the LLM after dedup/rerank
const STRONG_SCORE = 0.45;     // primary relevance floor (was 0.4 — dropped 0.45 noise)
const WEAK_SCORE = 0.25;       // fallback floor when nothing clears STRONG
const CHUNK_CHARS = 1800;      // per-chunk char cap in the prompt (trims oversized chunks)

// In-memory embedding cache. Survives across warm serverless invocations on the
// same instance; a cold start simply rebuilds it. Bounded FIFO to cap memory.
const EMBED_CACHE = new Map<string, number[]>();
const EMBED_CACHE_MAX = 256;
const normQuery = (q: string) => q.toLowerCase().replace(/\s+/g, ' ').trim();

const SYSTEM_PROMPT = `You are Libby, an AI assistant for OU Libraries employees — Student Library Assistants (SLAs), library leads, and staff. Your job is to give clean, well-organized, immediately-usable answers from internal handbooks and the OU Libraries website.

═══ AUDIENCE ═══
Every user is a LIBRARY EMPLOYEE on duty. Frame answers as instructions for the EMPLOYEE, never advice for a patron. When a patron is involved, use "tell the patron…", "direct them to…", "have them…", "instruct them to…".

═══ HOW TO USE CONTEXT ═══
The user message contains retrieved excerpts from internal documents [DOCUMENT] and the OU Libraries website [WEBSITE].

1. Read every excerpt before answering. Map each to the question.
2. Synthesize across multiple excerpts. Combine, summarize, connect related points. Resolve overlap by preferring [DOCUMENT] over [WEBSITE].
3. Always try to answer with whatever relevant info is in the excerpts — even partial coverage. State assumptions when the excerpts only partially cover the topic, and note what's missing.
4. ONLY refuse with "I don't have that information in my knowledge base. Please check with your supervisor or the OU Libraries website." when excerpts are completely unrelated to the question. Do NOT refuse over a typo, abbreviation, or short query — infer reasonable intent and answer.
5. Cite inline in plain language: "per the SLA handbook", "according to the Catches & Hold Procedures", "per the Circulation policy". One short citation per claim is enough — don't spam.

═══ ANSWER QUALITY (MANDATORY) ═══
EVERY answer must meet ALL of these:
1. **Direct first sentence**: lead with the answer, not preamble. No "Sure!", "Of course!", "Great question!", "Based on the excerpts…".
2. **Concrete and actionable**: include exact menu paths (e.g. "Fulfillment > Resource Requests > Expired Hold Shelf"), button names, system names (Alma, LibCal, WIW, Slack), and exact field labels when the excerpts provide them.
3. **Numbered steps for procedures**: each step on its own line, blank line between steps. Steps must be sequential and complete — don't skip from step 2 to step 5.
4. **Specific over generic**: "Click Reshelve under the item" beats "select the appropriate option".
5. **Acknowledge gaps explicitly**: if the excerpts don't cover something the user asked, say so in a final line ("The excerpts don't specify X — confirm with your supervisor.") rather than guessing.
6. **No fluff**: no apologies, no meta-commentary about being an AI, no "I hope this helps", no "feel free to ask".

═══ FORMATTING RULES ═══
- Use **bold** with double asterisks for key terms, system names, and step labels (the renderer supports markdown bold)
- Use numbered lists (1., 2., 3.) for sequential steps; each item on its own line
- Use sub-letters (a., b., c.) for branching options inside a step
- Do NOT use single asterisks (*), dashes (-), or bullet symbols (•) for lists
- Inline code with backticks for credentials, URLs, and exact button text where helpful
- Keep paragraphs tight; blank line between numbered items only when steps have multi-line detail

═══ LENGTH ═══
- Quick policy lookups: 2–4 sentences
- Standard procedures: 4–8 numbered steps
- Complex multi-branch procedures: as long as needed, but no padding
- Stop when the question is answered. Don't append "Hope this helps" or summary paragraphs.

═══ TONE ═══
Professional, collegial, focused. You are talking to a coworker on shift who needs the answer fast.`;

function isCasualQuery(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[?!.,]+$/, '');
  if (t.length === 0) return true;
  if (t.length > 60) return false; // long queries unlikely casual
  const patterns = [
    /^(hi|hii+|hello+|hey+|heya|yo+|sup|wassup|wassuup+|wsup|howdy|greetings|aloha)\b/,
    /^(hi|hello|hey)\s+(libby|there|friend|bot|y'?all)/,
    /^how (are|r|do you do|have you been) (you|u|ya|things)?/,
    /^how('s| is| are)\s+(it|things|you|u|ya|life|your day)/,
    /^how('s| is)\s+everything/,
    /^what'?s\s+(up|new|good|happening|going on|crackin)\b/,
    /^what is\s+up\b/,
    /^(good|gud|gd)\s+(morning|afternoon|evening|night|day)/,
    /^morning\b|^evening\b|^afternoon\b/,
    /^(thanks|thank you|thx|ty|cheers|appreciate (it|that)|much obliged)\b/,
    /^(bye|goodbye|see ya|cya|peace|laters|later|take care)\b/,
    /^(who are you|what are you|what can you do|^help$|what do you do|introduce yourself|tell me about yourself)/,
    /^(nice to meet|pleased to meet)/,
    /^(how can|how do) (i|you) (use|start)/,
    /^test(ing)?$/,
    /^(ok|okay|cool|nice|got it|sounds good|alright|aight)\b/,
  ];
  return patterns.some((p) => p.test(t));
}

function factualFallback(text: string): string | null {
  const t = text.toLowerCase();
  if (/\b(hour|hours|open|close|closing|opening|closed|when (does|do|is)|what time)\b/.test(t)) {
    return 'For current branch hours, point them to https://libraries.ou.edu/visit-study/hours — hours change by branch and semester, so always check the live page rather than memorized info.';
  }
  if (/\b(phone|phone number|contact|email address|call)\b.*\b(librar|circulation|reference)/.test(t) || /\b(librar|circulation|reference)\b.*\b(phone|number|contact|email)/.test(t)) {
    return 'For staff directory and contact info, see https://libraries.ou.edu/about-us/staff-directory and the Circulation Desk contact at https://libraries.ou.edu/help/contact-us.';
  }
  if (/\b(address|location|where is|directions|parking|map)\b/.test(t) && /\b(library|libraries|bizzell|branch)/.test(t)) {
    return 'Bizzell Memorial Library is at 401 W. Brooks St., Norman, OK 73019. Branch locations and maps: https://libraries.ou.edu/our-libraries.';
  }
  return null;
}

function casualReply(text: string): string {
  const t = text.toLowerCase().trim();

  if (/^(thanks|thank you|thx|ty|cheers|appreciate|much obliged)/.test(t)) {
    return "You're welcome — happy to help. Anything else you need?";
  }
  if (/^(bye|goodbye|see ya|cya|peace|laters|later|take care)/.test(t)) {
    return 'Take care. Ping me anytime you need a quick procedure lookup.';
  }
  if (/who are you|what are you|what can you do|^help$|what do you do|introduce yourself|tell me about yourself|how (can|do) (i|you) (use|start)/.test(t)) {
    return "I'm **Libby** — an AI assistant built for OU Libraries staff. I can help you with:\n\n1. Circulation procedures (checkout, returns, holds, catches)\n2. SLA duties, scheduling, and shift coverage\n3. Troubleshooting (expired holds, overdue reserves, missing items)\n4. LibCal equipment booking and room reservations\n5. OK-Share, alumni borrowing, and building access policies\n6. Anything from the staff handbooks or libraries.ou.edu\n\nAsk me a procedure question and I'll walk you through it.";
  }
  if (/^how (are|r|do you do|have you been)|^how('s| is| are)\s+(it|things|you|u|ya|life|your day)|^how('s| is)\s+everything|^what'?s\s+(up|new|good|happening|going on|crackin)/.test(t)) {
    return "Doing well, thanks for asking. Ready to help you with a procedure, policy, or troubleshooting question — what's on the desk today?";
  }
  if (/^(good|gud|gd)\s+(morning|afternoon|evening|night|day)|^morning|^evening|^afternoon/.test(t)) {
    return "Good morning. Let me know what library procedure or policy I can help you with.";
  }
  if (/^(nice to meet|pleased to meet)/.test(t)) {
    return "Nice to meet you too. I'm Libby — ask me anything about OU Libraries procedures, policies, or troubleshooting.";
  }
  if (/^(ok|okay|cool|nice|got it|sounds good|alright|aight)/.test(t)) {
    return "Got it. What else can I help you with?";
  }
  if (/^test/.test(t)) {
    return "Connection looks good. Ask me a real procedure question whenever you're ready.";
  }

  // Default greeting
  return "Hey — I'm **Libby**, your OU Libraries staff assistant. Ask me about circulation procedures, holds, SLA duties, scheduling, troubleshooting, or any library policy.";
}

type Match = {
  id: string;
  score?: number;
  metadata?: Record<string, any>;
};

async function generateEmbedding(text: string): Promise<number[]> {
  const key = normQuery(text);
  const cached = EMBED_CACHE.get(key);
  if (cached) return cached;

  const embedding = await embedRequest(text);

  // Bounded FIFO eviction
  if (EMBED_CACHE.size >= EMBED_CACHE_MAX) {
    const oldest = EMBED_CACHE.keys().next().value;
    if (oldest !== undefined) EMBED_CACHE.delete(oldest);
  }
  EMBED_CACHE.set(key, embedding);
  return embedding;
}

async function embedRequest(text: string): Promise<number[]> {
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
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI chat error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content || '';
}

// Dedup near-identical chunks, prefer [DOCUMENT] over [WEBSITE] at equal relevance,
// then keep the top CONTEXT_MAX. Shrinks the prompt → faster + cheaper generation.
function rerank(matches: Match[]): Match[] {
  const seen = new Map<string, Match>();
  for (const m of matches) {
    const text = ((m.metadata?.text || m.metadata?.content || '') as string);
    // Content-only key, punctuation/case/whitespace-insensitive: catches the same
    // chunk indexed under different source names or with trivial punctuation diffs.
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 200);
    const prev = seen.get(key);
    if (!prev || (m.score || 0) > (prev.score || 0)) seen.set(key, m);
  }
  const docFirst = (m: Match) => (m.metadata?.sourceType === 'document' ? 0.03 : 0);
  return [...seen.values()]
    .sort((a, b) => ((b.score || 0) + docFirst(b)) - ((a.score || 0) + docFirst(a)))
    .slice(0, CONTEXT_MAX);
}

function buildContext(matches: Match[]): string {
  return matches
    .map((m) => {
      const text = ((m.metadata?.text || m.metadata?.content || '') as string).slice(0, CHUNK_CHARS);
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

    let answer: string;
    let sources: ReturnType<typeof extractSources> = [];

    if (isCasualQuery(message)) {
      answer = casualReply(message);
    } else {
      const embedding = await generateEmbedding(message);
      const matches = await pineconeQuery(embedding, RETRIEVE_TOPK);
      const strong = matches.filter((m) => (m.score || 0) >= STRONG_SCORE);
      const passing = strong.length > 0 ? strong : matches.filter((m) => (m.score || 0) >= WEAK_SCORE);
      const usable = rerank(passing);

      if (usable.length === 0) {
        const fb = factualFallback(message);
        answer = fb ?? "I don't have that information in my knowledge base. Please check with your supervisor or the OU Libraries website.";
      } else {
        const context = buildContext(usable);
        const userPrompt = `Retrieved context from OU Libraries documents and website:\n\n${context}\n\n---\n\nEmployee question: ${message}\n\nUsing the excerpts above, answer the employee's question. Synthesize across multiple excerpts when needed. If excerpts only partially cover the topic, give what's there and note what's missing. Use numbered lists (each on its own line) for procedures or distinct points. No asterisks, dashes, or bullet symbols.`;
        answer = await chatCompletion(userPrompt);
        sources = extractSources(usable);

        // If LLM refused but query is a known factual lookup, swap in canonical URL
        const refused =
          /don'?t have/i.test(answer) ||
          /not in (my|the) knowledge base/i.test(answer) ||
          /(excerpts|context) (do not|don'?t) (specify|cover|include|mention|provide)/i.test(answer) ||
          /please check (with )?(your supervisor|the ou libraries website)/i.test(answer);
        if (refused) {
          const fb = factualFallback(message);
          if (fb) {
            answer = fb;
            sources = [];
          }
        }
      }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ answer, sources }));
  } catch (err: any) {
    console.error('api/chat error:', err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
  }
}
