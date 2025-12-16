// ai.js - Client-Side AI Integration for UPSC Pro PWA (Fixed)

import { getSetting, setSetting } from './db.js'; // FIX: Import from DB layer
import { logError, APP_CONFIG } from './core.js'; 

// --- Configuration ---
// FIX: Switched to stable 1.5 models (2.5 is not yet public via standard API)
const GEMINI_MODEL_FLASH = 'gemini-1.5-flash';
const GEMINI_MODEL_PRO = 'gemini-1.5-pro';
const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let generativeModel = null;

// --- 1. Initialization and API Key Management ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) {
        console.log("[AI] No API Key found. AI features disabled.");
        return false;
    }

    try {
        // Initialize the GenerativeModel instance
        // Note: 'google' global is loaded via the script tag in index.html
        generativeModel = new google.generativeai.GenerativeModel({
            apiKey: apiKey,
            model: GEMINI_MODEL_FLASH, 
        });
        console.log("[AI] GenerativeModel initialized successfully.");
        return true;
    } catch (error) {
        logError('AI_INIT_CRITICAL', error);
        generativeModel = null;
        return false;
    }
}

export async function saveApiKey(key) {
    await setSetting(GEMINI_API_KEY_DB_KEY, key);
    await initializeGenerativeModel();
}


/**
 * 2. Socratic Explainer Feature
 */
export async function generateSocraticExplanation(question, userSelections, correctSelections) {
    if (!generativeModel) {
        // Try re-initializing in case it was missed
        const success = await initializeGenerativeModel();
        if (!success) return "Error: AI Model not initialized. Please set your API Key in Settings.";
    }

    const systemInstruction = "You are a highly knowledgeable UPSC expert and a patient Socratic tutor. Focus 70% of your response on addressing the specific error or logic gap implied by the user's incorrect choice. Use a step-by-step approach. Be precise and concise.";
    
    const userPrompt = `
        The user selected: [${userSelections.join(', ')}]. The correct options are: [${correctSelections.join(', ')}].
        Question Statements: ${question.statements ? question.statements.map(s => `${s.id}: ${s.text}`).join('\n') : question.question_text}
        Generate a detailed explanation. First, address why the user's selection is incorrect. Second, explain why the correct option(s) must be chosen. Use Markdown formatting.
    `;
    
    try {
        const response = await generativeModel.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: { systemInstruction: systemInstruction, temperature: 0.2 },
        });
        return response.response.text();

    } catch (error) {
        logError('AI_EXPLAINER_GENERATE_FAIL', error, { questionId: question.id });
        return "Error generating explanation. Check your API key or network connection.";
    }
}


/**
 * 3. Dynamic Remix Quiz Feature
 */
export async function generateRemixQuiz(context, existingQuestions, count = 5) {
    if (!generativeModel) await initializeGenerativeModel();
    if (!generativeModel) throw new Error("AI Model not initialized. Set your API key.");

    const systemInstruction = `
        You are an expert content generation engine for UPSC-style quizzes. Your SOLE task is to generate exactly ${count} NEW and UNIQUE question objects.
        You MUST STRICTLY adhere to the JSON format provided in the examples. DO NOT include any text outside the JSON array.
    `;
    const examplesString = JSON.stringify(existingQuestions, null, 2);

    const userPrompt = `
        Generate ${count} new quiz question objects for Subject: ${context.subject}, Topic: ${context.topic}.
        The output MUST be a single, parsable JSON array: [ ... , ... ]
        --- EXAMPLES (STRICT SCHEMA TO FOLLOW) ---\n${examplesString}
        --- GENERATE ${count} NEW QUESTION OBJECTS NOW ---
    `;
    
    try {
        const response = await generativeModel.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: { systemInstruction: systemInstruction, temperature: 0.7 },
        });

        // Clean the response (remove Markdown code blocks if AI adds them)
        let jsonText = response.response.text().trim();
        jsonText = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();

        const newQuestions = JSON.parse(jsonText);

        if (Array.isArray(newQuestions) && newQuestions.length === count) {
            return newQuestions;
        } else {
            // Fallback: If AI generated fewer questions, just return what it made
            if (Array.isArray(newQuestions)) return newQuestions;
            throw new Error(`AI returned invalid structure.`);
        }

    } catch (error) {
        logError('AI_REMIX_GENERATE_FAIL', error, { context });
        throw new Error(`Failed to generate new quiz. Details: ${error.message}`);
    }
}


/**
 * 4. Diagram to Notes Feature (Multimodal Vision)
 */
export async function generateNotesFromDiagram(base64Image, mimeType, promptText) {
    if (!generativeModel) await initializeGenerativeModel();
    if (!generativeModel) throw new Error("AI Model not initialized.");

    const imagePart = { inlineData: { data: base64Image, mimeType: mimeType } };
    const systemInstruction = "You are a specialized note-taking assistant. Analyze the provided diagram or chart and convert its key information into a concise, revision-ready bulleted list. Use clear Markdown structure.";
    
    try {
        const response = await generativeModel.generateContent({
            contents: [{ role: "user", parts: [imagePart, { text: `Analyze the image and generate notes. User focus: "${promptText}".` }] }], 
            config: { systemInstruction: systemInstruction, model: GEMINI_MODEL_FLASH, temperature: 0.2 },
        });
        return response.response.text();

    } catch (error) {
        logError('AI_VISION_GENERATE_FAIL', error);
        throw new Error(`Failed to process image. Details: ${error.message}`);
    }
}


/**
 * 5. Mains Answer Grader Feature (Complex Reasoning)
 */
export async function gradeMainsAnswer(question, userAnswer, modelAnswerKey, maxMarks = 10) {
    if (!generativeModel) await initializeGenerativeModel();
    if (!generativeModel) throw new Error("AI Model not initialized.");
    
    // Switch to PRO model for better reasoning if available, otherwise Flash is fine
    const proModel = generativeModel.getGenerativeModel ? generativeModel.getGenerativeModel({ model: GEMINI_MODEL_PRO }) : generativeModel;

    const systemInstruction = `
        You are a highly experienced and strict UPSC examiner. Your grading MUST reflect the standard of the Civil Services Examination.
        Key Grading Rules: 
        1. Strict Scaling: A score of 7 out of 10 is exceptionally brilliant. Average is 4.5-5.5.
        2. Objectivity: Grade ONLY based on content, structure, relevance to the question.
        3. Feedback: Must be constructive, detailed, and written in Markdown.
        Return ONLY valid JSON: {"score": [NUMBER], "feedback": "[MARKDOWN STRING]"}
    `;
    
    const userPrompt = `
        Question: ${question}, Max Marks: ${maxMarks}. 
        MODEL ANSWER KEY: ${modelAnswerKey}. 
        USER'S ANSWER: ${userAnswer}.
        TASK: Assign a score and feedback. Return JSON.
    `;
    
    try {
        const response = await proModel.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: { systemInstruction: systemInstruction, temperature: 0.1 },
        });

        let jsonText = response.response.text().trim();
        jsonText = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();

        const result = JSON.parse(jsonText);
        return result;

    } catch (error) {
        logError('AI_GRADER_FAIL', error);
        throw new Error(`Grading failed. Ensure input is correct and check API.`);
    }
}


// Auto-initialize on load
document.addEventListener('DOMContentLoaded', initializeGenerativeModel);

