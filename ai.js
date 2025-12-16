// ai.js - Client-Side AI Integration for UPSC Pro PWA (Complete AI Logic)

import { getSetting, setSetting, logError, APP_CONFIG } from './core.js'; 

// --- Configuration ---
const GEMINI_MODEL_FLASH = 'gemini-2.5-flash';
const GEMINI_MODEL_PRO = 'gemini-2.5-pro';
const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let generativeModel = null;

// --- 1. Initialization and API Key Management ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) return false;

    try {
        // Initialize the GenerativeModel instance (assuming global access)
        generativeModel = new google.generativeai.GenerativeModel({
            apiKey: apiKey,
            model: GEMINI_MODEL_FLASH, // Default to flash for general use
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
        logError('AI_EXPLAINER_INIT_FAIL', new Error('Model not initialized'), { questionId: question.id });
        return "Error: AI Model not initialized.";
    }

    const systemInstruction = "You are a highly knowledgeable UPSC expert and a patient Socratic tutor. Focus 70% of your response on addressing the specific error or logic gap implied by the user's incorrect choice. Use a step-by-step approach. Be precise and concise.";
    
    const userPrompt = `
        The user selected: [${userSelections.join(', ')}]. The correct options are: [${correctSelections.join(', ')}].
        Question Statements: ${question.statements.map(s => `${s.id}: ${s.text}`).join('\n')}
        Generate a detailed explanation. First, address why the user's selection is incorrect. Second, explain why the correct option(s) must be chosen. Use Markdown formatting.
    `;
    
    try {
        const response = await generativeModel.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: { systemInstruction: systemInstruction, temperature: 0.2 },
        });
        return response.text;

    } catch (error) {
        logError('AI_EXPLAINER_GENERATE_FAIL', error, { questionId: question.id, selections: userSelections });
        return "Error generating explanation. Check your API key or network.";
    }
}


/**
 * 3. Dynamic Remix Quiz Feature
 */
export async function generateRemixQuiz(context, existingQuestions, count = 5) {
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

        const jsonText = response.text.trim();
        const newQuestions = JSON.parse(jsonText);

        if (Array.isArray(newQuestions) && newQuestions.length === count) {
            return newQuestions;
        } else {
            const validationError = new Error(`AI returned ${newQuestions.length} items, expected ${count}.`);
            logError('AI_REMIX_VALIDATION_FAIL', validationError, { context, rawOutput: jsonText.substring(0, 200) });
            throw validationError;
        }

    } catch (error) {
        logError('AI_REMIX_GENERATE_FAIL', error, { context });
        throw new Error(`Failed to generate new quiz. Check API response structure. Details: ${error.message}`);
    }
}


/**
 * 4. Diagram to Notes Feature (Multimodal Vision)
 */
export async function generateNotesFromDiagram(base64Image, mimeType, promptText) {
    if (!generativeModel) throw new Error("AI Model not initialized.");

    const imagePart = { inlineData: { data: base64Image, mimeType: mimeType } };
    const systemInstruction = "You are a specialized note-taking assistant. Analyze the provided diagram or chart and convert its key information into a concise, revision-ready bulleted list. Use clear Markdown structure.";
    
    try {
        const response = await generativeModel.generateContent({
            contents: [{ role: "user", parts: [imagePart, { text: `Analyze the image and generate notes. User focus: "${promptText}".` }] }], 
            config: { systemInstruction: systemInstruction, model: GEMINI_MODEL_FLASH, temperature: 0.2 },
        });
        return response.text;

    } catch (error) {
        logError('AI_VISION_GENERATE_FAIL', error, { mimeType, promptLength: promptText.length });
        throw new Error(`Failed to process image and generate notes. Details: ${error.message}`);
    }
}


/**
 * 5. Mains Answer Grader Feature (Complex Reasoning)
 */
export async function gradeMainsAnswer(question, userAnswer, modelAnswerKey, maxMarks = 10) {
    if (!generativeModel) throw new Error("AI Model not initialized.");
    
    // --- CRITICAL: UPSC CALIBRATION ---
    const systemInstruction = `
        You are a highly experienced and strict UPSC examiner. Your grading MUST reflect the standard of the Civil Services Examination.
        Key Grading Rules: 1. Strict Scaling: A score of 7 out of 10 must be reserved for an exceptionally brilliant, near-perfect answer. The average score for a good, well-structured answer is typically 4.5 to 5.5. 2. Objectivity: Grade ONLY based on content, structure, relevance. 3. Feedback: Must be constructive and detailed, written in Markdown.
    `;
    
    const userPrompt = `
        Question: ${question}, Max Marks: ${maxMarks}. MODEL ANSWER KEY: ${modelAnswerKey}. USER'S ANSWER: ${userAnswer}.
        TASK: Assign a score (out of ${maxMarks}, remember 6.5-7 is near-perfect). Return ONLY the JSON: {"score": [NUMBER], "feedback": "[MARKDOWN STRING]"}
    `;
    
    try {
        const response = await generativeModel.generateContent({
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            config: { systemInstruction: systemInstruction, model: GEMINI_MODEL_PRO, temperature: 0.1 },
        });

        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        if (typeof result.score !== 'number' || typeof result.feedback !== 'string') {
            throw new Error("AI returned invalid JSON structure.");
        }
        return result;

    } catch (error) {
        logError('AI_GRADER_FAIL', error, { questionLength: question.length, maxMarks });
        throw new Error(`Grading failed. Ensure input is correct and check API/network.`);
    }
}


document.addEventListener('DOMContentLoaded', initializeGenerativeModel);

// Export all core functions
export { 
    initializeGenerativeModel, 
    saveApiKey, 
    generateSocraticExplanation, 
    generateRemixQuiz, 
    generateNotesFromDiagram, 
    gradeMainsAnswer 
};

