// ai.js - Client-Side AI Integration (Robust Debug Version)

// FIX: Use jsdelivr, it is often more reliable on mobile networks than esm.run
import { GoogleGenerativeAI } from "https://cdn.jsdelivr.net/npm/@google/generative-ai/+esm";
import { getSetting, setSetting } from './db.js'; 
import { logError, APP_CONFIG } from './core.js'; 

const MODEL_PRIORITY_LIST = [
    'gemini-1.5-flash', // Fastest & most likely to work on Free Tier
    'gemini-1.5-pro',
    'gemini-1.0-pro'
];

const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let genAI = null;
let activeModelName = null;

// --- Initialization ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) {
        return { success: false, error: "No API Key found in settings." };
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey);
        
        // Loop to find a working model
        let lastError = null;
        for (const modelName of MODEL_PRIORITY_LIST) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                await model.generateContent("Test"); 
                activeModelName = modelName;
                console.log(`[AI] Locked onto: ${activeModelName}`);
                return { success: true, model: activeModelName }; 
            } catch (e) {
                console.warn(`[AI] ${modelName} failed: ${e.message}`);
                lastError = e.message;
            }
        }
        
        // If loop finishes, nothing worked
        return { success: false, error: `All models failed. Last error: ${lastError}` };

    } catch (criticalError) {
        // This catches import errors or invalid key formats
        return { success: false, error: `Critical Init Error: ${criticalError.message}` };
    }
}

export async function saveApiKey(key) {
    await setSetting(GEMINI_API_KEY_DB_KEY, key);
    return await initializeGenerativeModel();
}

// --- Rest of the functions (Helpers) ---

function extractJson(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("No JSON found in response");
    }
}

export async function generateSocraticExplanation(question, userSelections, correctSelections) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) return "Error: AI not initialized.";

    const systemInstruction = "Explain why the user's choice is wrong. Be concise.";
    const userPrompt = `User: [${userSelections}]. Correct: [${correctSelections}]. Q: ${question.question_text}`;
    
    try {
        const model = genAI.getGenerativeModel({ model: activeModelName, systemInstruction });
        const result = await model.generateContent(userPrompt);
        return result.response.text();
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

export async function generateRemixQuiz(context, existingQuestions, count = 5) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not initialized.");

    const systemInstruction = `Generate ${count} questions in strict JSON.`;
    const userPrompt = `Subject: ${context.subject}. Schema: ${JSON.stringify(existingQuestions[0])}`;
    
    try {
        const model = genAI.getGenerativeModel({ model: activeModelName, systemInstruction });
        const result = await model.generateContent(userPrompt);
        return extractJson(result.response.text());
    } catch (error) {
        throw new Error(error.message);
    }
}

export async function generateNotesFromDiagram(base64Image, mimeType, promptText) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not initialized.");

    try {
        // Vision requires 1.5 models
        const visionModel = activeModelName.includes('1.5') ? activeModelName : 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: visionModel });
        const result = await model.generateContent([promptText, { inlineData: { data: base64Image, mimeType } }]);
        return result.response.text();
    } catch (error) {
        throw new Error(error.message);
    }
}

export async function gradeMainsAnswer(question, userAnswer, modelAnswerKey, maxMarks = 10) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not initialized.");
    
    const systemInstruction = "Grade this answer. Return JSON: {score: number, feedback: string}.";
    const userPrompt = `Q: ${question} Answer: ${userAnswer}`;
    
    try {
        const model = genAI.getGenerativeModel({ model: activeModelName, systemInstruction });
        const result = await model.generateContent(userPrompt);
        return extractJson(result.response.text());
    } catch (error) {
        throw new Error(error.message);
    }
}

document.addEventListener('DOMContentLoaded', initializeGenerativeModel);

