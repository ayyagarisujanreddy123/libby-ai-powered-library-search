
# Libby — AI-Powered Library Search

**Libby** is an AI-powered chatbot designed exclusively for **OU Libraries employees — Student Library Assistants (SLAs), library leads, and staff**. It uses Retrieval-Augmented Generation (RAG) to answer employee questions about library procedures, policies, services, and locations by searching through **two knowledge sources**: internal procedure documents (SLA Handbook, Bizzell Lead Handbook, etc.) and indexed content from the [OU Libraries website](https://libraries.ou.edu). Document data is prioritized over web data for accuracy.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Document Indexer](#document-indexer)
- [Web Crawler](#web-crawler)
- [Testing](#testing)
- [Scripts Reference](#scripts-reference)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)
- [Re-Indexing Workflow](#re-indexing-workflow)
- [Future Roadmap](#future-roadmap)
- [Contributing](#contributing)

---

## Overview

Libby helps library employees quickly find answers to common questions like:

- *"A patron wants to check out a book, what do I do?"*
- *"What is the technology lending policy?"*
- *"Where should I direct a patron who needs a study room?"*
- *"What are the borrowing privileges for alumni?"*

Instead of searching through multiple web pages or policy documents, staff can ask Libby in natural language and get a concise, staff-oriented answer with source citations.

### Key Features

- 🤖 **RAG-Powered Responses** — Combines vector search (Pinecone) with LLM generation (OpenAI) for accurate, grounded answers
- 👥 **Employee-Focused** — Every response is framed as staff instructions ("Here's what you need to do:", "Tell the patron...")
- 📄 **Dual-Source Knowledge** — 38 document vectors (SLA Handbook, Lead Handbook, procedure PDFs) + 248 web-crawled vectors, with documents prioritized
- 📑 **Source Citations** — Every answer includes source pills with document name and page number; pills with URLs link directly to the source
- 💾 **Chat Persistence** — Conversations are saved to localStorage and survive page refreshes
- 🕐 **Message Timestamps** — Every message displays a relative timestamp (e.g. "2:34 PM" or "Mar 28, 2:34 PM")
- 📝 **Markdown Rendering** — Bot responses render **bold**, `inline code`, and numbered lists with styled formatting
- 📋 **Copy to Clipboard** — Hover any bot message to copy it with one click, with checkmark confirmation
- 🎨 **Modern UI** — Dark-themed interface with JARVIS-style animated logo, floating 3D books, particle effects, and Framer Motion transitions
- 🌐 **Cross-Browser** — Works in Chrome, Safari, Firefox, and on mobile devices via network URL
- ⚡ **Real-Time Streaming** — Responses stream in character-by-character for a responsive feel
- ♿ **Accessible** — ARIA labels, `aria-live` region for screen readers, focus management, keyboard navigation, and visible focus indicators
- 📱 **Responsive** — Auto-resizing textarea input, scroll-to-bottom button for long conversations, and iOS safe area support

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React App)                   │
│                                                         │
│  User Query → useChat Hook → chatService → ragService   │
│                                                         │
│  ragService orchestrates:                               │
│    1. openaiService.generateEmbedding(query)            │
│    2. pineconeService.searchVectors(embedding)           │
│    3. openaiService.generateResponse(query + context)    │
│                                                         │
│  Pinecone calls go through Vite dev proxy (/api/pinecone)│
│  to bypass CORS restrictions                            │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
               ▼                      ▼
     ┌──────────────────┐   ┌──────────────────┐
     │   Pinecone DB    │   │    OpenAI API     │
     │  (Vector Search) │   │ (Embeddings + LLM)│
     │                  │   │                   │
     │  286 vectors     │   │ text-embedding-   │
     │  (38 doc + 248   │   │   3-small         │
     │   web) 1536-dim  │   │ gpt-3.5-turbo     │
     └──────────────────┘   └──────────────────┘
```

### RAG Pipeline Flow

1. **User asks a question** in the chat interface
2. **Embedding generation** — The query is converted to a 1536-dimensional vector using OpenAI's `text-embedding-3-small` model
3. **Vector search** — The embedding is sent to Pinecone to find the top 5 most semantically similar chunks from both documents and web data
4. **Context assembly** — Retrieved chunks are labeled as `[DOCUMENT]` or `[WEBSITE]` and assembled into a context prompt, with documents prioritized
5. **LLM generation** — OpenAI's `gpt-3.5-turbo` generates an employee-focused response using the system prompt and retrieved context
6. **Streaming response** — The answer streams back to the UI character-by-character with source citations displayed below, then persisted to localStorage

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript | UI components, state management |
| **Styling** | Tailwind CSS, Lucide Icons | Modern dark theme, iconography |
| **Animation** | Framer Motion, CSS Keyframes | JARVIS logo, background particles, floating books, message transitions |
| **Persistence** | localStorage | Chat history preserved across page refreshes |
| **Build Tool** | Vite 6 | Dev server, HMR, API proxy, production builds |
| **Embeddings** | OpenAI `text-embedding-3-small` | Convert text → 1536-dim vectors |
| **LLM** | OpenAI `gpt-3.5-turbo` | Generate natural language responses |
| **Vector DB** | Pinecone (Serverless) | Store and search document embeddings |
| **Web Crawler** | Node.js (built-in `fetch`) | Crawl OU Libraries website and index content |
| **Doc Indexer** | Node.js, pdfjs-dist | Extract text from local PDFs and index into Pinecone |

---

## Project Structure

```
libby-—-ai-powered-library-search/
├── App.tsx                    # Main app: composes components, JARVIS logo, background animations, About modal
├── index.tsx                  # React entry point (async App load)
├── index.html                 # HTML template with Safari polyfills and branded loading spinner
├── index.css                  # Single source of truth for global styles & all keyframe animations
├── types.ts                   # TypeScript type definitions (Message, Source, RAG types)
├── vite.config.ts             # Vite config (proxy, build settings)
├── package.json               # Dependencies and scripts
├── .env                       # API keys and configuration (not committed)
├── env.example                # Template for .env
│
├── hooks/
│   └── useChat.ts             # Chat state, streaming, localStorage persistence, timestamps
│
├── services/
│   ├── chatService.ts         # System prompt + RAG orchestration
│   ├── ragService.ts          # RAG pipeline (embed → search → generate)
│   ├── openaiService.ts       # OpenAI API wrapper (embeddings + chat)
│   ├── pineconeService.ts     # Pinecone REST API client (via proxy)
│   └── configService.ts       # Environment variable management
│
├── components/
│   ├── ChatWindow.tsx         # Scrollable message list with auto-scroll, scroll-to-bottom button, aria-live region
│   ├── ChatInput.tsx          # Auto-resizing textarea, auto-focus, Shift+Enter for newlines
│   ├── Message.tsx            # Message bubble with markdown rendering, timestamps, copy-to-clipboard
│   ├── SourcePill.tsx         # Source citation pill (clickable link when URL available)
│   ├── TypingIndicator.tsx    # Framer Motion animated typing dots
│   ├── Header.tsx             # Standalone header component (available for alternate layouts)
│   ├── AboutModal.tsx         # About Libby modal dialog with backdrop blur
│   └── icons/                 # Custom SVG icon components (Bot, User, Send, Copy, Check, etc.)
│
├── crawl-ou-library.js        # Web crawler script (sitemap → Pinecone)
├── index-documents.js         # PDF document indexer (local PDFs → Pinecone)
└── functional-test.js         # Automated functional test suite
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+ (for built-in `fetch` support)
- **npm** (comes with Node.js)
- **OpenAI API Key** — [Get one here](https://platform.openai.com/api-keys)
- **Pinecone Account** — [Sign up free](https://www.pinecone.io/) and create an index named `libby-chat-bot` with **1536 dimensions** and **cosine** metric

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/libby-ai-powered-library-search.git
cd libby-ai-powered-library-search

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp env.example .env
# Edit .env with your API keys (see Environment Variables section below)

# 4. Index local PDF documents into Pinecone (procedure docs, handbooks)
npm run index-docs

# 5. Index the OU Libraries website into Pinecone
npm run crawl

# 6. Re-index documents (crawl clears the index, so re-add docs after)
npm run index-docs

# 7. Start the development server
npm run dev
```

The app will be available at:
- **Local:** http://localhost:3000
- **Network:** http://YOUR_IP:3000 (accessible from other devices on the same network)

---

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# OpenAI Configuration
VITE_OPENAI_API_KEY=sk-proj-your-openai-api-key-here

# Pinecone Configuration
VITE_PINECONE_API_KEY=pcsk_your-pinecone-api-key-here
VITE_PINECONE_ENVIRONMENT=us-east-1
VITE_PINECONE_INDEX_NAME=libby-chat-bot
VITE_PINECONE_HOST=https://your-index-name.svc.your-region.pinecone.io

# Optional: Custom model configurations
VITE_OPENAI_MODEL=gpt-3.5-turbo
VITE_EMBEDDING_MODEL=text-embedding-3-small
```

> ⚠️ **Security Note:** The `.env` file is in `.gitignore` and is never committed. In the current dev setup, the Pinecone API key is proxied server-side through Vite and is not exposed to the browser. The OpenAI API key is used client-side — for production deployment, both keys should be moved behind a backend server.

---

## Document Indexer

The document indexer (`index-documents.js`) reads local PDF files (handbooks, procedure docs), extracts text using Mozilla's PDF.js, chunks it, and indexes it into Pinecone with `sourceType: "document"` metadata for priority retrieval.

### Indexed Documents

| Document | Description | Chunks |
|----------|-------------|--------|
| **SLA Handbook** | Complete SLA procedures, policies, responsibilities | 13 |
| **Bizzell Student Lead Handbook 2026** | Student lead guidelines and expectations | 10 |
| **LibCal Equipment Booking** | Equipment reservation procedures | 5 |
| **Catches/Hold Procedures** | Alma-based hold catching workflow | 2 |
| **Troubleshooting Expired Hold Shelf** | Expired hold resolution process | 2 |
| **Troubleshooting Overdue Reserves Catch** | Overdue reserve handling | 2 |
| **Emergency Contact Info** | Staff emergency contacts | 1 |
| **Guidelines for Sooner Card Building Access** | Building access procedures | 1 |
| **Inclement Weather Volunteer Team** | Weather-related shift procedures | 1 |
| **Research Help Desk** | Research desk procedures | 1 |

### Running the Document Indexer

```bash
npm run index-docs
```

By default, it reads PDFs from `/Users/sujanreddyayyagari/Desktop/Libby Data`. You can specify a custom path:

```bash
node index-documents.js /path/to/your/pdfs
```

**Expected output:** 10 PDFs → 38 document vectors upserted (~40 seconds)

---

## Web Crawler

The web crawler (`crawl-ou-library.js`) populates Pinecone with content from the OU Libraries website, tagged with `sourceType: "web"`.

### What It Does

1. **Fetches the sitemap** from `https://libraries.ou.edu/sitemap.xml` (~322 URLs)
2. **Filters** out staff directory pages, search results, and admin pages → ~217 pages
3. **Crawls each page** using `fetch`, extracting the `<main>` content area
4. **Chunks text** into ~800-token pieces with 100-token overlap
5. **Generates embeddings** using OpenAI's `text-embedding-3-small`
6. **Upserts vectors** with metadata including `sourceType: "web"`

### Running the Crawler

```bash
npm run crawl
```

**Expected output:** ~205 pages → ~248 vectors (~3-4 minutes)

> ⚠️ **Important:** The crawler clears the entire Pinecone index before re-indexing. After running `npm run crawl`, you **must** re-run `npm run index-docs` to restore the document vectors.

---

## Testing

### Automated Functional Tests

The project includes a functional test suite (`functional-test.js`) that tests the chatbot end-to-end across 6 employee question categories:

| Category | # Tests | Description |
|----------|---------|-------------|
| 📚 Borrowing & Circulation | 3 | Check-out procedures, borrowing privileges, overdue items |
| 💻 Technology Lending | 2 | Equipment availability, lending policies |
| 🏛️ Library Locations & Spaces | 2 | Study rooms, building floor maps |
| 📋 Policies & Rules | 2 | Courtesy borrower permits, non-OU student access |
| 🔬 Research Help & Services | 2 | Research consultations, workshops |
| ⚠️ Edge Cases | 2 | Out-of-scope questions, broad queries |

Run the tests:

```bash
node functional-test.js
```

Each test checks:
- **Retrieval quality** — Are the right documents being found? (cosine similarity score)
- **Keyword relevance** — Does the response contain expected topic-specific terms?
- **Staff tone** — Is the answer framed for employees, not patrons?

**Latest results:** 12/13 passed (92% pass rate)

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| **Dev Server** | `npm run dev` | Start Vite dev server on port 3000 |
| **Build** | `npm run build` | Create production build in `dist/` |
| **Preview** | `npm run preview` | Preview production build locally |
| **Index Docs** | `npm run index-docs` | Index local PDF documents into Pinecone (priority source) |
| **Crawl** | `npm run crawl` | Crawl OU Libraries website and index into Pinecone |
| **Test Pinecone** | `npm run test-pinecone` | Test Pinecone connection and query |

---

## How It Works

### System Prompt

Libby uses a carefully crafted system prompt that establishes its role as an **employee assistant** with strict knowledge grounding:

```
You are Libby, an AI assistant built exclusively for OU Libraries employees.

CRITICAL FRAMING:
- Every person asking you a question is a LIBRARY EMPLOYEE on duty
- Frame EVERY answer as instructions for the EMPLOYEE
- Always address the user as a fellow staff member

EMPLOYEE-FOCUSED LANGUAGE (MANDATORY):
- Start responses with: "Here's what you need to do:", "Follow these steps:"
- When involving patrons: "Tell the patron...", "Direct them to..."
- NEVER use patron-facing language like "you can visit" or "bring your ID"

KNOWLEDGE BOUNDARIES:
- Answer ONLY using retrieved documents
- PRIORITY: [DOCUMENT] sources over [WEBSITE] sources
- If not in documents: "I don't have that info. Check with your supervisor."
```

### Data Source Priority

Libby uses two types of indexed data, with internal documents taking priority:

| Source Type | Tag | Priority | Content |
|-------------|-----|----------|---------|
| **Internal Documents** | `[DOCUMENT]` | ⬆️ High | SLA Handbook, Lead Handbook, procedure PDFs |
| **Website Content** | `[WEBSITE]` | Standard | OU Libraries website (services, policies, locations) |

When both sources cover the same topic, the document version is preferred as it contains official internal procedures.

### Pinecone Proxy

Since Pinecone's API doesn't allow direct browser requests (CORS), all Pinecone API calls are proxied through the Vite dev server:

```
Browser → /api/pinecone/query → Vite Proxy → https://pinecone-host/query
```

The proxy injects the API key server-side, keeping it out of the browser.

### Vector Metadata

Each vector in Pinecone stores the following metadata:

| Field | Description | Example |
|-------|-------------|---------|
| `text` | Full text chunk content | "Technology Lending: Laptops are available..." |
| `source` | Document name or page title | "SLA handbook" or "Technology Lending" |
| `sourceType` | Data origin | `"document"` or `"web"` |
| `url` | Source page URL (web only) | "https://libraries.ou.edu/..." |
| `fileName` | PDF file name (docs only) | "SLA handbook.pdf" |
| `page` | Chunk number | 1 |
| `totalChunks` | Total chunks for this source | 13 |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| **Chatbot not responding** | API keys missing or invalid | Check browser console for errors. Verify `.env` has valid `VITE_OPENAI_API_KEY` and `VITE_PINECONE_API_KEY`. |
| **Answers don't reference internal documents** | Document vectors not indexed | Run `npm run index-docs` and verify the output shows 38 vectors upserted. |
| **All answers reference the same page** | Stale or corrupted index | Run `npm run crawl` followed by `npm run index-docs` to fully re-index. |
| **CORS errors in browser console** | Direct Pinecone API calls blocked | Ensure Vite dev server is running (`npm run dev`). The Pinecone proxy only works in dev mode, not production builds. |
| **Network URL not accessible** | Firewall or network mismatch | Ensure both devices are on the same Wi-Fi network. Check macOS **System Settings → Firewall** and allow Node.js connections. |
| **PDF indexer fails on a specific file** | Corrupted or scanned-image PDF | `pdfjs-dist` can only extract text-based PDFs. Scanned image PDFs need OCR preprocessing first. |
| **"TT: undefined function" warnings** | Font parsing warnings from PDF.js | These are harmless — text extraction still works. The warnings come from complex font tables in the PDF. |

### Verifying the Pinecone Index

```bash
node test-pinecone.js
```

This connects to Pinecone, shows the total vector count, and runs a sample similarity search to confirm everything is working.

---

## Re-Indexing Workflow

When you need to update the knowledge base (e.g., new procedure docs or website changes), follow this order:

```bash
# Step 1: Re-crawl the website (⚠️ this clears the entire Pinecone index)
npm run crawl

# Step 2: Re-index PDF documents (restores document vectors after crawl clears them)
npm run index-docs

# Step 3: Verify the index has both sources
node test-pinecone.js
# Expected: ~286 vectors (248 web + 38 document)
```

> **To add new PDF documents:** Place the new PDF files in the `Libby Data` folder and re-run `npm run index-docs`. New documents will be added alongside existing ones without affecting web vectors (unless you also re-crawl).

---

## Future Roadmap

| Feature | Description | Status |
|---------|-------------|--------|
| **Conversation History** | Persist chat history across sessions using localStorage | ✅ Done |
| **Message Timestamps** | Display relative timestamps on every message | ✅ Done |
| **Markdown Rendering** | Render bold, code, and numbered lists in bot responses | ✅ Done |
| **Copy to Clipboard** | One-click copy on bot messages with confirmation feedback | ✅ Done |
| **Scroll-to-Bottom** | Floating button to jump to the latest message in long conversations | ✅ Done |
| **Clickable Source Pills** | Source citations link directly to the source URL when available | ✅ Done |
| **Accessibility** | ARIA labels, live regions, focus management, screen reader support | ✅ Done |
| **Multi-Line Input** | Auto-resizing textarea with Shift+Enter for newlines | ✅ Done |
| **Server-Side API Keys** | Move OpenAI and Pinecone keys behind a backend server for production security | 🔜 Planned |
| **Tailwind Build Integration** | Replace Tailwind CDN with PostCSS/Vite build-time compilation for smaller bundles | 🔜 Planned |
| **Admin Dashboard** | UI for managing indexed documents, viewing vector stats, and triggering re-indexing | 💡 Idea |
| **Multi-Format Support** | Extend indexer to support `.docx`, `.txt`, and `.xlsx` files | 💡 Idea |
| **Feedback Loop** | Allow staff to rate answers and flag incorrect responses for continuous improvement | 💡 Idea |
| **OCR for Scanned PDFs** | Add Tesseract.js integration for indexing scanned/image-based PDF documents | 💡 Idea |

---

## Contributing

1. **Fork** the repository
2. **Create a feature branch:** `git checkout -b feature/your-feature`
3. **Make your changes** and test locally with `npm run dev`
4. **Commit:** `git commit -m "feat: description of your change"`
5. **Push:** `git push origin feature/your-feature`
6. **Open a Pull Request** against `main`

### Commit Message Convention

| Prefix | Use For |
|--------|---------|
| `feat:` | New features or functionality |
| `fix:` | Bug fixes |
| `ui:` | UI/UX changes |
| `docs:` | Documentation updates |
| `refactor:` | Code restructuring without behavior change |

---

## License

This project was built for the **University of Oklahoma Libraries**. All internal procedure documents referenced by this application are property of OU Libraries and are not included in this repository.

## Acknowledgments

- **OU Libraries** — For providing the internal documents and domain expertise
- **OpenAI** — GPT-3.5-turbo for response generation and text-embedding-3-small for vector embeddings
- **Pinecone** — Serverless vector database for semantic search
- **Mozilla PDF.js** (`pdfjs-dist`) — PDF text extraction engine

## Authors

- **Sujan Reddy Ayyagari** — Developer & Maintainer
