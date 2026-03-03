#!/usr/bin/env node
/**
 * Index Local PDF Documents → Pinecone
 * 
 * Reads PDF files from a local directory, extracts text, chunks it,
 * generates embeddings, and upserts into Pinecone with sourceType: "document"
 * for priority retrieval over web-crawled data.
 * 
 * Usage: node index-documents.js [optional-path]
 * Default path: /Users/sujanreddyayyagari/Desktop/Lib data
 */
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { createHash } from 'crypto';
import { config } from 'dotenv';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

config();

const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.VITE_PINECONE_API_KEY;
const PINECONE_HOST = process.env.VITE_PINECONE_HOST.replace(/\/+$/, '');
const EMBEDDING_MODEL = process.env.VITE_EMBEDDING_MODEL || 'text-embedding-3-small';

const DEFAULT_DOC_PATH = '/Users/sujanreddyayyagari/Desktop/Libby Data';
const CHUNK_SIZE = 300;       // Smaller chunks for better retrieval precision
const CHUNK_OVERLAP = 80;
const BATCH_SIZE = 10;
const API_DELAY_MS = 100;
const BATCH_DELAY_MS = 1500;

// Validation
if (!OPENAI_API_KEY || !PINECONE_API_KEY || !PINECONE_HOST) {
    console.error('❌ Missing env vars. Check .env for VITE_OPENAI_API_KEY, VITE_PINECONE_API_KEY, VITE_PINECONE_HOST');
    process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== PDF Processing =====

async function extractPDFText(filePath) {
    const buffer = readFileSync(filePath);
    const uint8 = new Uint8Array(buffer);
    const doc = await getDocument({ data: uint8 }).promise;

    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items.map(item => item.str).join(' ');
        pages.push(text);
    }
    return pages.join('\n\n');
}

function chunkText(text, docName) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const chunks = [];

    if (words.length <= CHUNK_SIZE) {
        chunks.push({ text: `${docName}\n\n${words.join(' ')}`, chunkIndex: 0, totalChunks: 1 });
        return chunks;
    }

    let start = 0;
    let idx = 0;
    while (start < words.length) {
        const end = Math.min(start + CHUNK_SIZE, words.length);
        const chunkWords = words.slice(start, end);
        chunks.push({
            text: `${docName}\n\n${chunkWords.join(' ')}`,
            chunkIndex: idx,
            totalChunks: -1,
        });
        idx++;
        start = end - CHUNK_OVERLAP;
        if (start >= words.length - CHUNK_OVERLAP) break;
    }
    chunks.forEach(c => c.totalChunks = chunks.length);
    return chunks;
}

// ===== API Calls =====

async function generateEmbedding(text) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status} - ${await res.text()}`);
    const data = await res.json();
    return data.data[0].embedding;
}

async function upsertToPinecone(vectors) {
    const res = await fetch(`${PINECONE_HOST}/vectors/upsert`, {
        method: 'POST',
        headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vectors }),
    });
    if (!res.ok) throw new Error(`Pinecone upsert error: ${res.status} - ${await res.text()}`);
    return await res.json();
}

async function deleteByPrefix(prefix) {
    // Fetch existing doc vectors to delete them (avoid duplicates on re-run)
    const res = await fetch(`${PINECONE_HOST}/vectors/list`, {
        method: 'GET',
        headers: { 'Api-Key': PINECONE_API_KEY },
    });
    // Note: list endpoint may not be available on all plans, so we skip if it fails
    if (!res.ok) {
        console.log('   ℹ️  Cannot list vectors (plan limitation). Skipping duplicate cleanup.');
        return;
    }
}

async function getPineconeStats() {
    const res = await fetch(`${PINECONE_HOST}/describe_index_stats`, {
        method: 'POST',
        headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });
    if (res.ok) return await res.json();
    return null;
}

// ===== Main =====

async function main() {
    const docPath = process.argv[2] || DEFAULT_DOC_PATH;
    const startTime = Date.now();

    console.log('📄 PDF Document Indexer → Pinecone');
    console.log('='.repeat(50));
    console.log(`   Source: ${docPath}`);
    console.log(`   Model: ${EMBEDDING_MODEL}`);
    console.log('');

    // Check stats before
    const statsBefore = await getPineconeStats();
    const vectorsBefore = statsBefore?.totalVectorCount || 0;
    console.log(`📊 Pinecone index currently has ${vectorsBefore} vectors\n`);

    // Find PDF files
    const files = readdirSync(docPath).filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`📂 Found ${files.length} PDF files:`);
    files.forEach(f => console.log(`   - ${f}`));
    console.log('');

    // Process each PDF
    const allChunks = [];
    for (const file of files) {
        const filePath = join(docPath, file);
        const docName = file.replace(/\.pdf$/i, '');

        console.log(`📖 Processing: ${file}`);
        try {
            const text = await extractPDFText(filePath);
            console.log(`   Extracted ${text.length} chars`);

            if (text.trim().length < 30) {
                console.log(`   ⚠️  Skipping (too little text)`);
                continue;
            }

            const chunks = chunkText(text, docName);
            console.log(`   Created ${chunks.length} chunks`);

            chunks.forEach(c => {
                allChunks.push({
                    ...c,
                    docName,
                    fileName: file,
                });
            });
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
        }
    }

    console.log(`\n✂️  Total: ${allChunks.length} chunks from ${files.length} PDFs\n`);

    // Generate embeddings and upsert
    console.log('🧠 Generating embeddings and upserting...');
    let vectorBatch = [];
    let totalUpserted = 0;
    let errors = 0;

    for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        try {
            const embedding = await generateEmbedding(chunk.text);
            await sleep(API_DELAY_MS);

            const hash = createHash('sha256').update(`doc::${chunk.fileName}::${chunk.chunkIndex}`).digest('hex').substring(0, 16);
            const vectorId = `doc-${hash}`;

            vectorBatch.push({
                id: vectorId,
                values: embedding,
                metadata: {
                    text: chunk.text.substring(0, 30000),
                    source: chunk.docName,
                    sourceType: 'document',   // KEY: marks this as document data (priority)
                    fileName: chunk.fileName,
                    page: chunk.chunkIndex + 1,
                    totalChunks: chunk.totalChunks,
                },
            });

            if (vectorBatch.length >= BATCH_SIZE) {
                await upsertToPinecone(vectorBatch);
                totalUpserted += vectorBatch.length;
                console.log(`   📤 Upserted: ${totalUpserted}/${allChunks.length}`);
                vectorBatch = [];
                await sleep(BATCH_DELAY_MS);
            }

            if ((i + 1) % 5 === 0) {
                process.stdout.write(`   🔄 Processing: ${i + 1}/${allChunks.length}\r`);
            }
        } catch (err) {
            errors++;
            console.error(`\n   ❌ Error on chunk ${i + 1}: ${err.message}`);
            if (errors > 10) { console.error('   Too many errors, aborting.'); break; }
            await sleep(1000);
        }
    }

    // Upsert remaining
    if (vectorBatch.length > 0) {
        await upsertToPinecone(vectorBatch);
        totalUpserted += vectorBatch.length;
    }

    console.log(`\n   ✅ Document vectors upserted: ${totalUpserted}`);

    // Verify
    console.log('\n📊 Verifying Pinecone index...');
    console.log('   Waiting 15s for index to update...');
    await sleep(15000);
    const statsAfter = await getPineconeStats();
    const vectorsAfter = statsAfter?.totalVectorCount || 0;
    console.log(`   Before: ${vectorsBefore} vectors`);
    console.log(`   After:  ${vectorsAfter} vectors`);
    console.log(`   Added:  ${vectorsAfter - vectorsBefore} document vectors`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Done in ${elapsed}s! Indexed ${files.length} PDFs (${totalUpserted} vectors)`);
    console.log('   Document data will be prioritized over web-crawled data in responses.');
}

main().catch(err => { console.error('\n💥 Fatal:', err); process.exit(1); });
