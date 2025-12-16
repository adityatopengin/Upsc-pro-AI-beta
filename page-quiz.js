// page-quiz.js - Quiz Engine & Interaction Logic

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
            goHome();
            return;
        }

        renderQuestion();
        updateNavigationButtons();

    } catch (error) {
        console.error("Quiz Load Error:", error);
        alert("Failed to load quiz.");
        goHome();
    }
}


// --- 2. Render Question (With "Quit" Button) ---
function renderQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const qDisplay = document.getElementById('question-display');
    const optionsContainer = document.getElementById('options-container');

    // 1. Render Question Text & Header
    qDisplay.innerHTML = `
        <div class="flex justify-between items-center mb-4 border-b pb-2">
            <span class="text-sm font-bold text-gray-500">Q ${currentQuestionIndex + 1} of ${currentQuestions.length}</span>
            <button onclick="goHome()" class="text-xs text-red-500 font-semibold hover:underline">Quit X</button>
        </div>
        <h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
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
            p-3 mb-2 rounded-lg border cursor-pointer transition select-none flex items-center
            ${isSelected ? 'bg-indigo-100 border-primary dark:bg-indigo-900' : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50'}
        `;
        btn.innerHTML = `
            <div class="w-5 h-5 rounded-full border mr-3 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-gray-400'}">
                ${isSelected ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
            </div>
            <span class="${isSelected ? 'font-semibold text-primary dark:text-indigo-300' : ''}">${opt.text}</span>
        `;
        
        btn.onclick = () => toggleSelection(question.id, opt.id);
        optionsContainer.appendChild(btn);
    });
}

function renderStatements(question) {
    if (!question.statements || question.statements.length === 0) return '';
    return `
        <ul class="list-decimal list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300">
            ${question.statements.map(s => `<li>${s.text}</li>`).join('')}
        </ul>
    `;
}


// --- 3. Interaction Logic ---
function toggleSelection(questionId, optionId) {
    // Toggle logic (allows multiple selection if needed, but usually single for UPSC prelims)
    // For strictly single choice:
    userAnswers[questionId] = [optionId]; 
    renderQuestion(); // Re-render to show active state
}

function updateNavigationButtons() {
    const nextBtn = document.getElementById('next-button');
    const isLast = currentQuestionIndex === currentQuestions.length - 1;
    
    nextBtn.textContent = isLast ? "Finish & Submit" : "Next Question";
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


// --- 4. Submission & Results (Fixes the "Broken Demo") ---
async function submitQuiz() {
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
    
    // Calculate percentage
    const percentage = Math.round((summary.score / summary.totalQuestions) * 100);
    let message = percentage > 80 ? "Excellent!" : (percentage > 50 ? "Good Effort" : "Keep Practicing");

    resultsContent.innerHTML = `
        <div class="text-center">
            <h3 class="text-2xl font-bold ${percentage > 50 ? 'text-green-600' : 'text-orange-500'}">${message}</h3>
            <p class="text-4xl font-extrabold my-4">${summary.score} / ${summary.totalQuestions}</p>
            <p class="text-gray-500 mb-6">Accuracy: ${percentage}%</p>
            
            <div class="space-y-2">
                <button onclick="goHome()" class="w-full py-3 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700">
                    Back to Dashboard
                </button>
            </div>
        </div>
    `;

    showModal('results-content');
}

// Export for global usage
window.startNewQuiz = startNewQuiz;

