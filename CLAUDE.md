# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm run dev          # Start Vite dev server on port 3000
npm run build        # Production build to dist/
npm run preview      # Preview production build
npx tsc --noEmit     # Type-check without emitting (no lint/test framework configured)
```

### Indexing scripts (Node.js, run outside the browser)

```bash
npm run index-docs   # Index local PDFs into Pinecone (reads from ~/Desktop/Libby Data)
npm run crawl        # Crawl OU Libraries website into Pinecone (clears index first!)
npm run test-pinecone # Verify Pinecone connection and run a sample query
node functional-test.js # End-to-end RAG pipeline tests (13 employee question scenarios)
```

**Re-indexing order matters:** `npm run crawl` clears the entire Pinecone index, so always run `npm run index-docs` afterward to restore document vectors.

## Architecture

This is a **client-side React RAG chatbot**. There is no backend server — all API calls (OpenAI, Pinecone) happen from the browser, with Pinecone proxied through Vite's dev server to bypass CORS.

### Service Layer (most important to understand)

```
User input → useChat hook → chatService → ragService → OpenAI + Pinecone
```

- **ConfigService** (`services/configService.ts`) — Singleton. Reads `VITE_*` env vars via `import.meta.env`. All other services get config from here.
- **OpenAIService** (`services/openaiService.ts`) — Wraps OpenAI SDK: embedding generation (`text-embedding-3-small`, 1536-dim) and chat completions (`gpt-3.5-turbo`).
- **PineconeService** (`services/pineconeService.ts`) — REST client that talks to `/api/pinecone` (Vite proxy). Handles vector upsert, search, delete.
- **RAGService** (`services/ragService.ts`) — Orchestrator. Takes a query → generates embedding → searches Pinecone for top-K chunks → assembles context with `[DOCUMENT]`/`[WEBSITE]` labels → calls OpenAI for a grounded response. Lazily initialized on first use.
- **ChatService** (`services/chatService.ts`) — Entry point for the UI. Contains the full system prompt (employee-focused framing). Wraps RAGService with error handling and user-friendly error messages.

### UI Layer

- **App.tsx** — Top-level composition: JARVIS logo, background animations (memoized), toolbar, starter prompts, and wires together ChatWindow + ChatInput + AboutModal.
- **useChat hook** (`hooks/useChat.ts`) — All chat state: messages array, loading flag, streaming simulation (character-by-character via `setInterval`), localStorage persistence. Derives `showStarterPrompts` from message state.
- **ChatWindow** — Scrollable message list with auto-scroll (only when near bottom), scroll-to-bottom button, `aria-live` region.
- **Message** — Renders bot messages through a lightweight markdown renderer (bold, inline code, numbered lists). Shows timestamps, copy-to-clipboard button, and source pills.
- **ChatInput** — Auto-resizing `<textarea>`, Enter to send, Shift+Enter for newlines, auto-focus on mount.

### Pinecone Proxy (CORS workaround)

Configured in `vite.config.ts`: browser requests to `/api/pinecone/*` are proxied to the real Pinecone host with the API key injected server-side. This only works in dev mode — production needs a real backend.

## Key Patterns

- **Environment variables** use `VITE_` prefix (Vite convention) and are accessed via `import.meta.env.VITE_*`.
- **Two data sources** in Pinecone: `sourceType: "document"` (PDF handbooks, 38 vectors) and `sourceType: "web"` (crawled website, ~248 vectors). Documents are prioritized in the system prompt.
- **Streaming is simulated** — the full response is fetched, then revealed character-by-character via `setInterval(fn, 15)` in useChat.
- **Background animations** generate random positions/offsets once via `useMemo` and inject dynamic `@keyframes` via a `<style>` tag (also memoized). Do not put `Math.random()` in render paths.
- **All keyframe animations** are defined in `index.css` (single source of truth). Dynamic per-book keyframes are the exception — generated in App.tsx but memoized.
- **CSS** uses Tailwind via CDN `<script>` tag (not build-time compiled). Custom animation classes (`.animate-spin-slow`, `.animate-spin-reverse`, `.animate-spin-medium`) are in `index.css`.
- **Build target** is ES2015 for Safari compatibility.

## Types

All shared types are in `types.ts`: `Message`, `Source`, `UserType` enum, `OpenAIConfig`, `PineconeConfig`, `VectorMetadata`, `RAGResponse`, etc. The `Message` type includes optional `timestamp`, `isStreaming`, `isError`, and `sources` fields.
