// ui-common.js - Common UI utilities, Unified Modal System, and Theme Helpers

import { THEME_CLASS_MAP, logError } from './core.js'; // Phase 5: Error Handling & Phase 4: Theme Fix

// --- 1. Unified Modal System (Replaces conflicting modal logic - Phase 2 Fix) ---

const modalBackdrop = document.getElementById('modal-backdrop');
const modalContainer = document.getElementById('unified-modal-container');
let activeModalContentId = null; 

/**
 * Initializes the modal structure event handlers.
 */
function initializeModalSystem() {
    if (!modalBackdrop || !modalContainer) {
        logError('UI_INIT_FAIL', new Error('Modal base elements not found in DOM.'));
        return;
    }
    
    // Attach a handler to close the modal when clicking the backdrop
    modalBackdrop.addEventListener('click', hideModal);
}

/**
 * Shows the unified modal with specific content.
 * @param {string} contentId - The ID of the hidden content element (e.g., 'quiz-selection-content') to display inside the modal.
 */
export function showModal(contentId) {
    const contentElement = document.getElementById(contentId);
    if (!contentElement || !modalContainer || !modalBackdrop) {
        logError('UI_MODAL_SHOW_FAIL', new Error(`Content ID or container missing.`), { contentId });
        return;
    }

    // 1. Hide any currently active content
    if (activeModalContentId) {
        const activeContent = document.getElementById(activeModalContentId);
        if (activeContent) activeContent.classList.add('hidden');
    }

    // 2. Move the target content into the modal container and make it visible
    modalContainer.appendChild(contentElement);
    contentElement.classList.remove('hidden');
    activeModalContentId = contentId;

    // 3. Display the modal itself (backdrop and container)
    modalBackdrop.classList.remove('hidden', 'opacity-0');
    modalContainer.classList.remove('hidden', 'opacity-0');
}

/**
 * Hides the unified modal and restores the content to its original location.
 */
export function hideModal() {
    if (activeModalContentId) {
        const contentElement = document.getElementById(activeModalContentId);
        if (contentElement) {
            // Restore content back to a hidden area in the main DOM (assumed to be body/app-container)
            document.body.appendChild(contentElement); 
            contentElement.classList.add('hidden');
        }
    }

    // Add opacity transition classes for smoother closing
    modalBackdrop.classList.add('opacity-0');
    modalContainer.classList.add('opacity-0');
    
    // Use a small timeout to ensure transition completes before hiding
    setTimeout(() => {
        modalBackdrop.classList.add('hidden');
        modalContainer.classList.add('hidden');
        activeModalContentId = null;
    }, 300); 
}


// --- 2. Theme Helper (Tailwind Theme Failure Bug Fix) ---

/**
 * Function to safely retrieve complete, non-purged Tailwind CSS classes.
 * @param {string} key - The key from the THEME_CLASS_MAP (e.g., 'bg-primary').
 * @returns {string} The complete, safe Tailwind class string.
 */
export function getSafeThemeClasses(key) {
    return THEME_CLASS_MAP[key] || '';
}


// Initialize the modal system when the script runs
document.addEventListener('DOMContentLoaded', initializeModalSystem);

