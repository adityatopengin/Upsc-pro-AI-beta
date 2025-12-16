// ai.js - Client-Side AI Integration (Dynamic Model Discovery)

import { GoogleGenerativeAI } from "https://cdn.jsdelivr.net/npm/@google/generative-ai/+esm";
import { getSetting, setSetting } from './db.js'; 
import { logError, APP_CONFIG } from './core.js'; 

const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let genAI = null;
let activeModelName = null;

// --- 1. Dynamic Model Discovery ---
// This mimics the Python `genai.list_models()` but for the Web
async function fetchBestAvailableModel(apiKey) {
    try {
        console.log("[AI] Asking Google for available models...");
        
        // Direct REST call to get the list (Works where SDK fails)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        
        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status}`);
        }

        const data = await response.json();
        const allModels = data.models || [];

        // Filter: Must support 'generateContent'
        const validModels = allModels.filter(m => 
            m.supportedGenerationMethods && 
            m.supportedGenerationMethods.includes("generateContent")
        );

        if (validModels.length === 0) throw new Error("No text generation models available for this key.");

        // Smart Ranking Logic:
        // 1. Prefer 'flash' (Speed is king for PWA)
        // 2. Prefer higher version numbers (2.0 > 1.5 > 1.0)
        // 3. Avoid 'vision' only models if possible (though most are multimodal now)
        
        const sortedModels = validModels.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();

            // Check version (simple heuristic)
            const verA = nameA.includes('1.5') ? 1.5 : (nameA.includes('2.0') ? 2.0 : 1.0);
            const verB = nameB.includes('1.5') ? 1.5 : (nameB.includes('2.0') ? 2.0 : 1.0);

            if (verA !== verB) return verB - verA; // Higher version first

            // If same version, prefer Flash
            const isFlashA = nameA.includes('flash');
            const isFlashB = nameB.includes('flash');
            if (isFlashA && !isFlashB) return -1;
            if (!isFlashA && isFlashB) return 1;

            return 0;
        });

        // The name comes like "models/gemini-1.5-flash". We need just "gemini-1.5-flash"
        const bestModel = sortedModels[0].name.replace('models/', '');
        
        console.log(`[AI] Discovery Complete. Best Model: ${bestModel}`);
        return bestModel;

    } catch (error) {
        console.warn("[AI] Model discovery failed. Falling back to safe default.", error);
        return 'gemini-1.5-flash'; // Fallback if list fails
    }
}


// --- 2. Initialization ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) {
        return { success: false, error: "No API Key found." };
    }

    try {
        // Step 1: Initialize SDK
        genAI = new GoogleGenerativeAI(apiKey);
        
        // Step 2: Dynamically find the best model for this specific Key
        activeModelName = await fetchBestAvailableModel(apiKey);
        
        // Step 3: Test it with a tiny ping
        const model = genAI.getGenerativeModel({ model: activeModelName });
        await model.generateContent("Test"); 
        
        console.log(`[AI] System Locked & Loaded on: ${activeModelName}`);
        return { success: true, model: activeModelName }; 

    } catch (error) {
        return { success: false, error: `Init Failed (${activeModelName || 'Unknown'}): ${error.message}` };
    }
}

export async function saveApiKey(key) {
    await setSetting(GEMINI_API_KEY_DB_KEY, key);
    return await initializeGenerativeModel();
}


// --- 3. Helpers ---
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


// --- 4. AI Features ---
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

