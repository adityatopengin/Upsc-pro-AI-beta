// ai.js - Client-Side AI Integration (Reasoning & Thinking Enabled)

import { GoogleGenerativeAI } from "https://cdn.jsdelivr.net/npm/@google/generative-ai/+esm";
import { getSetting, setSetting } from './db.js'; 
import { APP_CONFIG } from './core.js'; 

// --- MODEL PRIORITY (Bleeding Edge) ---
const MODEL_PRIORITY_LIST = [
    // 1. The User's Requested "Gemini 3" (If available to your key)
    'gemini-3-pro-preview', 

    // 2. The Real "Reasoning" Model (Available Now)
    'gemini-2.5-flash-lite', 
    'gemini-2.0-flash-thinking-exp', 

    // 3. High Intelligence Standard
    'gemini-1.5-pro',       

    // 4. Fast Backup
    'gemini-2.0-flash-exp', 
    'gemini-1.5-flash'     
];

const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let genAI = null;
let activeModelName = null;
let isThinkingModel = false; // Flag to track if we are using a reasoning model

// --- 1. Initialization ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) return { success: false, error: "No API Key found." };

    try {
        // We use the standard Web SDK, which supports v1beta/thinking models
        genAI = new GoogleGenerativeAI(apiKey);
        
        let lastError = null;

        // Loop through models to find the smartest one available
        for (const modelName of MODEL_PRIORITY_LIST) {
            try {
                console.log(`[AI] Handshaking with: ${modelName}...`);
                
                const model = genAI.getGenerativeModel({ model: modelName });
                
                // Tiny Ping to verify access
                await model.generateContent("Test"); 
                
                // Success!
                activeModelName = modelName;
                
                // Check if it is a "Thinking" model (contains 'thinking' or user's requested '3-pro')
                isThinkingModel = modelName.includes('thinking') || modelName.includes('3-pro');

                console.log(`[AI] Connected! Model: ${activeModelName} | Reasoning Mode: ${isThinkingModel ? 'ON' : 'OFF'}`);
                return { success: true, model: activeModelName }; 
                
            } catch (e) {
                console.warn(`[AI] ${modelName} unavailable: ${e.message}`);
                lastError = e.message;
            }
        }
        return { success: false, error: `All models failed. Last Error: ${lastError}` };

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

// Feature A: Socratic Tutor (Aditya with Reasoning)
export async function generateSocraticExplanation(question, userSelections, correctSelections) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) return "Error: Aditya is offline. Check Settings.";

    // The "Aditya" Persona Prompt
    const systemInstruction = `
    You are Aditya, a dedicated UPSC mentor. You have a friendly, encouraging personality using modern Indian English (Hinglish).
    
    ### GOAL ###
    Diagnose the user's specific logical mistake.
    
    ### RULES ###
    1. Focus 90% on WHY the user was wrong.
    2. Use phrases like "full power," "ekdum clear," "bhai".
    3. End with an Urdu sher (Roman Urdu + English translation).
    `;

    const userOptionText = question.options.filter(o => userSelections.includes(o.id)).map(o => o.text).join(', ');
    const correctOptionText = question.options.filter(o => o.is_correct).map(o => o.text).join(', ');

    const userPrompt = `
    **Question:** ${question.question_text}
    **Correct Answer:** ${correctOptionText}
    **User's Answer:** ${userOptionText || "No answer selected"}
    **Expert Analysis:** ${question.explanation?.text || "None"}
    
    Explain this mistake to the student like Aditya.
    `;
    
    try {
        // DYNAMIC CONFIGURATION
        // If it's a thinking model, we don't pass systemInstruction via config (sometimes unsupported),
        // we append it to the prompt or use valid v1beta config.
        let modelParams = { model: activeModelName };
        
        if (!isThinkingModel) {
            // Standard models take systemInstruction cleanly
            modelParams.systemInstruction = systemInstruction;
        }

        const model = genAI.getGenerativeModel(modelParams);

        // If it is a thinking model, we inject the persona into the prompt 
        // because thinking models sometimes ignore system instructions in favor of reasoning.
        const finalPrompt = isThinkingModel 
            ? `${systemInstruction}\n\n${userPrompt}` 
            : userPrompt;

        const result = await model.generateContent(finalPrompt);
        return result.response.text();

    } catch (error) {
        return `Aditya says: "Connection issue, bhai! (${error.message})"`;
    }
}

// Feature B: Remix Quiz
export async function generateRemixQuiz(context, existingQuestions, count = 5) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not active.");

    const systemInstruction = `Generate ${count} questions in strict JSON format based on the user's topic.`;
    const userPrompt = `Subject: ${context.subject}. Topic: ${context.topic}. 
    Reference Schema: ${JSON.stringify(existingQuestions[0])}. 
    Return ONLY JSON.`;
    
    try {
        const model = genAI.getGenerativeModel({ model: activeModelName });
        
        // For Remix, we just want JSON, thinking isn't strictly necessary but helpful for quality.
        const finalPrompt = `${systemInstruction}\n\n${userPrompt}`;
        const result = await model.generateContent(finalPrompt);
        
        return extractJson(result.response.text());
    } catch (error) {
        throw new Error(error.message);
    }
}

// Feature C: Vision Notes
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

// Feature D: Mains Grader
export async function gradeMainsAnswer(question, userAnswer, modelAnswerKey, maxMarks = 10) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not active.");
    
    const userPrompt = `System: Grade this UPSC Mains answer accurately. Return JSON: {score: number, feedback: string}.
    Question: ${question} 
    Model Points: ${modelAnswerKey}
    Student Answer: ${userAnswer}`;
    
    try {
        const model = genAI.getGenerativeModel({ model: activeModelName });
        const result = await model.generateContent(userPrompt);
        return extractJson(result.response.text());
    } catch (error) {
        throw new Error(error.message);
    }
}

