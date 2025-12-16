// core.js - Central utility functions, configuration, and error handling

// --- Global Constants ---
export const APP_CONFIG = {
    DEFAULT_DATA_SOURCE: './data/initial_questions.json', // Explicit path
    GEMINI_API_KEY_NAME: 'gemini-api-key', 
};

// --- Tailwind Theme Safety Map (Ensures dynamic classes aren't purged) ---
export const THEME_CLASS_MAP = {
    'bg-primary': 'bg-indigo-600',
    'bg-secondary': 'bg-orange-500',
    'bg-rainbow-100': 'bg-red-100 dark:bg-red-900/30',
    'bg-rainbow-200': 'bg-yellow-100 dark:bg-yellow-900/30',
    'bg-rainbow-300': 'bg-green-100 dark:bg-green-900/30',
    'bg-rainbow-400': 'bg-blue-100 dark:bg-blue-900/30',
    'bg-rainbow-500': 'bg-pink-100 dark:bg-pink-900/30',
    'text-primary': 'text-indigo-600 dark:text-indigo-400',
    'text-secondary': 'text-orange-600 dark:text-orange-400',
    'border-soft': 'border-gray-200 dark:border-gray-700 rounded-xl',
};

export function getSafeThemeClasses(key) {
    return THEME_CLASS_MAP[key] || '';
}

// --- 1. Score Calculation Logic (Robust for Arrays) ---
export function calculateScore(question, userSelections) {
    let score = 0;
    let isCorrect = false;
    let mistakes = [];

    // Ensure we are working with arrays
    const userSet = new Set(userSelections || []);
    
    // Identify correct option IDs from the question object
    const correctOptions = question.options
        .filter(opt => opt.is_correct === true)
        .map(opt => opt.id);
    const correctSet = new Set(correctOptions);

    // Exact Match Logic: Must select ALL correct options and NO incorrect ones
    const isExactMatch = (userSet.size === correctSet.size) && 
                         [...userSet].every(id => correctSet.has(id));

    if (isExactMatch) {
        score = 1; // Full mark
        isCorrect = true;
    } else {
        // Log mistakes for the AI Explainer to analyze later
        const missedCorrect = correctOptions.filter(id => !userSet.has(id));
        const chosenIncorrect = userSelections.filter(id => !correctSet.has(id));
        mistakes = [...new Set([...missedCorrect, ...chosenIncorrect])];
    }

    return { score, isCorrect, mistakes };
}


// --- 2. Quiz Result Aggregation ---
export function aggregateQuizResults(quizRunResults) {
    let totalScore = 0;
    const totalQuestions = quizRunResults.length;
    const mistakesLog = [];

    quizRunResults.forEach(result => {
        if (result.isCorrect) {
            totalScore += result.score;
        } else {
            // Save detailed context for the "Review" mode
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

// --- 3. Centralized Error Logging ---
export function logError(tag, error, details = {}) {
    const errorTime = new Date().toISOString();
    
    const errorRecord = {
        time: errorTime,
        tag: tag,
        message: error.message || String(error),
        details: details,
    };

    // In a real app, you might sync this to a server. 
    // For now, we log to console with a distinctive prefix.
    console.error(`[❌ UPSC Pro Error - ${tag}]`, errorRecord);
}


// --- 4. Data Fetching Utility ---
export async function fetchInitialQuestions(source = APP_CONFIG.DEFAULT_DATA_SOURCE) {
    try {
        console.log(`[Core] Fetching initial data from: ${source}`);
        const response = await fetch(source);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            throw new Error("Data format error: Root element must be an array of questions.");
        }

        return data;
    } catch (error) {
        logError('INITIAL_DATA_FETCH_FAIL', error, { source });
        return []; // Return empty array to prevent crashing the DB loader
    }
}

