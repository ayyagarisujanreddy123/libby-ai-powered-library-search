#!/usr/bin/env node

/**
 * OU Libraries Web Crawler → Pinecone Indexer
 * 
 * Crawls https://libraries.ou.edu using sitemap.xml, extracts text content,
 * generates OpenAI embeddings, and upserts into Pinecone vector DB.
 * 
 * Usage: node crawl-ou-library.js
 * 
 * Requires .env with:
 *   VITE_OPENAI_API_KEY
 *   VITE_PINECONE_API_KEY
 *   VITE_PINECONE_HOST
 *   VITE_PINECONE_INDEX_NAME
 *   VITE_EMBEDDING_MODEL (optional, defaults to text-embedding-3-small)
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { config } from 'dotenv';

// Load .env
config();

// ===== Configuration =====
const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.VITE_PINECONE_API_KEY;
const PINECONE_HOST = process.env.VITE_PINECONE_HOST;
const EMBEDDING_MODEL = process.env.VITE_EMBEDDING_MODEL || 'text-embedding-3-small';
const SITEMAP_URL = 'https://libraries.ou.edu/sitemap.xml';
const CHUNK_SIZE = 800;       // ~800 tokens per chunk
const CHUNK_OVERLAP = 100;    // overlap between chunks
const BATCH_SIZE = 10;        // vectors per upsert batch (small for reliability)
const CRAWL_DELAY_MS = 100;   // delay between page fetches
const API_DELAY_MS = 100;     // delay between API calls
const BATCH_DELAY_MS = 1500;  // delay between batch upserts

// URL patterns to skip
const SKIP_PATTERNS = [
    '/staff-directory/',
    '/search-results-page',
    '/node',
    '/user/',
    '/admin/',
];

// ===== Validation =====
if (!OPENAI_API_KEY) {
    console.error('❌ VITE_OPENAI_API_KEY not found in .env');
    process.exit(1);
}
if (!PINECONE_API_KEY) {
    console.error('❌ VITE_PINECONE_API_KEY not found in .env');
    process.exit(1);
}
if (!PINECONE_HOST) {
    console.error('❌ VITE_PINECONE_HOST not found in .env');
    process.exit(1);
}

console.log('🔧 Configuration:');
console.log(`   OpenAI Key: ${OPENAI_API_KEY.substring(0, 12)}...`);
console.log(`   Pinecone Host: ${PINECONE_HOST}`);
console.log(`   Embedding Model: ${EMBEDDING_MODEL}`);
console.log(`   Chunk Size: ${CHUNK_SIZE} tokens, Overlap: ${CHUNK_OVERLAP}`);
console.log('');

// ===== Helper Functions =====

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse sitemap.xml and extract URLs
 */
async function fetchSitemapUrls() {
    console.log(`📡 Fetching sitemap: ${SITEMAP_URL}`);
    const response = await fetch(SITEMAP_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch sitemap: ${response.status}`);
    }
    const xml = await response.text();

    // Extract URLs using regex (no XML parser needed)
    const urls = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    while ((match = locRegex.exec(xml)) !== null) {
        urls.push(match[1]);
    }

    console.log(`   Found ${urls.length} URLs in sitemap`);
    return urls;
}

/**
 * Filter URLs, skipping staff directory, search pages, etc.
 */
function filterUrls(urls) {
    const filtered = urls.filter(url => {
        return !SKIP_PATTERNS.some(pattern => url.includes(pattern));
    });
    console.log(`   After filtering: ${filtered.length} pages to crawl`);
    return filtered;
}

/**
 * Strip HTML tags and extract clean text
 */
function htmlToText(html) {
    // Remove script, style, nav, footer, header elements entirely
    let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');

    // Replace block-level elements with newlines
    text = text
        .replace(/<\/?(h[1-6]|p|div|section|article|main|li|tr|br|hr)[^>]*>/gi, '\n')
        .replace(/<\/?(ul|ol|table|blockquote)[^>]*>/gi, '\n');

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Decode common HTML entities
    text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#\d+;/g, '')
        .replace(/&\w+;/g, '');

    // Clean up whitespace
    text = text
        .replace(/[ \t]+/g, ' ')       // collapse horizontal whitespace
        .replace(/\n\s*\n/g, '\n\n')    // collapse multiple newlines
        .replace(/^\s+|\s+$/gm, '')     // trim each line
        .trim();

    return text;
}

/**
 * Extract page title from HTML
 */
function extractTitle(html) {
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
        return titleMatch[1].replace(/ \| OU Libraries$/i, '').trim();
    }

    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
        return h1Match[1].replace(/<[^>]+>/g, '').trim();
    }

    return 'Unknown Page';
}

/**
 * Extract main content area from HTML (target the main/article area)
 */
function extractMainContent(html) {
    // Try to find main content area
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (mainMatch) return mainMatch[1];

    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) return articleMatch[1];

    // Try content region (Drupal)
    const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i);
    if (contentMatch) return contentMatch[1];

    // Fallback: use the body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) return bodyMatch[1];

    return html;
}

/**
 * Crawl a single page and extract text
 */
async function crawlPage(url) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'LibbyBot/1.0 (OU Library AI Assistant)'
            }
        });

        if (!response.ok) {
            console.warn(`   ⚠️  ${response.status} for ${url}`);
            return null;
        }

        const html = await response.text();
        const title = extractTitle(html);
        const mainContent = extractMainContent(html);
        const text = htmlToText(mainContent);

        // Skip pages with very little content
        if (text.length < 50) {
            console.warn(`   ⚠️  Skipping (too short: ${text.length} chars): ${url}`);
            return null;
        }

        return { url, title, text };
    } catch (error) {
        console.error(`   ❌ Error crawling ${url}:`, error.message);
        return null;
    }
}

/**
 * Split text into overlapping chunks
 */
function chunkText(text, title, url) {
    const words = text.split(/\s+/);
    const chunks = [];

    // If text is small enough, return as single chunk
    if (words.length <= CHUNK_SIZE) {
        chunks.push({
            text: text,
            title: title,
            url: url,
            chunkIndex: 0,
            totalChunks: 1,
        });
        return chunks;
    }

    let start = 0;
    let chunkIndex = 0;

    while (start < words.length) {
        const end = Math.min(start + CHUNK_SIZE, words.length);
        const chunkWords = words.slice(start, end);
        const chunkText = chunkWords.join(' ');

        chunks.push({
            text: `${title}\n\n${chunkText}`,
            title: title,
            url: url,
            chunkIndex: chunkIndex,
            totalChunks: -1, // will be set after
        });

        chunkIndex++;
        start = end - CHUNK_OVERLAP;

        // Prevent infinite loop
        if (start >= words.length - CHUNK_OVERLAP) break;
    }

    // Set totalChunks
    chunks.forEach(c => c.totalChunks = chunks.length);

    return chunks;
}

/**
 * Generate embedding via OpenAI API
 */
async function generateEmbedding(text) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: text,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Embedding API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
}

/**
 * Upsert vectors to Pinecone via REST API
 */
async function upsertToPinecone(vectors) {
    const url = `${PINECONE_HOST.replace(/\/+$/, '')}/vectors/upsert`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Api-Key': PINECONE_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vectors }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinecone upsert error: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Delete all vectors from Pinecone index
 */
async function clearPineconeIndex() {
    console.log('🗑️  Clearing existing Pinecone index...');
    const url = `${PINECONE_HOST.replace(/\/+$/, '')}/vectors/delete`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Api-Key': PINECONE_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleteAll: true }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`   ⚠️  Warning: Could not clear index: ${response.status} - ${errorText}`);
    } else {
        console.log('   ✅ Index cleared');
    }
}

/**
 * Get Pinecone index stats
 */
async function getPineconeStats() {
    const url = `${PINECONE_HOST.replace(/\/+$/, '')}/describe_index_stats`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Api-Key': PINECONE_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    });

    if (response.ok) {
        return await response.json();
    }
    return null;
}

// ===== Main Pipeline =====

async function main() {
    const startTime = Date.now();
    console.log('🚀 OU Libraries Web Crawler → Pinecone Indexer');
    console.log('================================================\n');

    // Step 1: Fetch sitemap
    const allUrls = await fetchSitemapUrls();
    const urls = filterUrls(allUrls);
    console.log('');

    // Step 2: Clear existing index
    await clearPineconeIndex();
    await sleep(2000); // Wait for deletion to propagate
    console.log('');

    // Step 3: Crawl pages
    console.log('🕷️  Crawling pages...');
    const pages = [];
    for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        process.stdout.write(`   [${i + 1}/${urls.length}] ${url.substring(0, 70)}...`);

        const page = await crawlPage(url);
        if (page) {
            pages.push(page);
            console.log(` ✅ (${page.text.length} chars)`);
        } else {
            console.log(' ⏭️');
        }

        await sleep(CRAWL_DELAY_MS);
    }
    console.log(`\n   📄 Successfully crawled ${pages.length} pages\n`);

    // Step 4: Chunk text
    console.log('✂️  Chunking text...');
    const allChunks = [];
    for (const page of pages) {
        const chunks = chunkText(page.text, page.title, page.url);
        allChunks.push(...chunks);
    }
    console.log(`   📦 Created ${allChunks.length} chunks from ${pages.length} pages\n`);

    // Step 5: Generate embeddings and upsert
    console.log('🧠 Generating embeddings and upserting to Pinecone...');
    let vectorBatch = [];
    let totalUpserted = 0;
    let errors = 0;

    for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];

        try {
            // Generate embedding
            const embedding = await generateEmbedding(chunk.text);
            await sleep(API_DELAY_MS);

            // Create unique vector ID using hash of URL + chunk index
            const hash = createHash('sha256').update(`${chunk.url}::${chunk.chunkIndex}`).digest('hex').substring(0, 16);
            const vectorId = `ou-${hash}`;

            vectorBatch.push({
                id: vectorId,
                values: embedding,
                metadata: {
                    text: chunk.text.substring(0, 30000), // Pinecone metadata limit
                    source: chunk.title,
                    url: chunk.url,
                    page: chunk.chunkIndex + 1,
                    totalChunks: chunk.totalChunks,
                },
            });

            // Upsert in batches
            if (vectorBatch.length >= BATCH_SIZE) {
                await upsertToPinecone(vectorBatch);
                totalUpserted += vectorBatch.length;
                console.log(`   📤 Upserted batch: ${totalUpserted}/${allChunks.length} vectors`);
                vectorBatch = [];
                await sleep(BATCH_DELAY_MS);
            }

            // Progress indicator
            if ((i + 1) % 10 === 0) {
                process.stdout.write(`   🔄 Processing: ${i + 1}/${allChunks.length}\r`);
            }
        } catch (error) {
            errors++;
            console.error(`\n   ❌ Error on chunk ${i + 1}: ${error.message}`);
            if (errors > 10) {
                console.error('   Too many errors, aborting...');
                break;
            }
            await sleep(1000); // Back off on error
        }
    }

    // Upsert remaining batch
    if (vectorBatch.length > 0) {
        await upsertToPinecone(vectorBatch);
        totalUpserted += vectorBatch.length;
    }

    console.log(`\n   ✅ Total vectors upserted: ${totalUpserted}`);
    if (errors > 0) {
        console.log(`   ⚠️  Errors: ${errors}`);
    }

    // Step 6: Verify
    console.log('\n📊 Verifying Pinecone index...');
    console.log('   Waiting 30s for Pinecone serverless to update counts...');
    await sleep(30000); // Serverless indexes take time to update stats
    const stats = await getPineconeStats();
    if (stats) {
        console.log(`   Total vectors in index: ${stats.totalRecordCount || stats.totalVectorCount || 'unknown'}`);
        console.log(`   Dimension: ${stats.dimension || 'unknown'}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Done! Crawled ${pages.length} pages, created ${allChunks.length} chunks, upserted ${totalUpserted} vectors in ${elapsed}s`);
    console.log('   You can now use Libby to ask questions about OU Libraries!');
}

main().catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
});
