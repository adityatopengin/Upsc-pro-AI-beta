// page-selection.js - Logic for Quiz Selection & Settings
// (Robust "Lazy Load" Version - Fixes the Dead Button)

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, APP_CONFIG } from './core.js';
import { getSetting, addQuestions } from './db.js'; 
import { hideModal } from './ui-common.js'; 

// Note: We do NOT import ai.js here anymore. We load it dynamically.

document.addEventListener('DOMContentLoaded', () => {
    // Debug: If you see this in console, the file is alive!
    console.log("Page Selection Logic: Alive and Ready");

    // --- DOM Elements ---
    const selectionContent = document.getElementById('quiz-selection-content');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const remixTopicInput = document.getElementById('remix-topic-input');
    const remixCountInput = document.getElementById('remix-count-input');
    const remixQuizBtn = document.getElementById('remix-quiz-btn');
    const settingsStatus = document.getElementById('settings-status');

    // --- 1. Load Existing Key ---
    getSetting(APP_CONFIG.GEMINI_API_KEY_NAME).then(existingKey => {
        if (apiKeyInput && existingKey) {
            apiKeyInput.value = existingKey;
        }
    });

    // --- 2. Quiz Selection (Static) ---
    if (selectionContent) {
        selectionContent.addEventListener('click', (e) => {
            // Event Delegation: Check if clicked element is our button
            const btn = e.target.closest('button');
            if (!btn) return;

            if (btn.dataset.action === 'start-static-quiz') {
                const subject = btn.dataset.subject;
                const topic = btn.dataset.topic;
                
                if (subject && topic) {
                    hideModal();
                    startNewQuiz(subject, topic);
                }
            }
        });
    }

    // --- 3. AI Remix Quiz (Lazy Load AI) ---
    if (remixQuizBtn) {
        remixQuizBtn.addEventListener('click', async () => {
            const topic = remixTopicInput.value.trim();
            const count = parseInt(remixCountInput.value);

            if (!topic) { alert("Please enter a topic."); return; }

            remixQuizBtn.disabled = true;
            remixQuizBtn.textContent = "Loading AI Module...";
            
            try {
                // DYNAMIC IMPORT: Load AI only when needed
                const aiModule = await import('./ai.js');
                
                remixQuizBtn.textContent = "Generating...";
                const existingQuestions = await fetchInitialQuestions();
                const exampleSchema = existingQuestions.slice(0, 1); 

                const newQuestions = await aiModule.generateRemixQuiz(
                    { subject: "Remixed", topic: topic }, 
                    exampleSchema, 
                    count
                );
                
                await addQuestions(newQuestions); 
                hideModal();
                startNewQuiz("Remixed", topic);

            } catch (error) {
                console.error(error);
                alert(`AI Failed: ${error.message}. Check Internet.`);
            } finally {
                remixQuizBtn.disabled = false;
                remixQuizBtn.textContent = 'Generate & Start Remix Quiz';
            }
        });
    }

    // --- 4. Settings (Lazy Load AI) ---
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                settingsStatus.textContent = "Please enter an API key.";
                return;
            }

            // Visual Feedback
            saveSettingsBtn.disabled = true;
            saveSettingsBtn.textContent = "Loading AI Brain...";
            settingsStatus.textContent = "Initializing System...";
            settingsStatus.className = "text-xs mb-3 text-blue-400";

            try {
                // DYNAMIC IMPORT: This is the magic fix.
                // It tries to load ai.js NOW. If it fails, we catch the error here.
                const aiModule = await import('./ai.js');
                
                saveSettingsBtn.textContent = "Verifying Key...";
                const result = await aiModule.saveApiKey(apiKey); 

                if (result.success) {
                    settingsStatus.textContent = `Connected! Model: ${result.model}`;
                    settingsStatus.className = "text-xs mb-3 text-green-400 font-bold";
                    
                    setTimeout(() => {
                        hideModal();
                        saveSettingsBtn.disabled = false;
                        saveSettingsBtn.textContent = "Connect AI";
                        settingsStatus.textContent = ""; 
                    }, 1500);
                } else {
                    settingsStatus.textContent = `Failed: ${result.error}`;
                    settingsStatus.className = "text-xs mb-3 text-red-400 font-bold break-words";
                    saveSettingsBtn.disabled = false;
                    saveSettingsBtn.textContent = "Retry Connection";
                }
            } catch (error) {
                 // This catches if the file ./ai.js fails to load entirely (Network error)
                 settingsStatus.textContent = `System Error: Could not load AI module.`;
                 console.error("Import failed:", error);
                 alert("Error: Your internet might be blocking the Google AI library.\n" + error.message);
                 
                 saveSettingsBtn.disabled = false;
                 saveSettingsBtn.textContent = "Connect AI";
            }
        });
    }
});

