// ui-common.js - Central UI Management & Navigation

// --- Modal Logic ---
export function showModal(modalId) {
    const backdrop = document.getElementById('modal-backdrop');
    const container = document.getElementById('unified-modal-container');
    const modal = document.getElementById(modalId);

    if (backdrop && container && modal) {
        backdrop.classList.remove('hidden', 'opacity-0');
        container.classList.remove('hidden', 'opacity-0');
        
        // Hide all other modals first
        document.querySelectorAll('#unified-modal-container > div').forEach(div => {
            div.classList.add('hidden');
        });
        
        modal.classList.remove('hidden');
    }
}

export function hideModal() {
    const backdrop = document.getElementById('modal-backdrop');
    const container = document.getElementById('unified-modal-container');

    if (backdrop && container) {
        backdrop.classList.add('opacity-0');
        container.classList.add('opacity-0');
        
        setTimeout(() => {
            backdrop.classList.add('hidden');
            container.classList.add('hidden');
            // Hide all inner content
            document.querySelectorAll('#unified-modal-container > div').forEach(div => {
                div.classList.add('hidden');
            });
        }, 300); // Wait for fade out
    }
}

// --- NEW: Global Navigation (Fixes the "Dead End" bug) ---
export function goHome() {
    // 1. Hide Modals
    hideModal();

    // 2. Switch Main Views
    document.getElementById('quiz-container').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');

    // 3. Reset Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
}

// Attach to window so HTML buttons can use it
window.goHome = goHome;
window.hideModal = hideModal;
window.showModal = showModal;

