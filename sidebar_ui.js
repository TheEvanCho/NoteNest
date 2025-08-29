// NoteNest Sidebar UI Logic
// Handles all user interactions, data management, and auto-save functionality

class NoteNest {
    constructor() {
        this.data = {
            folders: [],
            activeFolder: null,
            activeNote: null
        };
        
        this.saveTimeout = null;
        this.isEditorDirty = false;
        this.lastSavedContent = '';
        
        this.init();
    }

    // Initialize the application
    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.render();
        this.setupAutoSave();
        
        // Focus on editor if there's an active note
        if (this.data.activeNote) {
            document.getElementById('editor').focus();
        }
    }

    // Set up all event listeners
    setupEventListeners() {
        // Close button
        document.getElementById('close-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked');
            this.closeWithSave();
        });

        // Add folder button
        document.getElementById('add-folder-btn').addEventListener('click', () => {
            this.addFolder();
        });

        // Add note button
        document.getElementById('add-note-btn').addEventListener('click', () => {
            this.addNote();
        });

        // Note title input
        const titleInput = document.getElementById('note-title');
        titleInput.addEventListener('input', () => {
            this.updateNoteTitle(titleInput.value);
            this.markDirty();
        });

        // Toolbar buttons
        document.querySelectorAll('.toolbar-btn[data-command]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.execCommand(btn.dataset.command);
            });
        });

        // Heading select
        document.getElementById('heading-select').addEventListener('change', (e) => {
            this.formatHeading(e.target.value);
        });

        // Emoji button
        document.getElementById('emoji-btn').addEventListener('click', () => {
            this.toggleEmojiPicker();
        });

        // Emoji picker
        document.querySelectorAll('.emoji-grid span').forEach(emoji => {
            emoji.addEventListener('click', () => {
                this.insertEmoji(emoji.textContent);
            });
        });

        // Editor events
        const editor = document.getElementById('editor');
        editor.addEventListener('input', () => {
            this.markDirty();
            this.updateWordCount();
            this.updateToolbarState();
        });

        editor.addEventListener('keyup', () => {
            this.updateToolbarState();
        });

        editor.addEventListener('mouseup', () => {
            this.updateToolbarState();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Global shortcut to close sidebar (Escape key)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Escape key pressed');
                this.closeWithSave();
            }
        });

        // Listen for messages from parent
        window.addEventListener('message', (event) => {
            this.handleParentMessage(event);
        });

        // Click outside emoji picker to close
        document.addEventListener('click', (e) => {
            const emojiPicker = document.getElementById('emoji-picker');
            const emojiBtn = document.getElementById('emoji-btn');
            
            if (!emojiPicker.contains(e.target) && !emojiBtn.contains(e.target)) {
                emojiPicker.classList.add('hidden');
            }
        });

        // Save before page unload
        window.addEventListener('beforeunload', () => {
            this.saveCurrentNote();
            this.saveData();
        });

        // Handle page visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveCurrentNote();
                this.saveData();
            }
        });
    }

    // Handle messages from parent window
    handleParentMessage(event) {
        const { action, data } = event.data;
        
        switch (action) {
            case 'dataResponse':
                this.data = data || this.getDefaultData();
                this.render();
                break;
                
            case 'saveBeforeUnload':
                this.saveData();
                break;
        }
    }

    // Get default data structure
    getDefaultData() {
        return {
            folders: [
                {
                    id: 'default',
                    name: 'My Notes',
                    notes: [
                        {
                            id: 'welcome',
                            title: 'Welcome to NoteNest',
                            content: '<h1>Welcome to NoteNest! îžçµ±</h1><p>Start taking beautiful notes with rich formatting. Create folders to organize your thoughts!</p>',
                            createdAt: Date.now(),
                            updatedAt: Date.now()
                        }
                    ]
                }
            ],
            activeFolder: 'default',
            activeNote: 'welcome'
        };
    }

    // Load data from storage
    async loadData() {
        return new Promise((resolve) => {
            // Request data from parent
            window.parent.postMessage({ action: 'getData' }, '*');
            
            // Set timeout in case no response
            setTimeout(() => {
                if (!this.data.folders.length) {
                    this.data = this.getDefaultData();
                    this.render();
                }
                resolve();
            }, 1000);
        });
    }

    // Save data to storage
    saveData() {
        if (this.isEditorDirty) {
            this.saveCurrentNote();
        }
        
        window.parent.postMessage({
            action: 'saveData',
            data: this.data
        }, '*');
        
        this.setSaveStatus('saved');
    }

    // Close sidebar with proper save
    closeWithSave() {
        console.log('Closing sidebar with save...');
        this.saveCurrentNote();
        
        // Save data and then close
        window.parent.postMessage({
            action: 'saveData',
            data: this.data
        }, '*');
        
        // Give a moment for save to process, then close
        setTimeout(() => {
            console.log('Sending close message to parent');
            window.parent.postMessage({ action: 'closeSidebar' }, '*');
        }, 100);
    }

    // Set up auto-save functionality
    setupAutoSave() {
        const editor = document.getElementById('editor');
        
        editor.addEventListener('input', () => {
            // Clear existing timeout
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
            }
            
            // Set save status to saving
            this.setSaveStatus('saving');
            
            // Set new timeout for 500ms after user stops typing
            this.saveTimeout = setTimeout(() => {
                this.saveCurrentNote();
                this.saveData();
            }, 500);
        });
    }

    // Mark editor as dirty (needs saving)
    markDirty() {
        this.isEditorDirty = true;
    }

    // Set save status indicator
    setSaveStatus(status) {
        const statusEl = document.getElementById('save-status');
        statusEl.className = status;
        
        switch (status) {
            case 'saving':
                statusEl.textContent = 'Saving...';
                break;
            case 'saved':
                statusEl.textContent = 'Saved';
                this.isEditorDirty = false;
                break;
        }
    }

    // Render the entire UI
    render() {
        this.renderFolders();
        this.renderNotes();
        this.renderEditor();
        this.updateWordCount();
    }

    // Render folders list
    renderFolders() {
        const container = document.getElementById('folders-list');
        container.innerHTML = '';
        
        this.data.folders.forEach(folder => {
            const folderEl = document.createElement('div');
            folderEl.className = `folder-item ${folder.id === this.data.activeFolder ? 'active' : ''}`;
            folderEl.textContent = `${folder.name}`;
            
            folderEl.addEventListener('click', () => {
                this.selectFolder(folder.id);
            });
            
            // Double-click to rename
            folderEl.addEventListener('dblclick', () => {
                this.renameFolderPrompt(folder.id);
            });
            
            container.appendChild(folderEl);
        });
    }

    // Render notes list for active folder
    renderNotes() {
        const container = document.getElementById('notes-list');
        container.innerHTML = '';
        
        const activeFolder = this.getActiveFolder();
        if (!activeFolder) return;
        
        activeFolder.notes.forEach(note => {
            const noteEl = document.createElement('div');
            noteEl.className = `note-item ${note.id === this.data.activeNote ? 'active' : ''}`;
            noteEl.textContent = `${note.title || 'Untitled'}`;
            
            noteEl.addEventListener('click', () => {
                this.selectNote(note.id);
            });
            
            // Double-click to rename
            noteEl.addEventListener('dblclick', () => {
                this.renameNotePrompt(note.id);
            });
            
            container.appendChild(noteEl);
        });
    }

    // Render editor with active note content
    renderEditor() {
        const activeNote = this.getActiveNote();
        const titleInput = document.getElementById('note-title');
        const editor = document.getElementById('editor');
        
        if (activeNote) {
            titleInput.value = activeNote.title || '';
            editor.innerHTML = activeNote.content || '';
            this.lastSavedContent = editor.innerHTML;
        } else {
            titleInput.value = '';
            editor.innerHTML = '';
            this.lastSavedContent = '';
        }
        
        this.isEditorDirty = false;
    }

    // Get active folder object
    getActiveFolder() {
        return this.data.folders.find(f => f.id === this.data.activeFolder);
    }

    // Get active note object
    getActiveNote() {
        const activeFolder = this.getActiveFolder();
        if (!activeFolder) return null;
        return activeFolder.notes.find(n => n.id === this.data.activeNote);
    }

    // Select a folder
    selectFolder(folderId) {
        if (this.isEditorDirty) {
            this.saveCurrentNote();
        }
        
        this.data.activeFolder = folderId;
        const folder = this.getActiveFolder();
        
        // Select first note in folder, or clear selection
        this.data.activeNote = folder && folder.notes.length > 0 ? folder.notes[0].id : null;
        
        this.render();
        this.saveData();
    }

    // Select a note
    selectNote(noteId) {
        if (this.isEditorDirty) {
            this.saveCurrentNote();
        }
        
        this.data.activeNote = noteId;
        this.render(); // <-- FIX: Changed from this.renderEditor() to this.render()
        this.saveData();
        
        // Focus on editor
        setTimeout(() => {
            document.getElementById('editor').focus();
        }, 100);
    }

    // Add new folder
    addFolder() {
        const name = prompt('Enter folder name:');
        if (!name || !name.trim()) return;
        
        const folder = {
            id: 'folder_' + Date.now(),
            name: name.trim(),
            notes: []
        };
        
        this.data.folders.push(folder);
        this.data.activeFolder = folder.id;
        this.data.activeNote = null;
        
        this.render();
        this.saveData();
    }

    // Add new note
    addNote() {
        const activeFolder = this.getActiveFolder();
        if (!activeFolder) {
            alert('Please select a folder first');
            return;
        }
        
        if (this.isEditorDirty) {
            this.saveCurrentNote();
        }
        
        const note = {
            id: 'note_' + Date.now(),
            title: 'New Note',
            content: '<p>Start typing...</p>',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        
        activeFolder.notes.push(note);
        this.data.activeNote = note.id;
        
        this.render();
        this.saveData();
        
        // Focus on title input
        setTimeout(() => {
            const titleInput = document.getElementById('note-title');
            titleInput.select();
        }, 100);
    }

    // Update note title
    updateNoteTitle(title) {
        const activeNote = this.getActiveNote();
        if (activeNote) {
            activeNote.title = title.trim() || 'Untitled';
            activeNote.updatedAt = Date.now();
            this.renderNotes(); // Update the notes list display
        }
    }

    // Save current note content
    saveCurrentNote() {
        const activeNote = this.getActiveNote();
        if (!activeNote) return;
        
        const editor = document.getElementById('editor');
        const content = editor.innerHTML;
        
        if (content !== this.lastSavedContent) {
            activeNote.content = content;
            activeNote.updatedAt = Date.now();
            this.lastSavedContent = content;
            this.isEditorDirty = false;
        }
    }

    // Execute formatting command
    execCommand(command) {
        document.execCommand(command, false, null);
        document.getElementById('editor').focus();
        this.updateToolbarState();
        this.markDirty();
    }

    // Format text with heading
    formatHeading(tag) {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const element = range.commonAncestorContainer.nodeType === Node.TEXT_NODE 
            ? range.commonAncestorContainer.parentElement 
            : range.commonAncestorContainer;
        
        // Create new element
        const newElement = document.createElement(tag);
        
        if (selection.toString()) {
            // Wrap selected text
            newElement.textContent = selection.toString();
            range.deleteContents();
            range.insertNode(newElement);
        } else {
            // Replace current block element
            newElement.innerHTML = element.innerHTML || '&nbsp;';
            element.parentNode.replaceChild(newElement, element);
        }
        
        // Clear selection and focus
        selection.removeAllRanges();
        document.getElementById('editor').focus();
        this.markDirty();
    }

    // Update toolbar button states
    updateToolbarState() {
        const commands = ['bold', 'italic'];
        
        commands.forEach(command => {
            const btn = document.querySelector(`[data-command="${command}"]`);
            if (btn) {
                const isActive = document.queryCommandState(command);
                btn.classList.toggle('active', isActive);
            }
        });
        
        // Update heading select
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let element = selection.focusNode;
            if (element.nodeType === Node.TEXT_NODE) {
                element = element.parentElement;
            }
            
            const tagName = element.tagName?.toLowerCase() || 'p';
            const select = document.getElementById('heading-select');
            
            if (['h1', 'h2', 'h3', 'p'].includes(tagName)) {
                select.value = tagName;
            }
        }
    }

    // Toggle emoji picker
    toggleEmojiPicker() {
        const picker = document.getElementById('emoji-picker');
        picker.classList.toggle('hidden');
    }

    // Insert emoji at cursor
    insertEmoji(emoji) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        const emojiNode = document.createTextNode(emoji);
        range.deleteContents();
        range.insertNode(emojiNode);
        
        // Move cursor after emoji
        range.setStartAfter(emojiNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        document.getElementById('editor').focus();
        document.getElementById('emoji-picker').classList.add('hidden');
        this.markDirty();
    }

    // Handle keyboard shortcuts
    handleKeyboardShortcuts(e) {
        const isCtrlCmd = e.ctrlKey || e.metaKey;
        
        if (isCtrlCmd && e.key === 'b') {
            e.preventDefault();
            this.execCommand('bold');
        } else if (isCtrlCmd && e.key === 'i') {
            e.preventDefault();
            this.execCommand('italic');
        } else if (isCtrlCmd && e.key === 's') {
            e.preventDefault();
            this.saveData();
        }
    }

    // Update word count
    updateWordCount() {
        const editor = document.getElementById('editor');
        const text = editor.textContent || editor.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        
        document.getElementById('word-count').textContent = `${words} word${words !== 1 ? 's' : ''}`;
    }

    // Rename folder (double-click handler)
    renameFolderPrompt(folderId) {
        const folder = this.data.folders.find(f => f.id === folderId);
        if (!folder) return;
        
        const newName = prompt('Rename folder:', folder.name);
        if (newName && newName.trim() && newName.trim() !== folder.name) {
            folder.name = newName.trim();
            this.renderFolders();
            this.saveData();
        }
    }

    // Rename note (double-click handler)
    renameNotePrompt(noteId) {
        const activeFolder = this.getActiveFolder();
        const note = activeFolder?.notes.find(n => n.id === noteId);
        if (!note) return;
        
        const newTitle = prompt('Rename note:', note.title);
        if (newTitle && newTitle.trim() && newTitle.trim() !== note.title) {
            note.title = newTitle.trim();
            note.updatedAt = Date.now();
            
            // Update title input if this is the active note
            if (noteId === this.data.activeNote) {
                document.getElementById('note-title').value = note.title;
            }
            
            this.renderNotes();
            this.saveData();
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NoteNest();
});