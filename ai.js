// ai.js - Client-Side AI Integration with Adaptive Model Selection

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { getSetting, setSetting } from './db.js'; 
import { logError, APP_CONFIG } from './core.js'; 

// --- Configuration: The Fallback Chain ---
// The app will try these in order. It picks the first one that works.
const MODEL_PRIORITY_LIST = [
    'gemini-1.5-pro',   // Best quality (Good for Grading)
    'gemini-1.5-flash', // Best speed/efficiency (Good for Quizzes)
    'gemini-1.0-pro',   // Legacy fallback
    'gemini-pro'        // Oldest fallback
];

const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let genAI = null;
let activeModelName = null; // Stores the name of the "winning" model

// --- 1. Initialization & Adaptive Selection ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) {
        console.log("[AI] No API Key found.");
        return false;
    }

    try {
        genAI = new GoogleGenerativeAI(apiKey);
        
        console.log("[AI] Negotiating best available model...");
        
        // Loop through the list to find the best working model
        for (const modelName of MODEL_PRIORITY_LIST) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                // Send a tiny "Ping" to verify access
                await model.generateContent("Test"); 
                
                // If we get here, it worked!
                activeModelName = modelName;
                console.log(`[AI] Success! Locked onto model: ${activeModelName}`);
                return true; 
            } catch (e) {
                // --- ADD THIS LINE BELOW ---
                alert(`Debug: Model ${modelName} failed. Reason: ${e.message}`); 
                console.warn(`[AI] Model ${modelName} failed or not available. Trying next...`);
                // Continue to next model in list
            }
        }

        // If loop finishes without returning, nothing worked
        throw new Error("All known Gemini models failed. Check API Key quotas.");

    } catch (error) {
        logError('AI_INIT_CRITICAL', error);
        activeModelName = null;
        return false;
    }
}

export async function saveApiKey(key) {
    await setSetting(GEMINI_API_KEY_DB_KEY, key);
    return await initializeGenerativeModel();
}

/**
 * Helper: Extract JSON robustly
 */
function extractJson(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
        throw new Error("No JSON found in response");
    }
}


/**
 * 2. Socratic Explainer
 */
export async function generateSocraticExplanation(question, userSelections, correctSelections) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) return "Error: AI not initialized.";

    const systemInstruction = "You are a UPSC expert. Explain why the user's choice is wrong and the correct choice is right. Be concise.";
    const userPrompt = `
        User selected: [${userSelections.join(', ')}]. Correct: [${correctSelections.join(', ')}].
        Question: ${question.statements ? question.statements.map(s => `${s.id}: ${s.text}`).join('\n') : question.question_text}
    `;
    
    try {
        // USE THE ACTIVE MODEL
        const model = genAI.getGenerativeModel({ model: activeModelName, systemInstruction });
        const result = await model.generateContent(userPrompt);
        return result.response.text();
    } catch (error) {
        logError('AI_EXPLAINER_FAIL', error);
        return "Explanation failed. Check network.";
    }
}


/**
 * 3. Remix Quiz Generator
 */
export async function generateRemixQuiz(context, existingQuestions, count = 5) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not initialized.");

    const systemInstruction = `Generate exactly ${count} NEW unique questions in STRICT JSON format. No markdown, no talking.`;
    const userPrompt = `
        Subject: ${context.subject}, Topic: ${context.topic}.
        Schema Example: ${JSON.stringify(existingQuestions[0])}
        OUTPUT: JSON Array of ${count} objects.
    `;
    
    try {
        const model = genAI.getGenerativeModel({ model: activeModelName, systemInstruction });
        const result = await model.generateContent(userPrompt);
        return extractJson(result.response.text());
    } catch (error) {
        logError('AI_REMIX_FAIL', error);
        throw new Error(`Generation failed: ${error.message}`);
    }
}


/**
 * 4. Vision Notes
 */
export async function generateNotesFromDiagram(base64Image, mimeType, promptText) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not initialized.");

    // Note: Vision requires 1.5-flash or 1.5-pro. 
    // If activeModel falls back to 'gemini-pro' (1.0), vision might fail.
    // We enforce Flash for vision if the active model is too old.
    const visionModelName = activeModelName.includes('1.5') ? activeModelName : 'gemini-1.5-flash';

    try {
        const model = genAI.getGenerativeModel({ model: visionModelName });
        const result = await model.generateContent([
            promptText, 
            { inlineData: { data: base64Image, mimeType: mimeType } }
        ]);
        return result.response.text();
    } catch (error) {
        logError('AI_VISION_FAIL', error);
        throw new Error("Image processing failed.");
    }
}


/**
 * 5. Mains Answer Grader
 */
export async function gradeMainsAnswer(question, userAnswer, modelAnswerKey, maxMarks = 10) {
    if (!activeModelName) await initializeGenerativeModel();
    if (!activeModelName) throw new Error("AI not initialized.");
    
    const systemInstruction = `
        You are a strict UPSC examiner. Grade the answer out of ${maxMarks}.
        Output STRICT JSON only: {"score": number, "feedback": "markdown string"}
    `;
    const userPrompt = `
        Question: ${question}
        Model Key: ${modelAnswerKey}
        Student Answer: ${userAnswer}
    `;
    
    try {
        const model = genAI.getGenerativeModel({ 
            model: activeModelName, // Uses the best available model automatically
            systemInstruction: systemInstruction 
        });

        console.log(`[AI] Grading using ${activeModelName}...`);
        const result = await model.generateContent(userPrompt);
        return extractJson(result.response.text());

    } catch (error) {
        console.error("[AI Grader Error]", error);
        logError('AI_GRADER_FAIL', error);
        throw new Error(`Grading failed. Details: ${error.message}`);
    }
}

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', initializeGenerativeModel);

