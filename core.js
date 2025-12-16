// core.js - Central utility functions for scoring, data constants, and error logging

// --- Global Constants ---
export const APP_CONFIG = {
    DEFAULT_DATA_SOURCE: 'data/initial_questions.json', 
    GEMINI_API_KEY_NAME: 'geminiApiKey', 
};

// --- Tailwind Theme Safety Map (Phase 4 Fix) ---
export const THEME_CLASS_MAP = {
    'bg-primary': 'bg-indigo-600',
    'bg-secondary': 'bg-orange-500',
    'bg-rainbow-100': 'bg-red-100 dark:bg-red-800/50',
    'bg-rainbow-200': 'bg-yellow-100 dark:bg-yellow-800/50',
    'bg-rainbow-300': 'bg-green-100 dark:bg-green-800/50',
    'bg-rainbow-400': 'bg-blue-100 dark:bg-blue-800/50',
    'bg-rainbow-500': 'bg-pink-100 dark:bg-pink-800/50',
    'text-primary': 'text-indigo-600 dark:text-indigo-400',
    'text-secondary': 'text-orange-600 dark:text-orange-400',
    'border-soft': 'rounded-xl',
};

// --- 1. Score Calculation Logic (Updated for Statement-Based Questions) ---
export function calculateScore(question, userSelections) {
    let score = 0;
    let isCorrect = false;
    let mistakes = [];

    const correctOptions = question.options
        .filter(opt => opt.is_correct === true)
        .map(opt => opt.id);

    // Check for a perfect match (Fix: ensures array content is identical)
    const userSet = new Set(userSelections);
    const correctSet = new Set(correctOptions);

    if (userSet.size === correctSet.size && [...userSet].every(id => correctSet.has(id))) {
        score = 1;
        isCorrect = true;
    } else {
        // 3. Log Mistakes (For Socratic Explainer)
        const missedCorrect = correctOptions.filter(id => !userSet.has(id));
        const chosenIncorrect = userSelections.filter(id => !correctSet.has(id));
        mistakes = [...new Set([...missedCorrect, ...chosenIncorrect])];
    }

    return { score, isCorrect, mistakes };
}


// --- 2. Quiz Result Aggregation (Fixes Data Inconsistency Bug) ---
export function aggregateQuizResults(quizRunResults) {
    let totalScore = 0;
    const totalQuestions = quizRunResults.length;
    const mistakesLog = [];

    quizRunResults.forEach(result => {
        if (result.isCorrect) {
            totalScore += 1;
        } else {
            // CRITICAL FIX: Save userSelections and detailedMistakes for later analysis
            mistakesLog.push({
                questionId: result.questionId,
                userSelections: result.userSelections, 
                detailedMistakes: result.detailedMistakes || [], 
            });
        }
    });

    return {
        timestamp: new Date().toISOString(),
        subject: quizRunResults[0]?.subject || 'Mixed', 
        score: totalScore,
        totalQuestions: totalQuestions,
        mistakes: mistakesLog, 
    };
}

// --- 3. Error Reporting and Logging Utility (Phase 5: Centralized Error Handling) ---
export function logError(tag, error, details = {}) {
    const errorTime = new Date().toISOString();
    
    const errorRecord = {
        time: errorTime,
        tag: tag,
        message: error.message || String(error),
        stack: error.stack ? error.stack.substring(0, 500) : 'No stack trace', 
        details: details,
    };

    console.error(`[CRITICAL ERROR - ${tag}] ${error.message}`, errorRecord);

    // TODO: In production, send errorRecord to a remote logging service (Sentry, etc.)
}


// --- 4. General Utility Functions ---
export async function fetchInitialQuestions(source) {
    try {
        const response = await fetch(source || APP_CONFIG.DEFAULT_DATA_SOURCE);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        logError('INITIAL_DATA_FETCH_FAIL', error);
        return [];
    }
}

