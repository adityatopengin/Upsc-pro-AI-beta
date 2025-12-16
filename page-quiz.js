// page-quiz.js - Logic for running a quiz, handling user interaction, and saving results.

import { getQuestionsForQuiz, saveQuizResult } from './db.js';
import { calculateScore, aggregateQuizResults, logError, getSafeThemeClasses } from './core.js';
import { showModal } from './ui-common.js'; // Assuming displayResults uses showModal

// --- Global State ---
let currentQuizQuestions = [];
let currentQuestionIndex = 0;
let quizRunResults = []; 
let userSelections = new Map(); // Tracks user's selections { questionId: ['a', 'c'] }

// --- DOM Elements (Must match index.html IDs) ---
const quizContainer = document.getElementById('quiz-container');
const questionDisplay = document.getElementById('question-display');
const optionsContainer = document.getElementById('options-container');
const nextButton = document.getElementById('next-button');
const resultsModalContent = document.getElementById('results-content'); // Unified Modal Content ID

/**
 * 1. Quiz Initialization and Fetching
 */
export async function startNewQuiz(subject, topic) {
    try {
        currentQuizQuestions = await getQuestionsForQuiz(subject, topic);
    } catch (error) {
        logError('QUIZ_START_FETCH_FAIL', error, { subject, topic });
        alert("Failed to load quiz questions due to a database error.");
        return;
    }
    
    if (currentQuizQuestions.length === 0) {
        logError('QUIZ_START_NO_QUESTIONS', new Error('Zero questions returned for quiz'), { subject, topic });
        alert(`No questions found for ${topic} in ${subject}.`);
        return;
    }

    // Reset state and UI
    currentQuestionIndex = 0;
    quizRunResults = [];
    userSelections.clear();
    quizContainer.classList.remove('hidden');

    renderQuestion(currentQuizQuestions[currentQuestionIndex]);
}


/**
 * 2. Question Rendering (Handles Statement-Based Format and UI/UX)
 */
function renderQuestion(question) {
    if (!question) return;

    questionDisplay.innerHTML = '';
    optionsContainer.innerHTML = '';
    
    const currentSelections = userSelections.get(question.id) || [];

    // --- Render Statements (New Schema Feature) ---
    if (question.statements && question.statements.length > 0) {
        questionDisplay.innerHTML += `
            <div class="p-3 mb-4 ${getSafeThemeClasses('bg-rainbow-100')} ${getSafeThemeClasses('border-soft')} shadow-inner">
                <h3 class="font-semibold text-md mb-2">Statements:</h3>
                <ol class="list-decimal list-inside ml-4 space-y-2">
                    ${question.statements.map(stmt => `<li data-stmt-id="${stmt.id}">${stmt.text}</li>`).join('')}
                </ol>
            </div>
        `;
    }

    // --- Render Question Text and Options ---
    questionDisplay.innerHTML += `<p class="text-lg font-bold mb-4">${question.question_text || 'Select the correct combination:'}</p>`;
    
    question.options.forEach(option => {
        const inputType = question.type === 'single-choice' ? 'radio' : 'checkbox';
        const isSelected = currentSelections.includes(option.id);
        
        const selectionClass = isSelected ? getSafeThemeClasses('bg-rainbow-400') + ' shadow-md' : '';

        const optionEl = document.createElement('div');
        optionEl.className = `option-item p-3 mb-2 border cursor-pointer transition duration-150 
                              ${getSafeThemeClasses('border-soft')} 
                              border-gray-200 dark:border-gray-700 
                              hover:bg-primary/10 ${selectionClass}`;

        optionEl.innerHTML = `
            <input type="${inputType}" id="opt-${option.id}" name="quiz-option" value="${option.id}" class="mr-3 hidden">
            <label for="opt-${option.id}" class="block text-sm font-medium">(${option.id.toUpperCase()}) ${option.text}</label>
        `;
        
        optionEl.addEventListener('click', () => handleOptionSelection(question.id, option.id, inputType));
        optionsContainer.appendChild(optionEl);
    });
    
    nextButton.disabled = currentSelections.length === 0;
}


/**
 * 3. User Selection Handler (Includes UI/UX Selection Feedback)
 */
function handleOptionSelection(questionId, selectedId, inputType) {
    let currentSelections = userSelections.get(questionId) || [];
    const index = currentSelections.indexOf(selectedId);

    if (inputType === 'radio') {
        currentSelections = [selectedId];
    } else { 
        if (index > -1) {
            currentSelections.splice(index, 1);
        } else {
            currentSelections.push(selectedId);
        }
    }
    userSelections.set(questionId, currentSelections);

    // Visual Update Logic (Phase 5 UI/UX)
    const options = optionsContainer.querySelectorAll('.option-item');
    options.forEach(opt => {
        const input = opt.querySelector('input');
        const isSelected = currentSelections.includes(input.value);

        opt.classList.remove(getSafeThemeClasses('bg-rainbow-400'), 'shadow-md');
        if (isSelected) {
            opt.classList.add(getSafeThemeClasses('bg-rainbow-400'), 'shadow-md');
        }
    });

    nextButton.disabled = currentSelections.length === 0;
}


/**
 * 4. Navigation and Grading
 */
if (nextButton) {
    nextButton.addEventListener('click', () => {
        const question = currentQuizQuestions[currentQuestionIndex];
        const selections = userSelections.get(question.id) || [];

        // Grade the current question
        const { score, isCorrect, mistakes } = calculateScore(question, selections);

        // Prepare result object (Fixes the Critical userSel Bug)
        const questionResult = {
            questionId: question.id,
            subject: question.subject, 
            userSelections: selections, // CRITICAL FIX: The user's choice is saved
            isCorrect: isCorrect,
            score: score,
            detailedMistakes: mistakes, 
        };

        quizRunResults.push(questionResult);

        // Move to next question or end quiz
        currentQuestionIndex++;

        if (currentQuestionIndex < currentQuizQuestions.length) {
            renderQuestion(currentQuizQuestions[currentQuestionIndex]);
        } else {
            endQuiz();
        }
    });
}


/**
 * 5. Quiz Finalization and Saving
 */
async function endQuiz() {
    const finalResult = aggregateQuizResults(quizRunResults);

    try {
        const resultId = await saveQuizResult(finalResult);
        displayResults(finalResult, resultId); 
    } catch (error) {
        logError('QUIZ_SAVE_RESULT_FAIL', error, { totalScore: finalResult.score, attempts: finalResult.totalQuestions });
        alert("Quiz completed, but the result could not be saved locally.");
        displayResults(finalResult, null);
    } finally {
        quizContainer.classList.add('hidden');
    }
}

/**
 * 6. Results Display (Placeholder - uses the Unified Modal)
 */
function displayResults(results, id) {
    if (resultsModalContent) {
        resultsModalContent.innerHTML = `
            <h3 class="text-2xl font-bold mb-4 ${getSafeThemeClasses('text-primary')}">Quiz Completed!</h3>
            <p class="text-4xl font-extrabold mb-6">${results.score} / ${results.totalQuestions}</p>
            <p class="text-sm dark:text-gray-300 mb-4">You got ${results.mistakes.length} questions wrong. Review the dashboard for detailed analytics.</p>
            <button onclick="hideModal()" class="w-full py-2 bg-primary text-white ${getSafeThemeClasses('border-soft')} hover:bg-indigo-700 transition">Review Dashboard</button>
        `;
        showModal('results-content');
    } else {
        logError('RESULTS_UI_FAIL', new Error('Results modal content element missing.'));
    }
}

