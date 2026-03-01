<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Libby — AI-Powered Library Search

**Libby** is an AI-powered chatbot designed for **OU Libraries staff, Student Library Assistants (SLAs), and library leads**. It uses Retrieval-Augmented Generation (RAG) to answer employee questions about library procedures, policies, services, and locations by searching through indexed content from the [OU Libraries website](https://libraries.ou.edu).

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Web Crawler](#web-crawler)
- [Testing](#testing)
- [Scripts Reference](#scripts-reference)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)

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
- 👥 **Staff-Oriented** — Answers are framed for employees helping patrons, not for patrons directly
- 📚 **248 Indexed Pages** — Comprehensive coverage of the OU Libraries website (services, policies, locations, collections)
- 📄 **Source Citations** — Every answer includes clickable source references so staff can verify information
- 🎨 **Modern UI** — Dark-themed interface with animated backgrounds, smooth streaming responses, and starter prompts
- 🌐 **Cross-Browser** — Works in Chrome, Safari, Firefox, and on mobile devices via network URL
- ⚡ **Real-Time Streaming** — Responses stream in token-by-token for a responsive feel

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
     │  248 vectors     │   │ text-embedding-   │
     │  1536 dimensions │   │   3-small         │
     │  libby-chat-bot  │   │ gpt-3.5-turbo     │
     └──────────────────┘   └──────────────────┘
```

### RAG Pipeline Flow

1. **User asks a question** in the chat interface
2. **Embedding generation** — The query is converted to a 1536-dimensional vector using OpenAI's `text-embedding-3-small` model
3. **Vector search** — The embedding is sent to Pinecone to find the top 5 most semantically similar document chunks
4. **Context assembly** — Retrieved chunks (with source metadata) are assembled into a context prompt
5. **LLM generation** — OpenAI's `gpt-3.5-turbo` generates a staff-oriented response using the system prompt and retrieved context
6. **Streaming response** — The answer streams back to the UI token-by-token with source citations displayed below

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript | UI components, state management |
| **Styling** | Tailwind CSS, Lucide Icons | Modern dark theme, iconography |
| **Animation** | Framer Motion, CSS Keyframes | Background particles, floating books, transitions |
| **Build Tool** | Vite 6 | Dev server, HMR, API proxy, production builds |
| **Embeddings** | OpenAI `text-embedding-3-small` | Convert text → 1536-dim vectors |
| **LLM** | OpenAI `gpt-3.5-turbo` | Generate natural language responses |
| **Vector DB** | Pinecone (Serverless) | Store and search document embeddings |
| **Web Crawler** | Node.js (built-in `fetch`) | Crawl OU Libraries website and index content |

---

## Project Structure

```
libby-—-ai-powered-library-search/
├── App.tsx                    # Main application component (UI, layout, chat)
├── index.tsx                  # React entry point with error boundary
├── index.html                 # HTML template
├── index.css                  # Global styles (Tailwind + custom)
├── types.ts                   # TypeScript type definitions
├── vite.config.ts             # Vite config (proxy, build settings)
├── package.json               # Dependencies and scripts
├── .env                       # API keys and configuration (not committed)
├── env.example                # Template for .env
│
├── hooks/
│   └── useChat.ts             # React hook for chat state & message handling
│
├── services/
│   ├── chatService.ts         # System prompt + RAG orchestration
│   ├── ragService.ts          # RAG pipeline (embed → search → generate)
│   ├── openaiService.ts       # OpenAI API wrapper (embeddings + chat)
│   ├── pineconeService.ts     # Pinecone REST API client (via proxy)
│   └── configService.ts       # Environment variable management
│
├── components/
│   ├── ChatWindow.tsx         # Message list container
│   ├── ChatInput.tsx          # Text input + send button
│   ├── Message.tsx            # Individual message bubble
│   ├── SourcePill.tsx         # Clickable source citation pill
│   ├── TypingIndicator.tsx    # Animated typing dots
│   ├── Header.tsx             # App header with logo
│   ├── AboutModal.tsx         # About dialog
│   └── icons/                 # Custom SVG icon components
│
├── crawl-ou-library.js        # Web crawler script (sitemap → Pinecone)
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

# 4. Index the OU Libraries website into Pinecone
npm run crawl

# 5. Start the development server
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

## Web Crawler

The web crawler (`crawl-ou-library.js`) is a standalone Node.js script that populates the Pinecone vector database with content from the OU Libraries website.

### What It Does

1. **Fetches the sitemap** from `https://libraries.ou.edu/sitemap.xml` (~322 URLs)
2. **Filters** out staff directory pages, search results, and admin pages → ~217 pages
3. **Crawls each page** using `fetch`, extracting the `<main>` content area
4. **Strips HTML** to clean text, removing navigation, scripts, and boilerplate
5. **Chunks text** into ~800-token pieces with 100-token overlap for better retrieval
6. **Generates embeddings** for each chunk using OpenAI's `text-embedding-3-small`
7. **Upserts vectors** into Pinecone with metadata (source URL, page title, full text)

### Running the Crawler

```bash
npm run crawl
```

**Expected output:**
- ~205 pages crawled
- ~248 text chunks created
- ~248 vectors upserted to Pinecone
- Total time: ~3-4 minutes

### Re-Indexing

Run `npm run crawl` again whenever the OU Libraries website is updated. The script clears the existing index before re-indexing to avoid stale data.

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
| **Crawl** | `npm run crawl` | Crawl OU Libraries website and index into Pinecone |
| **Test Pinecone** | `npm run test-pinecone` | Test Pinecone connection and query |

---

## How It Works

### System Prompt

Libby uses a carefully crafted system prompt that establishes its role as a **staff assistant**:

```
You are Libby, an AI assistant built for OU Libraries staff, Student Library 
Assistants (SLAs), and library leads.

AUDIENCE: Your users are library EMPLOYEES — not patrons. They ask you 
questions so they can better assist patrons or understand internal 
procedures and policies.

YOUR ROLE:
- Answer from the perspective of HELPING STAFF do their job
- Explain what the employee should DO or TELL the patron
- Use language like "You should tell the patron...", "The procedure is..."
```

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
| `source` | Page title | "Technology Lending" |
| `url` | Source page URL | "https://libraries.ou.edu/find-borrow-request/technology-lending" |
| `page` | Chunk number within the page | 1 |
| `totalChunks` | Total chunks for this page | 2 |

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Chatbot not responding** | Check browser console for API errors. Verify `.env` has valid API keys. |
| **All answers reference the same page** | Run `npm run crawl` to re-index. Check `node diagnose-pinecone.js` for vector count. |
| **CORS errors in browser** | Ensure Vite dev server is running (not production build). The proxy only works in dev mode. |
| **Network URL not working** | Ensure both devices are on the same network. Check macOS Firewall settings. |
| **Background shaking during responses** | This was fixed by memoizing particle positions. Pull the latest code. |

### Verifying the Pinecone Index

```bash
node test-pinecone.js
```

This will show the number of vectors in the index and run a sample query.

---

## License

This project was built for the University of Oklahoma Libraries.

## Authors

- **Sujan Reddy Ayyagari** — Developer
