// page-selection.js - Logic for Quiz Selection & Settings
// (Architecture: Direct Execution + Lazy Loading)

import { startNewQuiz } from './page-quiz.js';
import { fetchInitialQuestions, APP_CONFIG } from './core.js';
import { getSetting, addQuestions } from './db.js'; 
import { hideModal } from './ui-common.js'; 

// --- Core Logic Function ---
function initPageLogic() {
    console.log("[Page Logic] Initializing...");

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
            console.log("[Page Logic] Existing key pre-filled");
        }
    });

    // --- 2. Quiz Selection (Static) ---
    if (selectionContent) {
        selectionContent.addEventListener('click', (e) => {
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

    // --- 3. AI Remix Quiz (Lazy Load) ---
    if (remixQuizBtn) {
        remixQuizBtn.addEventListener('click', async () => {
            const topic = remixTopicInput.value.trim();
            const count = parseInt(remixCountInput.value);

            if (!topic) { alert("Please enter a topic."); return; }

            remixQuizBtn.disabled = true;
            remixQuizBtn.textContent = "Loading AI Module...";
            
            try {
                // Dynamic Import
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
                alert(`AI Failed: ${error.message}`);
            } finally {
                remixQuizBtn.disabled = false;
                remixQuizBtn.textContent = 'Generate & Start Remix Quiz';
            }
        });
    }

    // --- 4. Settings & AI Connection (The Critical Fix) ---
    if (saveSettingsBtn) {
        console.log("[Page Logic] Settings Button Found - Attaching Listener");
        
        saveSettingsBtn.addEventListener('click', async () => {
            console.log("[UI] Settings Button Clicked");
            const apiKey = apiKeyInput.value.trim();
            
            if (!apiKey) {
                settingsStatus.textContent = "Please enter an API key.";
                return;
            }

            // UI Feedback
            saveSettingsBtn.disabled = true;
            saveSettingsBtn.textContent = "Loading AI...";
            settingsStatus.textContent = "Initializing System...";
            settingsStatus.className = "text-xs mb-3 text-blue-400";

            try {
                // DYNAMIC IMPORT: Loads ai.js only on click
                const aiModule = await import('./ai.js');
                
                saveSettingsBtn.textContent = "Verifying...";
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
                 settingsStatus.textContent = `Error: Could not load AI library. Check Internet.`;
                 console.error("Import failed:", error);
                 saveSettingsBtn.disabled = false;
                 saveSettingsBtn.textContent = "Connect AI";
            }
        });
    } else {
        console.warn("[Page Logic] Save Settings Button NOT found in DOM");
    }
}

// --- BOOTSTRAP (The "Race Condition" Fix) ---
// If the DOM is already ready, run NOW. If not, wait.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPageLogic);
} else {
    initPageLogic(); // Run immediately
}

