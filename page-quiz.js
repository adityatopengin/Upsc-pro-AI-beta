// page-quiz.js - Quiz Engine & Interaction Logic (With Aditya AI Integration)

import { getQuestions } from './db.js';
import { calculateScore, aggregateQuizResults } from './core.js';
import { showModal, goHome } from './ui-common.js';
import { generateSocraticExplanation } from './ai.js'; 

let currentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = {}; // Map: { questionId: [selectedOptionIds] }
let quizContext = {};

// --- 1. Start Quiz ---
export async function startNewQuiz(subject, topic) {
    // UI Setup
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('quiz-container').classList.remove('hidden');
    
    // 1. SHOW ADITYA BUTTON (The Floating AI)
    const adityaBtn = document.getElementById('aditya-floating-btn');
    if (adityaBtn) adityaBtn.classList.remove('hidden');

    // 2. RESET ADITYA SHEET (Ensure it's closed)
    const adityaSheet = document.getElementById('aditya-sheet');
    if (adityaSheet) adityaSheet.classList.add('translate-y-full');

    // Reset State
    currentQuestionIndex = 0;
    userAnswers = {};
    quizContext = { subject, topic };
    
    // Show Loading
    const qDisplay = document.getElementById('question-display');
    qDisplay.innerHTML = `<p class="text-center animate-pulse">Loading ${subject} questions...</p>`;

    try {
        // Fetch from DB
        currentQuestions = await getQuestions(subject, topic);
        
        if (!currentQuestions || currentQuestions.length === 0) {
            alert("No questions found for this topic. Try generating some with AI first!");
            exitQuiz(); // Use clean exit
            return;
        }

        renderQuestion();
        updateNavigationButtons();

    } catch (error) {
        console.error("Quiz Load Error:", error);
        alert("Failed to load quiz.");
        exitQuiz();
    }
}

// --- 2. Clean Exit Logic ---
// We use this instead of direct goHome() to ensure the AI button disappears
export function exitQuiz() {
    // Hide Aditya Button
    const adityaBtn = document.getElementById('aditya-floating-btn');
    if (adityaBtn) adityaBtn.classList.add('hidden');
    
    // Close Sheet if open
    closeAditya();

    // Go Home
    goHome();
}

// --- 3. Render Question ---
function renderQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const qDisplay = document.getElementById('question-display');
    const optionsContainer = document.getElementById('options-container');

    // 1. Render Question Text & Header
    // Note: We changed onclick="goHome()" to onclick="exitQuiz()"
    qDisplay.innerHTML = `
        <div class="flex justify-between items-center mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
            <span class="text-sm font-bold text-gray-500">Q ${currentQuestionIndex + 1} of ${currentQuestions.length}</span>
            <button onclick="exitQuiz()" class="text-xs text-red-500 font-semibold hover:underline">Quit X</button>
        </div>
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2 leading-relaxed">
            ${question.question_text || "Consider the following statements:"}
        </h2>
        ${renderStatements(question)}
    `;

    // 2. Render Options
    optionsContainer.innerHTML = '';
    question.options.forEach(opt => {
        const isSelected = (userAnswers[question.id] || []).includes(opt.id);
        
        const btn = document.createElement('div');
        btn.className = `
            p-4 mb-3 rounded-xl border cursor-pointer transition select-none flex items-center
            ${isSelected ? 'bg-indigo-50 border-primary dark:bg-indigo-900/30 dark:border-indigo-500' : 'bg-white/5 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'}
        `;
        btn.innerHTML = `
            <div class="w-6 h-6 rounded-full border mr-4 flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-gray-400'}">
                ${isSelected ? '<div class="w-2.5 h-2.5 bg-white rounded-full"></div>' : ''}
            </div>
            <span class="text-sm ${isSelected ? 'font-semibold text-primary dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}">${opt.text}</span>
        `;
        
        btn.onclick = () => toggleSelection(question.id, opt.id);
        optionsContainer.appendChild(btn);
    });
}

function renderStatements(question) {
    if (!question.statements || question.statements.length === 0) return '';
    return `
        <ul class="list-decimal list-inside space-y-2 mb-4 text-gray-700 dark:text-gray-300 text-sm">
            ${question.statements.map(s => `<li class="leading-relaxed">${s.text}</li>`).join('')}
        </ul>
    `;
}

// --- 4. Interaction Logic ---
function toggleSelection(questionId, optionId) {
    userAnswers[questionId] = [optionId]; 
    renderQuestion(); 
}

function updateNavigationButtons() {
    const nextBtn = document.getElementById('next-button');
    const isLast = currentQuestionIndex === currentQuestions.length - 1;
    
    nextBtn.textContent = isLast ? "Finish & Submit" : "Next Question →";
    nextBtn.onclick = isLast ? submitQuiz : nextQuestion;
    nextBtn.disabled = false;
}

function nextQuestion() {
    if (currentQuestionIndex < currentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
        updateNavigationButtons();
    }
}

// --- 5. ADITYA AI LOGIC (New Integration) ---

export async function askAditya() {
    const sheet = document.getElementById('aditya-sheet');
    const content = document.getElementById('aditya-content');
    const question = currentQuestions[currentQuestionIndex];
    
    // Open Sheet
    if (sheet) sheet.classList.remove('translate-y-full');
    
    // Check if user has answered
    const userSelection = userAnswers[question.id] || [];
    
    if (userSelection.length === 0) {
        content.innerHTML = `
            <div class="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <p class="text-yellow-400 font-medium">"Arre dost, select an answer first! I need to know what you're thinking before I can guide you. Take a guess, full power!"</p>
            </div>`;
        return;
    }

    // Prepare data for AI
    const correctOptions = question.options.filter(o => o.is_correct).map(o => o.id);

    // Show Loading State
    content.innerHTML = `
        <div class="flex flex-col items-center justify-center space-y-3 py-6 animate-pulse">
            <span class="text-4xl">🤔</span>
            <p class="text-indigo-300 font-medium">Aditya is analyzing your logic... ek min...</p>
        </div>
    `;

    try {
        // Call AI Module
        const explanation = await generateSocraticExplanation(question, userSelection, correctOptions);
        
        // Render Markdown Result
        // We assume 'marked' library is loaded globally via CDN in index.html
        content.innerHTML = marked.parse(explanation);
        
    } catch (e) {
        console.error(e);
        content.innerHTML = `<p class="text-red-400">Connection break ho gaya. Try again. (${e.message})</p>`;
    }
}

export function closeAditya() {
    const sheet = document.getElementById('aditya-sheet');
    if (sheet) sheet.classList.add('translate-y-full');
}


// --- 6. Submission & Results ---
async function submitQuiz() {
    // Hide Aditya Button on Submit
    const adityaBtn = document.getElementById('aditya-floating-btn');
    if (adityaBtn) adityaBtn.classList.add('hidden');
    closeAditya();

    const results = currentQuestions.map(q => {
        const userSel = userAnswers[q.id] || [];
        const { score, isCorrect, mistakes } = calculateScore(q, userSel);
        return {
            questionId: q.id,
            questionText: q.question_text,
            userSelections: userSel,
            isCorrect,
            score,
            mistakes,
            correctOptions: q.options.filter(o => o.is_correct).map(o => o.id)
        };
    });

    const summary = aggregateQuizResults(results);
    showResultsModal(summary, results);
}

function showResultsModal(summary, detailedResults) {
    const resultsContent = document.getElementById('results-content');
    
    const percentage = Math.round((summary.score / summary.totalQuestions) * 100);
    let message = percentage > 80 ? "Excellent!" : (percentage > 50 ? "Good Effort" : "Keep Practicing");

    resultsContent.innerHTML = `
        <div class="text-center">
            <h3 class="text-2xl font-bold ${percentage > 50 ? 'text-green-400' : 'text-orange-400'}">${message}</h3>
            <p class="text-5xl font-extrabold my-6 text-white">${summary.score} <span class="text-xl text-gray-400">/ ${summary.totalQuestions}</span></p>
            <p class="text-gray-400 mb-8">Accuracy: ${percentage}%</p>
            
            <button onclick="exitQuiz()" class="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition transform">
                Back to Dashboard
            </button>
        </div>
    `;

    showModal('results-content');
}

// Export for global usage (HTML onclicks)
window.startNewQuiz = startNewQuiz;
window.askAditya = askAditya;
window.closeAditya = closeAditya;
window.exitQuiz = exitQuiz;

