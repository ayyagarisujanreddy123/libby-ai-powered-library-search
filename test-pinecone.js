// Test script to verify Pinecone connection and data
// Run with: node test-pinecone.js

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
const envPath = join(__dirname, '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^VITE_PINECONE_(\w+)=(.*)$/);
    if (match) {
      const key = match[1];
      const value = match[2].trim();
      process.env[`VITE_PINECONE_${key}`] = value;
    }
  });
} catch (error) {
  console.warn('Could not read .env file, using process.env');
}

const API_KEY = process.env.VITE_PINECONE_API_KEY;
const INDEX_NAME = process.env.VITE_PINECONE_INDEX_NAME || 'libby-chat-bot';
const ENVIRONMENT = process.env.VITE_PINECONE_ENVIRONMENT || 'us-east-1';

console.log('🔍 Pinecone Connection Test\n');
console.log('Configuration:');
console.log(`  Index Name: ${INDEX_NAME}`);
console.log(`  Environment: ${ENVIRONMENT}`);
console.log(`  API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET'}\n`);

if (!API_KEY) {
  console.error('❌ ERROR: VITE_PINECONE_API_KEY is not set in .env file');
  process.exit(1);
}

async function testPinecone() {
  try {
    // Initialize Pinecone client
    console.log('1️⃣ Initializing Pinecone client...');
    const pinecone = new Pinecone({
      apiKey: API_KEY,
    });
    console.log('✅ Pinecone client initialized\n');

    // Get the index
    console.log('2️⃣ Connecting to index...');
    const index = pinecone.index(INDEX_NAME);
    console.log(`✅ Connected to index: ${INDEX_NAME}\n`);

    // Get index stats
    console.log('3️⃣ Getting index statistics...');
    const stats = await index.describeIndexStats();
    console.log('✅ Index Statistics:');
    console.log(`   Total Vectors: ${stats.totalRecordCount || stats.totalVectorCount || 0}`);
    console.log(`   Dimension: ${stats.dimension || 'N/A'}`);
    console.log(`   Index Fullness: ${stats.indexFullness || 'N/A'}`);
    if (stats.namespaces) {
      console.log(`   Namespaces: ${Object.keys(stats.namespaces).length}`);
      Object.entries(stats.namespaces).forEach(([ns, data]) => {
        console.log(`     - ${ns}: ${data.recordCount || 0} vectors`);
      });
    }
    console.log('');

    // Fetch a few sample vectors to see metadata structure
    console.log('4️⃣ Fetching sample vectors to check metadata structure...');
    try {
      // First, try to list some vector IDs by querying with a random vector
      const testVector = new Array(stats.dimension || 1536).fill(0).map(() => Math.random());
      const queryResult = await index.query({
        vector: testVector,
        topK: 3,
        includeMetadata: true,
      });

      if (queryResult.matches && queryResult.matches.length > 0) {
        console.log(`✅ Found ${queryResult.matches.length} sample vectors\n`);
        console.log('📋 Sample Vector Metadata Structure:');
        queryResult.matches.forEach((match, i) => {
          console.log(`\n   Vector ${i + 1}:`);
          console.log(`     ID: ${match.id}`);
          console.log(`     Score: ${match.score?.toFixed(4) || 'N/A'}`);
          console.log(`     Metadata Keys: ${match.metadata ? Object.keys(match.metadata).join(', ') : 'None'}`);
          if (match.metadata) {
            console.log(`     Metadata Content:`);
            Object.entries(match.metadata).forEach(([key, value]) => {
              const preview = typeof value === 'string' && value.length > 100 
                ? value.substring(0, 100) + '...' 
                : value;
              console.log(`       ${key}: ${preview}`);
            });
          }
        });
      } else {
        console.log('⚠️  No vectors found in query (index might be empty or query failed)');
      }
    } catch (fetchError) {
      console.error('❌ Error fetching sample vectors:', fetchError.message);
    }
    console.log('');

    // Test a real search query
    console.log('5️⃣ Testing search with a sample query...');
    console.log('   (This requires OpenAI embeddings - will test if OpenAI is configured)');
    
    const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      try {
        const { OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
        
        const testQuery = 'student library access';
        console.log(`   Query: "${testQuery}"`);
        
        // Generate embedding
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: testQuery,
        });
        const embedding = embeddingResponse.data[0].embedding;
        console.log(`   ✅ Generated embedding (dimension: ${embedding.length})`);
        
        // Search Pinecone
        const searchResult = await index.query({
          vector: embedding,
          topK: 5,
          includeMetadata: true,
        });
        
        console.log(`   ✅ Search completed: Found ${searchResult.matches?.length || 0} results`);
        if (searchResult.matches && searchResult.matches.length > 0) {
          console.log(`   Top result score: ${searchResult.matches[0].score?.toFixed(4)}`);
          console.log(`   Top result has text: ${!!searchResult.matches[0].metadata?.text}`);
        }
      } catch (openaiError) {
        console.log(`   ⚠️  OpenAI test skipped: ${openaiError.message}`);
      }
    } else {
      console.log('   ⚠️  OpenAI API key not set, skipping search test');
    }

    console.log('\n✅ All tests completed!');
    console.log('\n📝 Summary:');
    console.log('   - Pinecone connection: ✅ Working');
    console.log('   - Index access: ✅ Working');
    console.log(`   - Data in index: ${(stats.totalRecordCount || stats.totalVectorCount || 0) > 0 ? '✅ Yes' : '❌ No'}`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testPinecone();

