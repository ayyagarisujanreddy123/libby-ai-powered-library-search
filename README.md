
# Libby — AI-Powered Library Search

**Libby** is an AI chatbot built for **OU Libraries employees** — Student Library Assistants (SLAs), library leads, and staff. It uses Retrieval-Augmented Generation (RAG) to answer questions about procedures, policies, services, and locations by searching across **internal staff documents** (handbooks, troubleshooting guides, policies in PDF and DOCX) and **crawled OU Libraries website content**. Internal documents are prioritized over web content for accuracy.

🚀 **Live demo:** [libby-ai-powered-library-search.vercel.app](https://libby-ai-powered-library-search.vercel.app)

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Document Indexer](#document-indexer)
- [Web Crawler](#web-crawler)
- [Conversational Behavior](#conversational-behavior)
- [Testing](#testing)
- [Scripts Reference](#scripts-reference)
- [Re-Indexing Workflow](#re-indexing-workflow)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Future Roadmap](#future-roadmap)
- [Contributing](#contributing)

---

## Overview

Libby helps library employees quickly find answers to common questions like:

- *"How do I mark a book as missing?"*
- *"What's the procedure for an expired hold?"*
- *"How do I get coverage for my shift if I'm sick?"*
- *"What are the alumni borrowing privileges?"*
- *"A patron returns a damaged reserve item — what do I do?"*

Instead of digging through handbooks or website pages, staff ask Libby in natural language and get a concise, employee-framed answer with source citations.

### Key Features

- 🤖 **RAG with gpt-4o** — Strong multi-document synthesis grounded in indexed sources
- 👥 **Employee-Focused** — Frames answers as staff instructions ("Tell the patron…", "Direct them to…")
- 📄 **Mixed Source Indexing** — Indexes both PDF and DOCX handbooks plus the crawled OU Libraries website
- 💬 **Conversational Greetings** — Casual queries (`hi`, `thanks`, `how are you`, `wassup`, etc.) bypass RAG and get friendly canned replies
- 🔗 **Factual Fallback** — Hours, contact, and location queries automatically point to canonical libraries.ou.edu URLs when the index lacks data
- 📑 **Source Citations** — Each answer lists source pills with document name and page; web pills link to the live URL
- 💾 **Chat Persistence** — Conversations saved to localStorage and survive page refreshes
- 🕐 **Message Timestamps** — Relative timestamps on every message
- 📝 **Markdown Rendering** — Bot responses render **bold**, `inline code`, sub-letter branches, and numbered lists
- 📋 **Copy to Clipboard** — One-click copy on bot messages with checkmark feedback
- 🎨 **Modern UI** — Dark JARVIS-themed interface with floating 3D books, particle effects, and Framer Motion transitions
- ⚡ **Serverless Backend** — All RAG logic runs in `api/chat.ts` (Vercel Functions in prod, Vite middleware in dev) — keeps API keys off the client
- ♿ **Accessible** — ARIA labels, live regions, keyboard navigation, focus indicators

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (React App)                    │
│                                                          │
│   User Query → useChat → chatService → POST /api/chat    │
└──────────────────────┬───────────────────────────────────┘
                       │ JSON { message }
                       ▼
┌──────────────────────────────────────────────────────────┐
│           api/chat.ts (Vercel Function / Vite middleware) │
│                                                          │
│   1. isCasualQuery? → return canned reply (no RAG)       │
│   2. embed query (text-embedding-3-small, 1536-dim)      │
│   3. Pinecone query (topK=8, two-tier scoring)           │
│   4. Build [DOCUMENT]/[WEBSITE] context, doc-priority     │
│   5. gpt-4o chat completion with strict system prompt    │
│   6. factualFallback() catches hours/contact/location    │
│      refusals → swap in canonical libraries.ou.edu URL   │
│   7. Return { answer, sources }                          │
└─────────────┬────────────────────────────┬───────────────┘
              │                            │
              ▼                            ▼
   ┌──────────────────┐           ┌──────────────────┐
   │   Pinecone DB    │           │    OpenAI API    │
   │ (Vector Search)  │           │ Embeddings + LLM │
   │                  │           │                  │
   │  ~480 vectors    │           │ embedding-3-small│
   │  282 web +       │           │ gpt-4o           │
   │  198 doc/docx    │           │                  │
   │  1536-dim cosine │           │                  │
   └──────────────────┘           └──────────────────┘
```

### RAG Pipeline

1. **Conversational gate** — Greetings, identity questions, thanks, and other casual inputs are detected by regex and answered directly without hitting the index.
2. **Embedding** — Non-casual queries are embedded with OpenAI `text-embedding-3-small` (1536-dim).
3. **Vector search** — Pinecone returns top 8 matches with cosine similarity. A two-tier filter prefers matches with score ≥ 0.4; falls back to ≥ 0.25 if no strong matches.
4. **Context assembly** — Chunks are labeled `[DOCUMENT]` or `[WEBSITE]` with source name, joined with separators.
5. **LLM generation** — gpt-4o is given the structured system prompt + context, with `temperature=0.2` and `max_tokens=1200`.
6. **Refusal interception** — If the model refuses ("I don't have that info") but the question is a known factual lookup (hours, contact, location), the answer is replaced with the canonical OU Libraries URL.
7. **Response** — JSON returned to the browser; the UI streams it character-by-character and renders source pills below.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript | UI composition, state |
| **Styling** | Tailwind (CDN), Lucide Icons | Dark theme, iconography |
| **Animation** | Framer Motion, CSS Keyframes | JARVIS logo, particles, transitions |
| **Persistence** | localStorage | Chat history across page refreshes |
| **Build Tool** | Vite 6 | Dev server, HMR, dev API middleware |
| **Backend** | Vercel Serverless Functions | `api/chat.ts` runs both in dev (Vite) and prod (Vercel) |
| **LLM** | OpenAI **gpt-4o** | Multi-doc synthesis & reasoning |
| **Embeddings** | OpenAI `text-embedding-3-small` | 1536-dim cosine vectors |
| **Vector DB** | Pinecone (Serverless) | Semantic search index `libby-chat-bot` |
| **PDF Parsing** | `pdfjs-dist` | Local PDF text extraction |
| **DOCX Parsing** | `mammoth` | Local DOCX text extraction |
| **Web Crawler** | Node.js (built-in `fetch`) | Crawls sitemap.xml, extracts main content |

---

## Project Structure

```
libby-—-ai-powered-library-search/
├── App.tsx                    # JARVIS logo, background animations, About modal
├── index.tsx                  # React entry point
├── index.html                 # HTML template + Safari polyfills
├── index.css                  # Global styles + keyframes (single source of truth)
├── types.ts                   # Shared types (Message, Source, RAGResponse)
├── vite.config.ts             # Vite config + dev middleware that mounts /api/chat
├── vercel.json                # Vercel routing/build config
├── package.json               # Deps & scripts
├── .env                       # Local secrets (gitignored)
├── .env.example               # Template
│
├── api/
│   └── chat.ts                # Serverless RAG handler (greeting bypass, embedding,
│                              # Pinecone query, gpt-4o, factual fallback,
│                              # refusal interceptor)
│
├── hooks/
│   └── useChat.ts             # Chat state, streaming sim, localStorage persistence
│
├── services/
│   ├── chatService.ts         # POSTs to /api/chat, error normalization
│   ├── ragService.ts          # (legacy local RAG path, not used in current flow)
│   ├── openaiService.ts       # OpenAI client wrapper (legacy)
│   ├── pineconeService.ts     # Pinecone REST client (legacy)
│   └── configService.ts       # Env var management
│
├── components/
│   ├── ChatWindow.tsx         # Scrollable list, auto-scroll, scroll-to-bottom
│   ├── ChatInput.tsx          # Auto-resize textarea, Shift+Enter newlines
│   ├── Message.tsx            # Bubble + markdown render + timestamp + copy
│   ├── SourcePill.tsx         # Source citation chip (clickable when URL present)
│   ├── TypingIndicator.tsx    # Animated typing dots
│   ├── AboutModal.tsx         # About modal
│   └── icons/                 # Inline SVG icon components
│
├── crawl-ou-library.js        # Sitemap-based web crawler → Pinecone (sourceType: web)
├── index-documents.js         # PDF + DOCX indexer → Pinecone (sourceType: document)
├── test-pinecone.js           # Connection check + sample query
└── functional-test.js         # End-to-end RAG test scenarios
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **npm**
- **OpenAI API key** — [platform.openai.com](https://platform.openai.com/api-keys)
- **Pinecone account** — [pinecone.io](https://www.pinecone.io/) — create a serverless index named `libby-chat-bot` with **1536 dimensions** and **cosine** metric

### Installation

```bash
# 1. Clone
git clone https://github.com/ayyagarisujanreddy123/libby-ai-powered-library-search.git
cd libby-ai-powered-library-search

# 2. Install
npm install

# 3. Configure secrets
cp .env.example .env
# Edit .env with your OpenAI + Pinecone keys

# 4. Crawl the OU Libraries website (clears the index!)
npm run crawl

# 5. Index local PDF + DOCX docs (re-adds doc vectors after the crawl wipe)
npm run index-docs

# 6. Run dev server
npm run dev
```

App available at:
- **Local:** http://localhost:3000
- **Network:** http://YOUR_IP:3000

---

## Environment Variables

The project separates **server-side** keys (used by `api/chat.ts` and Node indexing scripts) from **legacy `VITE_` keys** (only used by the Node scripts that read them directly).

```env
# Server-side (used by /api/chat.ts in dev + prod, and by Node scripts)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
PINECONE_API_KEY=pcsk_...
PINECONE_HOST=https://your-index.svc.region.pinecone.io
PINECONE_INDEX_NAME=libby-chat-bot
PINECONE_ENVIRONMENT=us-east-1

# Legacy VITE_ copies — only the Node indexing scripts read these.
# Safe to keep; they are NOT bundled into the client because the scripts
# run under Node, not Vite.
VITE_OPENAI_API_KEY=sk-proj-...
VITE_OPENAI_MODEL=gpt-4o
VITE_EMBEDDING_MODEL=text-embedding-3-small
VITE_PINECONE_API_KEY=pcsk_...
VITE_PINECONE_HOST=https://your-index.svc.region.pinecone.io
VITE_PINECONE_INDEX_NAME=libby-chat-bot
VITE_PINECONE_ENVIRONMENT=us-east-1
```

> ⚠️ **Security:** `.env` is gitignored. The browser only ever calls `/api/chat`; OpenAI and Pinecone keys never reach the client.

---

## Document Indexer

`index-documents.js` reads **PDF** files (via `pdfjs-dist`) and **DOCX** files (via `mammoth`), extracts plain text, chunks it (300-word windows with 80-word overlap), embeds each chunk, and upserts to Pinecone with `sourceType: "document"`.

### Indexed Documents (current set)

The indexer scans `~/Desktop/Libby Data` (default) for `.pdf` and `.docx` files. Current set:

- **25 PDFs** — handbooks (SLA, Bizzell Lead), troubleshooting guides, policies, forms
- **27 DOCX files** — announcements, training docs, attendance, scheduling templates

→ **52 source files → ~198 document vectors** in Pinecone (`sourceType: document`)

Top sources by chunk count include: Treasure Chest, policy, SLA handbook, Training Lists for Bucket Cards, LibCal Equipment Booking, Bizzell Student Lead Handbook 2026, Circulation Policies, Troubleshooting, Catches & Hold Procedures, Abused Book Policy, Lead Training (Discharging), Library User FAQs, Mending Slips, Alma Outages, ADA/FERPA, Inclement Weather Volunteer Team, OK-Share Badges, Email Templates for Scheduling.

### Running

```bash
npm run index-docs                       # uses default path
node index-documents.js /custom/path     # custom path
```

**Expected:** 52 files → ~198 vectors (~2 minutes, ~120s on a normal connection).

---

## Web Crawler

`crawl-ou-library.js` reads `https://libraries.ou.edu/sitemap.xml`, filters out staff directory / search / admin URLs, then fetches each page, extracts the main content area, chunks (~800 tokens with 100 overlap), embeds, and upserts with `sourceType: "web"`.

```bash
npm run crawl
```

**Expected:** ~232 pages crawled → ~282 web vectors (~4–5 minutes).

> ⚠️ **The crawler clears the entire Pinecone index before re-indexing.** Always run `npm run index-docs` afterward to restore document vectors.

---

## Conversational Behavior

`api/chat.ts` implements three layers above raw RAG:

### 1. Greeting / casual bypass

Casual queries skip embedding + retrieval entirely and return a varied canned response. Detected patterns:

- Greetings: `hi`, `hii`, `hello`, `hey`, `heya`, `yo`, `sup`, `wassup`, `wsup`, `howdy`, `greetings`, `aloha`
- "Hey libby" / "hi there" / "hey friend"
- "How are you?" / "How's it going?" / "What's up?" / "What's new?"
- "Good morning/afternoon/evening/night" (also `morning`, `evening`, `afternoon` alone)
- Thanks: `thanks`, `thank you`, `thx`, `ty`, `cheers`, `appreciate it`
- Goodbye: `bye`, `see ya`, `cya`, `peace`, `take care`
- Identity: `who are you`, `what can you do`, `help`, `tell me about yourself`
- Acks: `ok`, `cool`, `nice`, `got it`, `sounds good`, `alright`, `aight`
- `test`, `testing`

### 2. Factual fallback for hours / contact / location

Even if the model has indexed-but-stale chunks, hours-style queries hit a deterministic fallback returning the canonical libraries.ou.edu URL — preventing the bot from hallucinating outdated hours.

### 3. Refusal interceptor

If gpt-4o falls back to "I don't have that information…" *but* the user's question is a known factual lookup, the response is automatically swapped with the canonical URL.

---

## Testing

### Manual QA Suite

A 31-question regression suite covers:

| Category | Examples |
|---|---|
| Greetings | `hi`, `good evening`, `howdy partner` |
| Identity | "who are you", "what can you help me with" |
| Procedure | mark missing, OK-Share badge, overdue catch, shift close |
| Policy | abused book, alumni borrowing, food at desk |
| Multi-doc synthesis | "what systems do SLAs use", "compare SLA vs Bizzell lead" |
| Typo robustness | "mrk a bok as missng", "expird hold on shlf" |
| Abbreviations | `WIW shift drop`, `SharePoint stats form` |
| Vague single-word | `hold`, `missing` |
| Out-of-scope | weather, world cup, code requests |
| Hours | "what time does the library open" → fallback URL |
| Contact | "phone number for circulation desk" |
| Patron handling | "lost book", "someone is being loud" |
| Long synthesis | multi-step damaged-reserve scenario |
| Hallucination probe | dean name, total book count |

**Latest run: 30/31 PASS, 1 WARN** — the only WARN is "what can you help me with" which goes through RAG and answers usefully but doesn't hit the canned identity reply.

### Functional tests

```bash
node functional-test.js
```

Covers 13 employee-question scenarios spanning borrowing, technology lending, locations, policies, research help, and edge cases.

### Pinecone connection check

```bash
npm run test-pinecone
```

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| **Dev server** | `npm run dev` | Vite + dev API middleware on :3000 |
| **Build** | `npm run build` | Production build to `dist/` |
| **Preview** | `npm run preview` | Preview prod build locally |
| **Index docs** | `npm run index-docs` | Index PDF + DOCX → Pinecone (`sourceType: document`) |
| **Crawl** | `npm run crawl` | Crawl OU Libraries → Pinecone (`sourceType: web`); clears index first |
| **Test Pinecone** | `npm run test-pinecone` | Connection + sample query check |

---

## Re-Indexing Workflow

The crawler is destructive. Order matters:

```bash
# 1. Wipe + re-crawl the website
npm run crawl

# 2. Re-index local PDFs + DOCX
npm run index-docs

# 3. Verify
npm run test-pinecone
# Expected: ~480 vectors (282 web + 198 document)
```

To add new docs without re-crawling: drop new `.pdf` or `.docx` files into `~/Desktop/Libby Data` and re-run `npm run index-docs`. New vectors are added; web vectors are untouched.

---

## Deployment

The project is deployed to **Vercel** at https://libby-ai-powered-library-search.vercel.app.

Vercel auto-deploys on every push to `main`:
- Frontend: built from Vite (`npm run build` → `dist/`)
- Backend: `api/chat.ts` runs as a Vercel Serverless Function (Node runtime)

### Vercel Environment Variables

In **Project Settings → Environment Variables**, set:

```
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
EMBEDDING_MODEL=text-embedding-3-small
PINECONE_API_KEY=pcsk_...
PINECONE_HOST=https://...pinecone.io
```

After updating env vars, redeploy via **Deployments → ⋯ → Redeploy** so the function picks up the new values.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Bot returns "I don't have that information" for everything | Pinecone index empty or wrong host | Run `npm run test-pinecone`, verify `PINECONE_HOST` |
| Bot still uses gpt-3.5-turbo on prod | `OPENAI_MODEL` not set in Vercel dashboard | Add `OPENAI_MODEL=gpt-4o` and redeploy |
| 429 rate-limit errors during testing | Hit OpenAI TPM ceiling for gpt-4o (30K) | Throttle calls, lower max_tokens, or upgrade plan |
| Greetings going to RAG | Vite SSR module cache | Restart `npm run dev` |
| PDF indexer fails on a file | Corrupted or scanned-image PDF | `pdfjs-dist` only handles text-based PDFs; needs OCR for images |
| DOCX indexer fails | File is `.doc` (legacy) not `.docx` | Re-save as `.docx`; `mammoth` doesn't read `.doc` |
| `node-domexception` deprecation warning on build | Transitive dep | Harmless; modern Node has native `DOMException` |

---

## Future Roadmap

| Feature | Status |
|---------|--------|
| Conversation persistence (localStorage) | ✅ Done |
| Message timestamps | ✅ Done |
| Markdown rendering (bold, code, numbered lists) | ✅ Done |
| Copy-to-clipboard on bot messages | ✅ Done |
| Scroll-to-bottom button | ✅ Done |
| Clickable source pills | ✅ Done |
| Accessibility (ARIA, live regions, focus) | ✅ Done |
| Multi-line input | ✅ Done |
| Server-side API keys via serverless function | ✅ Done |
| DOCX support in indexer | ✅ Done |
| Greeting / casual conversation handling | ✅ Done |
| Factual fallback for hours/contact/location | ✅ Done |
| gpt-4o upgrade for stronger reasoning | ✅ Done |
| Vercel deployment | ✅ Done |
| Tailwind build-time integration (replace CDN) | 🔜 Planned |
| Admin dashboard (vector stats, re-indexing UI) | 💡 Idea |
| XLSX support in indexer | 💡 Idea |
| Feedback loop (rate / flag answers) | 💡 Idea |
| OCR for scanned PDFs (Tesseract.js) | 💡 Idea |
| Streaming from gpt-4o (real, not simulated) | 💡 Idea |

---

## Contributing

1. **Fork** the repo
2. **Create a branch:** `git checkout -b feature/your-feature`
3. **Make changes** and test locally with `npm run dev`
4. **Commit:** `git commit -m "feat: describe your change"`
5. **Push:** `git push origin feature/your-feature`
6. **Open a PR** against `main`

### Commit prefixes

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `ui:` | UI/UX changes |
| `docs:` | Documentation |
| `refactor:` | Code restructure with no behavior change |

---

## License

Built for the **University of Oklahoma Libraries**. Internal procedure documents referenced by the application are property of OU Libraries and are not committed to this repository.

## Acknowledgments

- **OU Libraries** — internal documents and domain expertise
- **OpenAI** — `gpt-4o` for response generation, `text-embedding-3-small` for embeddings
- **Pinecone** — serverless vector database
- **Mozilla PDF.js** (`pdfjs-dist`) — PDF text extraction
- **mammoth** — DOCX text extraction
- **Vercel** — serverless hosting

## Authors

- **Sujan Reddy Ayyagari** — Developer & Maintainer
