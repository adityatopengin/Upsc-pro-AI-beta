// page-notes.js - Logic for managing user notes, including AI-generated content.

import { db } from './db.js';
import { getSafeThemeClasses, logError } from './core.js';
import { showModal, hideModal } from './ui-common.js';
import { generateNotesFromDiagram } from './ai.js'; 

// --- DOM Elements (Must match index.html IDs) ---
const notesListContainer = document.getElementById('notes-list-container');
const newNoteContent = document.getElementById('new-note-content');
const noteTitleInput = document.getElementById('note-title-input');
const noteTextInput = document.getElementById('note-text-input');
const diagramFileInput = document.getElementById('diagram-file-input');
const saveNoteButton = document.getElementById('save-note-button');


// --- 1. Core Data Operations ---

/**
 * Saves a new note or updates an existing one in the database.
 */
async function saveNote(note) {
    try {
        if (note.id) {
            await db.notes.update(parseInt(note.id), note);
        } else {
            note.timestamp = new Date().toISOString();
            note.source = note.source || 'Manual Entry';
            await db.notes.add(note);
        }
        await renderNotesList();
    } catch (error) {
        logError('NOTES_SAVE_FAIL', error, { noteId: note.id });
    }
}

/**
 * Deletes a note by its ID.
 */
async function deleteNote(id) {
    if (confirm("Are you sure you want to delete this note? This action cannot be undone.")) {
        try {
            await db.notes.delete(parseInt(id));
            await renderNotesList();
        } catch (error) {
            logError('NOTES_DELETE_FAIL', error, { noteId: id });
        }
    }
}

/**
 * Fetches all notes and renders them to the UI.
 */
export async function renderNotesList() {
    if (!notesListContainer) {
        logError('NOTES_UI_INIT_FAIL', new Error('Notes list container not found.'));
        return;
    }
    
    try {
        // Fetch notes sorted by timestamp (newest first)
        const notes = await db.notes.orderBy('timestamp').reverse().toArray();
        
        notesListContainer.innerHTML = notes.map(note => `
            <div class="note-item p-4 mb-3 ${getSafeThemeClasses('bg-rainbow-300')} rounded-lg shadow-md border border-white/50 dark:border-gray-600/50">
                <h4 class="font-bold text-lg">${note.title}</h4>
                <p class="text-xs text-gray-600 dark:text-gray-400">Source: ${note.source} | ${new Date(note.timestamp).toLocaleDateString()}</p>
                <div class="mt-2 text-sm whitespace-pre-wrap">${note.content.substring(0, 150)}...</div>
                <div class="mt-3 space-x-2">
                    <button onclick="window.editNote(${note.id})" class="text-primary hover:underline text-sm">View/Edit</button>
                    <button onclick="window.deleteNote(${note.id})" class="text-red-500 hover:underline text-sm">Delete</button>
                </div>
            </div>
        `).join('') || '<p class="text-gray-500">No notes saved yet. Add one or generate one from a diagram!</p>';
    } catch (error) {
        logError('NOTES_RENDER_FAIL', error);
        notesListContainer.innerHTML = '<p class="text-red-500">Could not load notes due to a database error.</p>';
    }
}

/**
 * Fetches a note and populates the modal for editing.
 */
window.editNote = async function(id) {
    try {
        const note = await db.notes.get(parseInt(id));
        if (note) {
            noteTitleInput.value = note.title;
            noteTextInput.value = note.content;
            newNoteContent.dataset.editingId = note.id; // Store ID for update logic
            showModal('new-note-content');
        }
    } catch (error) {
        logError('NOTES_EDIT_FETCH_FAIL', error, { noteId: id });
    }
};

// Expose delete globally for inline click handlers
window.deleteNote = deleteNote; 

// --- 2. AI Diagram-to-Notes Integration ---

/**
 * Handles the file upload and calls the AI Vision model.
 */
export async function handleDiagramUpload() {
    const file = diagramFileInput.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert("Please upload a valid image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
        
        noteTextInput.value = "Generating notes, please wait...";
        
        try {
            const base64Image = reader.result.split(',')[1];
            const mimeType = file.type;
            const promptText = `Analyze this diagram/map for UPSC relevance.`;
            
            const notesContent = await generateNotesFromDiagram(base64Image, mimeType, promptText);
            
            // Populate the modal with AI results
            noteTitleInput.value = `AI Notes: ${file.name.substring(0, 20)} - ${new Date().toLocaleTimeString()}`;
            noteTextInput.value = notesContent;
            
            alert("AI notes successfully generated! Review and save them.");

        } catch (error) {
            noteTextInput.value = "AI Generation Failed. See console for error details.";
            logError('AI_DIAGRAM_UI_FAIL', error);
        }
    };
    reader.readAsDataURL(file);
}


// --- 3. UI/Event Logic ---

// Main save handler for the modal
if (saveNoteButton) {
    saveNoteButton.addEventListener('click', () => {
        const title = noteTitleInput.value.trim();
        const content = noteTextInput.value.trim();
        const id = newNoteContent.dataset.editingId;

        if (!title || !content) {
            alert("Title and content cannot be empty.");
            return;
        }

        const noteObject = { title: title, content: content };
        if (id) {
            noteObject.id = id; 
        }

        saveNote(noteObject);
        hideModal();
        
        // Clear modal for next use
        noteTitleInput.value = '';
        noteTextInput.value = '';
        newNoteContent.dataset.editingId = ''; 
    });
}

// Attach event listener to file input change
if (diagramFileInput) {
    diagramFileInput.addEventListener('change', handleDiagramUpload);
}


// Initialize the notes view on app load
document.addEventListener('DOMContentLoaded', renderNotesList);

