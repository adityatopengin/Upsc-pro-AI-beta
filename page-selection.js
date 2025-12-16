// page-selection.js - Debug Version with "Loud" Alerts

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, APP_CONFIG } from './core.js';
import { getSetting, addQuestions } from './db.js'; 
import { hideModal } from './ui-common.js'; 

// 1. PROOF OF LIFE: This runs immediately when the file loads.
// If you do NOT see this alert on reload, it means there is a syntax error in 'ai.js' or 'db.js'.
alert("DEBUG: page-selection.js has loaded successfully!"); 

// Initialize (Pre-fill Key)
(async function init() {
    try {
        const existingKey = await getSetting(APP_CONFIG.GEMINI_API_KEY_NAME);
        const input = document.getElementById('api-key-input');
        if (input && existingKey) {
            input.value = existingKey;
        }
    } catch (e) {
        console.warn("Could not load settings:", e);
    }
})();

// 2. GLOBAL LISTENER (Catches clicks anywhere on the screen)
document.addEventListener('click', async (e) => {
    
    // --- A. Handle "Connect AI" Button ---
    // We check if the thing you clicked is the Settings Button
    const settingsBtn = e.target.closest('#save-settings-btn');
    
    if (settingsBtn) {
        // Prevent double clicks
        if (settingsBtn.disabled) return;

        // DEBUG STEP 1: Confirm the button works
        alert("DEBUG STEP 1: Button Click Detected!");

        const apiKeyInput = document.getElementById('api-key-input');
        const settingsStatus = document.getElementById('settings-status');
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            alert("DEBUG: No API Key entered.");
            settingsStatus.textContent = "Please enter an API key.";
            return;
        }

        // UI Feedback
        settingsBtn.disabled = true;
        settingsBtn.textContent = "Loading...";
        settingsStatus.textContent = "Initializing System...";
        settingsStatus.className = "text-xs mb-3 text-blue-400";

        try {
            // DEBUG STEP 2: Trying to load the AI file
            alert("DEBUG STEP 2: Attempting to import ai.js...");
            
            // Dynamic Import
            const aiModule = await import('./ai.js');
            
            // DEBUG STEP 3: File imported, calling connection function
            alert("DEBUG STEP 3: ai.js loaded. Verifying key...");
            
            settingsBtn.textContent = "Verifying...";
            const result = await aiModule.saveApiKey(apiKey); 

            // DEBUG STEP 4: Got result from Google
            alert(`DEBUG STEP 4: Result received. Success: ${result.success}`);

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
                settingsStatus.textContent = `Failed: ${result.error}`;
                settingsStatus.className = "text-xs mb-3 text-red-400 font-bold break-words";
                settingsBtn.disabled = false;
                settingsBtn.textContent = "Retry Connection";
                alert("DEBUG ERROR: " + result.error);
            }
        } catch (error) {
             // Catch import errors (Internet/Syntax)
             console.error("Import failed:", error);
             settingsStatus.textContent = "Error loading AI module.";
             
             alert("DEBUG CRITICAL ERROR:\n" + error.message);
             
             settingsBtn.disabled = false;
             settingsBtn.textContent = "Connect AI";
        }
        return; 
    }

    // --- B. Handle "AI Remix" Button ---
    const remixBtn = e.target.closest('#remix-quiz-btn');
    if (remixBtn) {
        const topicInput = document.getElementById('remix-topic-input');
        const countInput = document.getElementById('remix-count-input');
        const topic = topicInput.value.trim();
        const count = parseInt(countInput.value);

        if (!topic) { alert("Please enter a topic."); return; }

        remixBtn.disabled = true;
        remixBtn.textContent = "Loading AI...";

        try {
            const aiModule = await import('./ai.js');
            remixBtn.textContent = "Generating...";
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
            remixBtn.textContent = 'Generate & Start Remix Quiz';
        }
        return;
    }

    // --- C. Handle "Static Quiz" Buttons ---
    const staticBtn = e.target.closest('button[data-action="start-static-quiz"]');
    if (staticBtn) {
        const subject = staticBtn.dataset.subject;
        const topic = staticBtn.dataset.topic;
        hideModal();
        startNewQuiz(subject, topic);
    }
});

