// ai.js - Client-Side AI Integration for UPSC Pro PWA (Fixed SDK)

// 1. IMPORT THE LIBRARY DIRECTLY (This fixes the connection error)
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { getSetting, setSetting } from './db.js'; 
import { logError, APP_CONFIG } from './core.js'; 

// --- Configuration ---
const GEMINI_MODEL_FLASH = 'gemini-1.5-flash';
const GEMINI_MODEL_PRO = 'gemini-1.5-pro';
const GEMINI_API_KEY_DB_KEY = APP_CONFIG.GEMINI_API_KEY_NAME;

let genAI = null; // The main client instance
let generativeModel = null; // The specific model instance

// --- 1. Initialization and API Key Management ---
export async function initializeGenerativeModel() {
    const apiKey = await getSetting(GEMINI_API_KEY_DB_KEY);
    
    if (!apiKey) {
        console.log("[AI] No API Key found. AI features disabled.");
        return false;
    }

    try {
        // Initialize the Client using the imported class
        genAI = new GoogleGenerativeAI(apiKey);
        
        // Get the model instance
        generativeModel = genAI.getGenerativeModel({ model: GEMINI_MODEL_FLASH });
        
        console.log("[AI] Gemini Model initialized successfully.");
        return true;
    } catch (error) {
        logError('AI_INIT_CRITICAL', error);
        generativeModel = null;
        return false;
    }
}

export async function saveApiKey(key) {
    await setSetting(GEMINI_API_KEY_DB_KEY, key);
    return await initializeGenerativeModel();
}


/**
 * 2. Socratic Explainer Feature
 */
export async function generateSocraticExplanation(question, userSelections, correctSelections) {
    if (!generativeModel) {
        const success = await initializeGenerativeModel();
        if (!success) return "Error: AI Model not initialized. Please check your API Key.";
    }

    const systemInstruction = "You are a highly knowledgeable UPSC expert and a patient Socratic tutor. Focus 70% of your response on addressing the specific error or logic gap implied by the user's incorrect choice. Use a step-by-step approach. Be precise and concise.";
    
    const userPrompt = `
        The user selected: [${userSelections.join(', ')}]. The correct options are: [${correctSelections.join(', ')}].
        Question Statements: ${question.statements ? question.statements.map(s => `${s.id}: ${s.text}`).join('\n') : question.question_text}
        Generate a detailed explanation. First, address why the user's selection is incorrect. Second, explain why the correct option(s) must be chosen. Use Markdown formatting.
    `;
    
    try {
        // Create a specific chat or content request
        // Note: We use the existing generativeModel instance
        const modelWithInstruction = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_FLASH,
            systemInstruction: systemInstruction 
        });

        const result = await modelWithInstruction.generateContent(userPrompt);
        return result.response.text();

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
    if (!generativeModel) throw new Error("AI Model not initialized.");

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
        const modelWithInstruction = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_FLASH,
            systemInstruction: systemInstruction 
        });

        const result = await modelWithInstruction.generateContent(userPrompt);
        
        // Clean the response
        let jsonText = result.response.text().trim();
        jsonText = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();

        const newQuestions = JSON.parse(jsonText);

        if (Array.isArray(newQuestions)) {
            return newQuestions;
        } else {
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
        const model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_FLASH,
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent([promptText, imagePart]);
        return result.response.text();

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
        // Use Pro model for grading if possible
        const proModel = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL_PRO,
            systemInstruction: systemInstruction 
        });

        const result = await proModel.generateContent(userPrompt);
        
        let jsonText = result.response.text().trim();
        jsonText = jsonText.replace(/^```json/, '').replace(/```$/, '').trim();

        return JSON.parse(jsonText);

    } catch (error) {
        logError('AI_GRADER_FAIL', error);
        throw new Error(`Grading failed. Ensure input is correct and check API.`);
    }
}


// Auto-initialize on load
document.addEventListener('DOMContentLoaded', initializeGenerativeModel);

