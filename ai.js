// ai.js - Client-Side AI Integration (Fixed for Dec 2025)

import { GoogleGenerativeAI } from "https://cdn.jsdelivr.net/npm/@google/generative-ai/+esm";
import { getSetting, setSetting } from './db.js'; 
import { logError, APP_CONFIG } from './core.js'; 

// --- CRITICAL UPDATE: MODEL LIST (Dec 2025) ---
const MODEL_PRIORITY_LIST = [
    // 1. BEST FOR FREE TIER (High Quota: ~1000/day)
    'gemini-2.5-flash-lite', 
    
    // 2. BACKUP (High Speed, but Low Free Quota: ~20/day)
    'gemini-2.5-flash',      

    // 3. LEGACY FALLBACKS (If 2.5 fails)
    'gemini-1.5-flash-002',   
    'gemini-1.5-pro-002'
];

const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let genAI = null;
let activeModelName = null;

// --- 1. Initialization ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) {
        return { success: false, error: "No API Key found." };
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey);
        
        let lastError = null;

        // Try models in order until one connects
        for (const modelName of MODEL_PRIORITY_LIST) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                // Tiny Ping to verify access
                await model.generateContent("Test"); 
                
                // If we get here, it worked!
                activeModelName = modelName;
                console.log(`[AI] Connected to: ${activeModelName}`);
                return { success: true, model: activeModelName }; 
                
            } catch (e) {
                console.warn(`[AI] ${modelName} failed. Reason: ${e.message}`);
                lastError = e.message;
            }
        }
        
        // If ALL failed
        return { success: false, error: `Connection failed. Check API Key or Quota. Last Error: ${lastError}` };

    } catch (criticalError) {
        return { success: false, error: `Init Error: ${criticalError.message}` };
    }
}

export async function saveApiKey(key) {
    await setSetting(GEMINI_API_KEY_DB_KEY, key);
    return await initializeGenerativeModel();
}

// --- 2. Helpers ---
function extractJson(text) {
    try {
        let cleanText = text.replace(/^```json/, '').replace(/```$/, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("AI response was not valid JSON.");
    }
}

// --- 3. AI Features ---

export async function generateSocraticExplanation(question, userSelections, correctSelections) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) return "Error: AI not active.";

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
    if (!activeModelName) throw new Error("AI not active.");

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
    if (!activeModelName) throw new Error("AI not active.");

    try {
        const model = genAI.getGenerativeModel({ model: activeModelName });
        const result = await model.generateContent([promptText, { inlineData: { data: base64Image, mimeType } }]);
        return result.response.text();
    } catch (error) {
        throw new Error(error.message);
    }
}

export async function gradeMainsAnswer(question, userAnswer, modelAnswerKey, maxMarks = 10) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not active.");
    
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

