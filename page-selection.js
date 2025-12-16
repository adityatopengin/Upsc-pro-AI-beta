// page-selection.js - Full Functionality with Robust Event Handling

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, APP_CONFIG } from './core.js';
import { getSetting, addQuestions } from './db.js'; 
import { hideModal } from './ui-common.js'; 

// 1. Pre-fill API Key (Quietly)
(async function init() {
    try {
        const existingKey = await getSetting(APP_CONFIG.GEMINI_API_KEY_NAME);
        const input = document.getElementById('api-key-input');
        if (input && existingKey) input.value = existingKey;
    } catch (e) {
        console.warn("Settings init error:", e);
    }
})();

// 2. GLOBAL EVENT LISTENER (The Fail-Safe)
document.addEventListener('click', async (e) => {
    
    // --- A. CONNECT AI BUTTON ---
    const settingsBtn = e.target.closest('#save-settings-btn');
    if (settingsBtn) {
        if (settingsBtn.disabled) return;

        const apiKeyInput = document.getElementById('api-key-input');
        const settingsStatus = document.getElementById('settings-status');
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            settingsStatus.textContent = "Please enter an API key.";
            return;
        }

        settingsBtn.disabled = true;
        settingsBtn.textContent = "Loading...";
        settingsStatus.textContent = "Initializing...";
        settingsStatus.className = "text-xs mb-3 text-blue-400";

        try {
            // Lazy Load AI to prevent startup crashes
            const aiModule = await import('./ai.js');
            
            settingsBtn.textContent = "Verifying...";
            const result = await aiModule.saveApiKey(apiKey); 

            if (result.success) {
                settingsStatus.textContent = `Connected! Model: ${result.model}`;
                settingsStatus.className = "text-xs mb-3 text-green-400 font-bold";
                setTimeout(() => {
                    hideModal();
                    settingsBtn.disabled = false;
                    settingsBtn.textContent = "Connect AI";
                    settingsStatus.textContent = ""; 
                }, 1500);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
             console.error(error);
             settingsStatus.textContent = "Error: " + error.message;
             settingsBtn.disabled = false;
             settingsBtn.textContent = "Retry Connection";
        }
        return; 
    }

    // --- B. AI REMIX BUTTON ---
    const remixBtn = e.target.closest('#remix-quiz-btn');
    if (remixBtn) {
        const topic = document.getElementById('remix-topic-input').value.trim();
        const count = parseInt(document.getElementById('remix-count-input').value);

        if (!topic) { alert("Enter a topic."); return; }

        remixBtn.disabled = true;
        remixBtn.textContent = "Generating...";

        try {
            const aiModule = await import('./ai.js');
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
            alert(`AI Failed: ${error.message}`);
        } finally {
            remixBtn.disabled = false;
            remixBtn.textContent = '✨ AI Generate';
        }
        return;
    }

    // --- C. STATIC QUIZ BUTTONS ---
    const staticBtn = e.target.closest('button[data-action="start-static-quiz"]');
    if (staticBtn) {
        hideModal();
        startNewQuiz(staticBtn.dataset.subject, staticBtn.dataset.topic);
    }
});

