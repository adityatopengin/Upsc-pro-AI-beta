// db.js - IndexedDB (Dexie.js) Setup and Local Search Indexing (FlexSearch)

import { logError } from './core.js'; 

// --- Global Dexie Instance ---
const db = new Dexie('UPSCProDB');

// --- Global FlexSearch Index Instance ---
let questionSearchIndex = null;

// --- Database Schema Definition ---
db.version(1).stores({
    questions: 'id, subject, topic, *keywords', 
    quizResults: '++id, timestamp, subject', 
    settings: 'key', 
    notes: '++id, timestamp, source', 
});

// ... (existing setupFlexSearchIndex function) ...

/**
 * Populates the search index from IndexedDB data on startup.
 */
export async function populateSearchIndex() {
    if (!questionSearchIndex) setupFlexSearchIndex();

    try {
        const allQuestions = await db.questions.toArray(); 
        
        allQuestions.forEach(q => {
            const doc = {
                id: q.id,
                question_text: q.question_text || '',
                'explanation.summary': q.explanation?.summary || '',
                keywords: q.keywords || []
            };
            questionSearchIndex.add(doc);
        });

    } catch (error) {
        logError('SEARCH_INDEX_POPULATE_FAIL', error, { action: 'Initial indexing' });
    }
}

// ... (existing addQuestions, getQuestionsForQuiz, saveQuizResult, setSetting, getSetting, fullTextSearchQuestions functions) ...

// --- Critical Database Initialization ---
db.open().catch(error => {
    logError('DB_INIT_CRITICAL', error, { action: 'Database open failed' });
});

// --- Final Initialization and Loading Screen Control ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Run the critical indexing task
    populateSearchIndex().then(() => {
        // 2. Hide the loading overlay after the database is indexed
        const overlay = document.getElementById('initial-loading-overlay');
        if (overlay) {
            overlay.classList.add('opacity-0');
            // Give time for transition, then set pointer-events: none
            setTimeout(() => {
                overlay.style.pointerEvents = 'none';
            }, 500); 
        }
    }).catch(error => {
        // Handle indexing error gracefully
        logError('APP_LOAD_FAIL', error, { step: 'Indexing' });
    });
}); 

// Export the main db object
export { db };

