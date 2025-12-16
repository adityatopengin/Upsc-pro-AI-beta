// page-selection.js - Logic for Quiz Selection, Settings Management, and AI Remix Quiz Generation

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, logError, APP_CONFIG } from './core.js';
import { initializeGenerativeModel, generateRemixQuiz, saveApiKey } from './ai.js';
import { getSetting, addQuestions } from './db.js'; 
import { hideModal } from './ui-common.js'; // Ensure hideModal is imported

// --- DOM Elements ---
const selectionContent = document.getElementById('quiz-selection-content');
const settingsContent = document.getElementById('settings-content');
const apiKeyInput = document.getElementById('api-key-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const remixTopicInput = document.getElementById('remix-topic-input');
const remixCountInput = document.getElementById('remix-count-input');
const remixQuizBtn = document.getElementById('remix-quiz-btn');
const settingsStatus = document.getElementById('settings-status');

// --- 1. Quiz Start Handler ---
function handleQuizStart(subject, topic) {
    if (!subject || !topic) {
        alert("Please select both a subject and a topic.");
        return;
    }
    hideModal(); 
    startNewQuiz(subject, topic);
}

// Handler for static buttons/dropdowns in the modal
if (selectionContent) {
    selectionContent.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'start-static-quiz') {
            const subject = e.target.dataset.subject || 'History';
            const topic = e.target.dataset.topic || 'IVC';
            handleQuizStart(subject, topic);
        }
    });
}


// --- 2. AI Remix Quiz Generation (Advanced Feature) ---
if (remixQuizBtn) {
    remixQuizBtn.addEventListener('click', async () => {
        const topic = remixTopicInput.value.trim();
        const count = parseInt(remixCountInput.value);

        if (!topic || count < 1 || count > 20) {
            alert("Please provide a valid topic and question count (1-20).");
            return;
        }

        remixQuizBtn.disabled = true;
        remixQuizBtn.textContent = `Generating ${count} questions... (API Call)`;
        
        try {
            // 1. Fetch existing question schema (for AI to copy the format)
            const existingQuestions = await fetchInitialQuestions();
            const exampleSchema = existingQuestions.slice(0, 1); // Get 1 example for schema

            // 2. Call the AI API
            const newQuestions = await generateRemixQuiz({ subject: "Remixed", topic: topic }, exampleSchema, count);
            
            // 3. Add to the database
            await addQuestions(newQuestions); 
            
            alert(`Successfully generated and added ${newQuestions.length} new questions on: ${topic}!`);
            
            // 4. Optionally, start the quiz immediately
            handleQuizStart("Remixed", topic);

        } catch (error) {
            logError('AI_REMIX_UI_FAIL', error, { topic, count });
            alert(`Failed to generate questions: ${error.message}`);
        } finally {
            remixQuizBtn.disabled = false;
            remixQuizBtn.textContent = 'Generate & Start Remix Quiz';
        }
    });
}


// --- 3. Settings Management (UPDATED Logic) ---
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            settingsStatus.textContent = "Please enter a valid API key.";
            return;
        }

        saveSettingsBtn.disabled = true;
        settingsStatus.textContent = "Verifying key...";
        settingsStatus.className = "text-sm h-auto min-h-[1.5rem] mb-3 text-blue-600";

        try {
            // Save and Try to Init
            await saveApiKey(apiKey); 
            const isInitialized = await initializeGenerativeModel();

            if (isInitialized) {
                settingsStatus.textContent = "Success! AI Active. Closing...";
                settingsStatus.className = "text-sm h-auto min-h-[1.5rem] mb-3 text-green-600 font-bold";
                
                // UX FIX: Auto-close after 1.5 seconds so user isn't stuck
                setTimeout(() => {
                    hideModal();
                    saveSettingsBtn.disabled = false;
                    settingsStatus.textContent = ""; // Clear status for next time
                }, 1500);
            } else {
                throw new Error("Key saved, but AI failed to respond.");
            }
        } catch (error) {
             logError('SETTINGS_SAVE_FAIL', error);
             settingsStatus.textContent = "Invalid Key or Network Error.";
             settingsStatus.className = "text-sm h-auto min-h-[1.5rem] mb-3 text-red-500 font-bold";
             saveSettingsBtn.disabled = false;
        }
    });
}

// Load existing key when settings modal is opened
document.addEventListener('DOMContentLoaded', async () => {
    const existingKey = await getSetting(APP_CONFIG.GEMINI_API_KEY_NAME);
    if (apiKeyInput && existingKey) {
        apiKeyInput.value = existingKey;
    }
});

