// page-selection.js - Logic for Quiz Selection (Debug Version)

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, logError, APP_CONFIG } from './core.js';
import { initializeGenerativeModel, generateRemixQuiz, saveApiKey } from './ai.js';
import { getSetting, addQuestions } from './db.js'; 
import { hideModal } from './ui-common.js'; 

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

if (selectionContent) {
    selectionContent.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'start-static-quiz') {
            handleQuizStart(e.target.dataset.subject, e.target.dataset.topic);
        }
    });
}

// --- 2. AI Remix Quiz ---
if (remixQuizBtn) {
    remixQuizBtn.addEventListener('click', async () => {
        const topic = remixTopicInput.value.trim();
        const count = parseInt(remixCountInput.value);

        if (!topic) { alert("Enter a topic."); return; }

        remixQuizBtn.disabled = true;
        remixQuizBtn.textContent = "Connecting to AI...";
        
        try {
            const existingQuestions = await fetchInitialQuestions();
            const exampleSchema = existingQuestions.slice(0, 1); 

            const newQuestions = await generateRemixQuiz({ subject: "Remixed", topic: topic }, exampleSchema, count);
            
            await addQuestions(newQuestions); 
            
            alert(`Generated ${newQuestions.length} questions on ${topic}!`);
            handleQuizStart("Remixed", topic);

        } catch (error) {
            alert(`AI Error: ${error.message}`);
        } finally {
            remixQuizBtn.disabled = false;
            remixQuizBtn.textContent = 'Generate & Start Remix Quiz';
        }
    });
}


// --- 3. Settings Management (DEBUG MODE) ---
if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            settingsStatus.textContent = "Please enter a valid API key.";
            return;
        }

        saveSettingsBtn.disabled = true;
        settingsStatus.textContent = "Testing connection...";
        settingsStatus.className = "text-sm mb-3 text-blue-600";

        try {
            // Save Key
            const result = await saveApiKey(apiKey); 

            // Result is now an OBJECT: { success: true/false, error: "..." }
            if (result.success) {
                settingsStatus.textContent = `Success! Connected to ${result.model}`;
                settingsStatus.className = "text-sm mb-3 text-green-600 font-bold";
                
                setTimeout(() => {
                    hideModal();
                    saveSettingsBtn.disabled = false;
                    settingsStatus.textContent = ""; 
                }, 1500);
            } else {
                // SHOW THE REAL ERROR
                console.error(result.error);
                settingsStatus.textContent = `Failed: ${result.error}`;
                settingsStatus.className = "text-sm mb-3 text-red-600 font-bold break-words";
                saveSettingsBtn.disabled = false;
            }
        } catch (error) {
             settingsStatus.textContent = `Critical Error: ${error.message}`;
             settingsStatus.className = "text-sm mb-3 text-red-600 font-bold";
             saveSettingsBtn.disabled = false;
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const existingKey = await getSetting(APP_CONFIG.GEMINI_API_KEY_NAME);
    if (apiKeyInput && existingKey) {
        apiKeyInput.value = existingKey;
    }
});

