// page-selection.js - Logic for Quiz Selection, Settings, and AI Remix
// (Fixed: Waits for DOM to ensure buttons work)

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, logError, APP_CONFIG } from './core.js';
import { initializeGenerativeModel, generateRemixQuiz, saveApiKey } from './ai.js';
import { getSetting, addQuestions } from './db.js'; 
import { hideModal } from './ui-common.js'; 

// Wait for the HTML to be fully ready
document.addEventListener('DOMContentLoaded', () => {
    console.log("Page Selection Logic Loaded");

    // --- DOM Elements ---
    const selectionContent = document.getElementById('quiz-selection-content');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const remixTopicInput = document.getElementById('remix-topic-input');
    const remixCountInput = document.getElementById('remix-count-input');
    const remixQuizBtn = document.getElementById('remix-quiz-btn');
    const settingsStatus = document.getElementById('settings-status');

    // --- 1. Load Existing Key ---
    // Pre-fill the input if a key is already saved
    getSetting(APP_CONFIG.GEMINI_API_KEY_NAME).then(existingKey => {
        if (apiKeyInput && existingKey) {
            apiKeyInput.value = existingKey;
        }
    });

    // --- 2. Quiz Selection (Static) ---
    if (selectionContent) {
        selectionContent.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'start-static-quiz') {
                const subject = e.target.dataset.subject;
                const topic = e.target.dataset.topic;
                
                if (subject && topic) {
                    hideModal();
                    startNewQuiz(subject, topic);
                }
            }
        });
    }

    // --- 3. AI Remix Quiz (Generator) ---
    if (remixQuizBtn) {
        remixQuizBtn.addEventListener('click', async () => {
            const topic = remixTopicInput.value.trim();
            const count = parseInt(remixCountInput.value);

            if (!topic) { 
                alert("Please enter a topic."); 
                return; 
            }

            // UI Feedback
            remixQuizBtn.disabled = true;
            remixQuizBtn.textContent = "Connecting to AI...";
            
            try {
                // Get schema example
                const existingQuestions = await fetchInitialQuestions();
                const exampleSchema = existingQuestions.slice(0, 1); 

                // Generate
                const newQuestions = await generateRemixQuiz({ subject: "Remixed", topic: topic }, exampleSchema, count);
                
                // Save & Start
                await addQuestions(newQuestions); 
                
                alert(`Success! Generated ${newQuestions.length} questions on ${topic}.`);
                hideModal();
                startNewQuiz("Remixed", topic);

            } catch (error) {
                console.error(error);
                alert(`AI Error: ${error.message}`);
            } finally {
                remixQuizBtn.disabled = false;
                remixQuizBtn.textContent = 'Generate & Start Remix Quiz';
            }
        });
    }

    // --- 4. Settings (Save Key) ---
    if (saveSettingsBtn) {
        console.log("Settings Button Found & Attached"); // Debug check

        saveSettingsBtn.addEventListener('click', async () => {
            console.log("Settings Button Clicked"); // Debug check
            
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                settingsStatus.textContent = "Please enter an API key.";
                return;
            }

            // Immediate Visual Feedback
            saveSettingsBtn.disabled = true;
            saveSettingsBtn.textContent = "Verifying...";
            settingsStatus.textContent = "Testing connection...";
            settingsStatus.className = "text-sm mb-3 text-blue-600";

            try {
                // 1. Save Key
                const result = await saveApiKey(apiKey); 

                // 2. Handle Result
                if (result.success) {
                    settingsStatus.textContent = `Connected! Using model: ${result.model}`;
                    settingsStatus.className = "text-sm mb-3 text-green-600 font-bold";
                    
                    // Auto-close after 1.5s
                    setTimeout(() => {
                        hideModal();
                        saveSettingsBtn.disabled = false;
                        saveSettingsBtn.textContent = "Save & Verify Key";
                        settingsStatus.textContent = ""; 
                    }, 1500);
                } else {
                    // Show Error
                    console.error(result.error);
                    settingsStatus.textContent = `Failed: ${result.error}`;
                    settingsStatus.className = "text-sm mb-3 text-red-600 font-bold break-words";
                    saveSettingsBtn.disabled = false;
                    saveSettingsBtn.textContent = "Save & Verify Key";
                }
            } catch (error) {
                 settingsStatus.textContent = `Critical Error: ${error.message}`;
                 settingsStatus.className = "text-sm mb-3 text-red-600 font-bold";
                 saveSettingsBtn.disabled = false;
                 saveSettingsBtn.textContent = "Save & Verify Key";
            }
        });
    } else {
        console.error("Critical: Save Settings Button NOT found in HTML");
    }
});

