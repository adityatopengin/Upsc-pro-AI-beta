// page-selection.js - Logic for Quiz Selection, Settings Management, and AI Remix Quiz Generation

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, logError, APP_CONFIG } from './core.js';
import { initializeGenerativeModel, generateRemixQuiz, saveApiKey } from './ai.js';
import { getSetting, addQuestions } from './db.js'; // get/add questions are async db functions

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
    // Assumes showModal is globally available or imported in index.html script block
    hideModal(); 
    startNewQuiz(subject, topic);
}

// Placeholder for dynamically generated selection UI (would be built here)
if (selectionContent) {
    // Example: Add a simple handler for static buttons/dropdowns in the modal
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
            
            // 3. Add to the database (db.js handles indexing)
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


// --- 3. Settings Management (API Key BYOK) ---
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            settingsStatus.textContent = "Please enter a valid API key.";
            return;
        }

        saveSettingsBtn.disabled = true;
        settingsStatus.textContent = "Saving key and testing connection...";

        try {
            await saveApiKey(apiKey); // Saves to IndexedDB and tries to initialize model
            const isInitialized = await initializeGenerativeModel();

            if (isInitialized) {
                settingsStatus.textContent = "API Key saved and verified! AI features are now active.";
                settingsStatus.classList.remove('text-red-500');
                settingsStatus.classList.add('text-green-500');
            } else {
                settingsStatus.textContent = "Key saved, but connection failed. Check the key and network.";
                settingsStatus.classList.remove('text-green-500');
                settingsStatus.classList.add('text-red-500');
            }
        } catch (error) {
             logError('SETTINGS_SAVE_FAIL', error);
             settingsStatus.textContent = `Error: Failed to save key. ${error.message}`;
             settingsStatus.classList.add('text-red-500');
        } finally {
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

