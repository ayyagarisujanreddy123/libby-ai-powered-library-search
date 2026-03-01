#!/usr/bin/env node
/**
 * Functional Test Suite — Libby Chatbot
 * Tests employee question categories against the RAG pipeline
 * 
 * Usage: node functional-test.js
 */
import { config } from 'dotenv';
config();

const OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
const PINECONE_API_KEY = process.env.VITE_PINECONE_API_KEY;
const PINECONE_HOST = process.env.VITE_PINECONE_HOST.replace(/\/+$/, '');
const EMBEDDING_MODEL = process.env.VITE_EMBEDDING_MODEL || 'text-embedding-3-small';
const OPENAI_MODEL = process.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo';

const SYSTEM_PROMPT = `You are Libby, an AI assistant built for OU Libraries staff, Student Library Assistants (SLAs), and library leads.

AUDIENCE: Your users are library EMPLOYEES — not patrons. They ask you questions so they can better assist patrons or understand internal procedures and policies.

YOUR ROLE:
- Answer from the perspective of HELPING STAFF do their job
- Explain what the employee should DO or TELL the patron
- Reference official OU Libraries procedures, policies, and services
- Use language like "You should tell the patron...", "The procedure is...", "Direct them to..."

RESPONSE GUIDELINES:
1. Be CONCISE: Answer directly and briefly (2-4 key points maximum)
2. Be ORGANIZED: Use numbered lists (1, 2, 3) for procedures or steps
3. Be FOCUSED: Only include the most relevant information for the staff member
4. Frame answers as staff instructions, not patron-facing advice
5. Keep responses under 150 words unless detailed procedures are needed

FORMATTING RULES:
- Start with a direct answer to the question
- Use numbered lists (1, 2, 3) for procedures or multiple points
- CRITICAL: Each numbered point MUST be on a separate line with a line break after each
- DO NOT use asterisks (*), dashes (-), or bullet points
- Keep each point brief and actionable

Be friendly, professional, and staff-oriented. Get to the point quickly.`;

// ===== Test Cases =====
const TEST_CATEGORIES = [
    {
        category: '📚 Borrowing & Circulation',
        tests: [
            {
                question: 'A patron wants to check out a book, what do I do?',
                expectKeywords: ['circulation', 'check out', 'sooner card', 'bizzell'],
                expectStaffTone: true,
            },
            {
                question: 'What are the borrowing privileges for alumni?',
                expectKeywords: ['alumni', 'borrow', 'privileges', 'policy'],
                expectStaffTone: true,
            },
            {
                question: 'A patron has an overdue item, what should I tell them?',
                expectKeywords: ['return', 'overdue', 'item'],
                expectStaffTone: true,
            },
        ],
    },
    {
        category: '💻 Technology Lending',
        tests: [
            {
                question: 'What equipment can patrons borrow from the library?',
                expectKeywords: ['technology', 'equipment', 'lending', 'check out'],
                expectStaffTone: true,
            },
            {
                question: 'What is the policy for lending laptops?',
                expectKeywords: ['technology', 'lending', 'policy'],
                expectStaffTone: true,
            },
        ],
    },
    {
        category: '🏛️ Library Locations & Spaces',
        tests: [
            {
                question: 'Where should I direct a patron who needs a study room?',
                expectKeywords: ['room', 'bizzell', 'study', 'reserve'],
                expectStaffTone: true,
            },
            {
                question: 'What floors does Bizzell Memorial Library have?',
                expectKeywords: ['floor', 'bizzell', 'level'],
                expectStaffTone: true,
            },
        ],
    },
    {
        category: '📋 Policies & Rules',
        tests: [
            {
                question: 'What is the courtesy borrower permit policy?',
                expectKeywords: ['courtesy', 'borrower', 'permit', 'oklahoma'],
                expectStaffTone: true,
            },
            {
                question: 'Can non-OU students use the library?',
                expectKeywords: ['courtesy', 'visitor', 'non-OU', 'community'],
                expectStaffTone: true,
            },
        ],
    },
    {
        category: '🔬 Research Help & Services',
        tests: [
            {
                question: 'A graduate student needs help with their research, where should I send them?',
                expectKeywords: ['research', 'consultation', 'librarian', 'expert'],
                expectStaffTone: true,
            },
            {
                question: 'What workshops does the library offer?',
                expectKeywords: ['workshop', 'training'],
                expectStaffTone: true,
            },
        ],
    },
    {
        category: '⚠️ Edge Cases',
        tests: [
            {
                question: 'What is the weather like today?',
                expectKeywords: [],
                expectStaffTone: false,
                expectOutOfScope: true,
            },
            {
                question: 'Tell me about the special research collections',
                expectKeywords: ['special', 'research', 'collections', 'bizzell'],
                expectStaffTone: true,
            },
        ],
    },
];

// ===== API Helpers =====

async function embed(text) {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });
    const data = await res.json();
    return data.data[0].embedding;
}

async function queryPinecone(vector, topK = 5) {
    const res = await fetch(`${PINECONE_HOST}/query`, {
        method: 'POST',
        headers: { 'Api-Key': PINECONE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector, topK, includeMetadata: true }),
    });
    return await res.json();
}

async function generateResponse(question, context) {
    const contextText = context.map((m, i) =>
        `[Source ${i + 1}: ${m.metadata?.source || 'Unknown'} | ${m.metadata?.url || ''}]\n${m.metadata?.text || ''}`
    ).join('\n\n---\n\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Context from OU Libraries documents:\n\n${contextText}\n\nEmployee Question: ${question}` },
            ],
            temperature: 0.3,
            max_tokens: 500,
        }),
    });
    const data = await res.json();
    return data.choices[0].message.content;
}

// ===== Test Runner =====

function checkKeywords(response, keywords) {
    const lower = response.toLowerCase();
    const found = keywords.filter(k => lower.includes(k.toLowerCase()));
    const missing = keywords.filter(k => !lower.includes(k.toLowerCase()));
    return { found, missing, score: keywords.length > 0 ? found.length / keywords.length : 1 };
}

function checkStaffTone(response) {
    const staffIndicators = [
        'patron', 'direct them', 'tell the', 'inform', 'procedure', 'staff',
        'advise', 'instruct', 'guide them', 'let them know', 'employee',
        'should tell', 'can direct', 'refer them'
    ];
    const patronIndicators = [
        'you can', 'you should', 'you need to', 'your account', 'visit the',
        'go to the', 'bring your'
    ];

    const lower = response.toLowerCase();
    const staffHits = staffIndicators.filter(s => lower.includes(s)).length;
    const patronHits = patronIndicators.filter(p => lower.includes(p)).length;

    // Staff tone if more staff indicators than patron, or at least 1 staff indicator
    return { isStaffTone: staffHits >= 1 || patronHits === 0, staffHits, patronHits };
}

async function runTest(test) {
    const vector = await embed(test.question);
    await new Promise(r => setTimeout(r, 100));

    const pineconeResult = await queryPinecone(vector);
    const matches = pineconeResult.matches || [];

    const response = await generateResponse(test.question, matches);
    await new Promise(r => setTimeout(r, 200));

    const keywordResult = checkKeywords(response, test.expectKeywords);
    const toneResult = checkStaffTone(response);

    const sources = matches.slice(0, 3).map(m => m.metadata?.source || 'Unknown');
    const topScore = matches[0]?.score || 0;

    let passed = true;
    const issues = [];

    // Check keyword relevance (allow 50% match)
    if (test.expectKeywords.length > 0 && keywordResult.score < 0.5) {
        passed = false;
        issues.push(`Low keyword match (${(keywordResult.score * 100).toFixed(0)}%): missing [${keywordResult.missing.join(', ')}]`);
    }

    // Check staff tone
    if (test.expectStaffTone && !toneResult.isStaffTone) {
        passed = false;
        issues.push(`Patron-facing tone detected (staff: ${toneResult.staffHits}, patron: ${toneResult.patronHits})`);
    }

    // Check retrieval quality
    if (topScore < 0.3 && !test.expectOutOfScope) {
        passed = false;
        issues.push(`Low retrieval score: ${topScore.toFixed(3)}`);
    }

    return {
        question: test.question,
        response: response.substring(0, 300),
        sources,
        topScore,
        keywordScore: keywordResult.score,
        keywordsMissing: keywordResult.missing,
        toneResult,
        passed,
        issues,
    };
}

async function main() {
    console.log('🧪 Libby Functional Test Suite');
    console.log('='.repeat(60));
    console.log(`Testing ${TEST_CATEGORIES.reduce((n, c) => n + c.tests.length, 0)} questions across ${TEST_CATEGORIES.length} categories\n`);

    let totalPassed = 0;
    let totalFailed = 0;
    const allResults = [];

    for (const category of TEST_CATEGORIES) {
        console.log(`\n${category.category}`);
        console.log('-'.repeat(50));

        for (const test of category.tests) {
            process.stdout.write(`  Q: "${test.question.substring(0, 55)}..." `);

            try {
                const result = await runTest(test);
                allResults.push({ category: category.category, ...result });

                if (result.passed) {
                    totalPassed++;
                    console.log('✅ PASS');
                } else {
                    totalFailed++;
                    console.log('❌ FAIL');
                    result.issues.forEach(i => console.log(`     ⚠️  ${i}`));
                }

                console.log(`     📊 Retrieval: ${result.topScore.toFixed(3)} | Keywords: ${(result.keywordScore * 100).toFixed(0)}% | Tone: ${result.toneResult.isStaffTone ? 'Staff ✓' : 'Patron ✗'}`);
                console.log(`     📄 Sources: ${result.sources.join(' | ')}`);
                console.log(`     💬 "${result.response.substring(0, 120)}..."`);
            } catch (error) {
                totalFailed++;
                console.log(`❌ ERROR: ${error.message}`);
                allResults.push({ category: category.category, question: test.question, passed: false, issues: [error.message] });
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESULTS: ${totalPassed} passed, ${totalFailed} failed out of ${totalPassed + totalFailed} tests`);
    console.log(`   Pass rate: ${((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(0)}%`);

    if (totalFailed > 0) {
        console.log('\n❌ Failed tests:');
        allResults.filter(r => !r.passed).forEach(r => {
            console.log(`   - ${r.question}`);
            (r.issues || []).forEach(i => console.log(`     ${i}`));
        });
    }

    console.log('');
}

main().catch(console.error);
