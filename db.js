// db.js - Complete Database & Search Logic
import { logError, fetchInitialQuestions, APP_CONFIG } from './core.js'; 

// --- Global Dexie Instance ---
export const db = new Dexie('UPSCProDB');

// --- Global FlexSearch Index Instance ---
let questionSearchIndex = null;

// --- Database Schema Definition ---
db.version(1).stores({
    questions: 'id, subject, topic, *keywords', 
    quizResults: '++id, timestamp, subject', 
    settings: 'key', 
    notes: '++id, timestamp, source', 
});

// --- 1. Search Indexing Logic (Was Missing) ---
function setupFlexSearchIndex() {
    questionSearchIndex = new FlexSearch.Document({
        document: {
            id: "id",
            index: ["question_text", "explanation.summary", "keywords"],
            store: ["id", "subject", "topic", "question_text", "statements", "options", "explanation", "keywords", "type"]
        },
        tokenize: "forward"
    });
}

export async function populateSearchIndex() {
    if (!questionSearchIndex) setupFlexSearchIndex();

    try {
        const allQuestions = await db.questions.toArray(); 
        allQuestions.forEach(q => {
            questionSearchIndex.add({
                id: q.id,
                question_text: q.question_text || '',
                'explanation.summary': q.explanation?.summary || '',
                keywords: q.keywords || []
            });
        });
        console.log(`[DB] Indexed ${allQuestions.length} questions for search.`);
    } catch (error) {
        logError('SEARCH_INDEX_POPULATE_FAIL', error);
    }
}

export async function fullTextSearchQuestions(query) {
    if (!questionSearchIndex) await populateSearchIndex();
    
    // Search and flatten results
    const results = questionSearchIndex.search(query, { limit: 10, enrich: true });
    let flatResults = [];
    if (results.length > 0) {
        const uniqueDocs = new Map();
        results.forEach(fieldGroup => {
            fieldGroup.result.forEach(doc => uniqueDocs.set(doc.id, doc.doc));
        });
        flatResults = Array.from(uniqueDocs.values());
    }
    return flatResults;
}

// --- 2. Data Access Functions (Were Missing) ---

export async function addQuestions(questions) {
    // Determine the next ID if not provided (simple logic)
    // Ideally, your JSON should have unique IDs. 
    return await db.questions.bulkPut(questions);
}

export async function getQuestionsForQuiz(subject, topic) {
    let collection = db.questions.where({ subject: subject });
    if (topic) collection = collection.filter(q => q.topic === topic);
    return await collection.toArray();
}

export async function saveQuizResult(result) {
    return await db.quizResults.add(result);
}

// --- 3. Settings Logic (CRITICAL: ai.js needs this) ---

export async function getSetting(key) {
    try {
        const record = await db.settings.get(key);
        return record ? record.value : null;
    } catch (error) { return null; }
}

export async function setSetting(key, value) {
    return await db.settings.put({ key, value });
}

// --- 4. Initialization & Bootstrap ---

async function initializeDatabase() {
    try {
        const count = await db.questions.count();
        if (count === 0) {
            console.log("[DB] Database empty. Bootstrapping initial data...");
            const questions = await fetchInitialQuestions(); // Fetches from core.js logic
            if (questions && questions.length > 0) {
                await db.questions.bulkPut(questions);
                console.log(`[DB] Bootstrapped ${questions.length} questions.`);
            }
        }
    } catch (error) {
        logError('DB_BOOTSTRAP_FAIL', error);
    }
}

// Open DB
db.open().catch(error => logError('DB_INIT_CRITICAL', error));

// Main Startup Sequence
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Ensure Data Exists
    await initializeDatabase();

    // 2. Build Search Index
    await populateSearchIndex();

    // 3. Remove Loading Overlay
    const overlay = document.getElementById('initial-loading-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => { overlay.style.pointerEvents = 'none'; }, 500); 
    }
});

