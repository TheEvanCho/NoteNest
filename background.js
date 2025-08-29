// Background script (service worker) for NoteNest
// Handles extension lifecycle, commands, and action clicks

// Initialize extension when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('NoteNest extension installed');
  
  // Initialize default data structure if not exists
  chrome.storage.local.get(['noteNestData', 'sidebarWidth'], (result) => {
    if (!result.noteNestData) {
      const initialData = {
        folders: [
          {
            id: 'default',
            name: 'My Notes',
            notes: [
              {
                id: 'welcome',
                title: 'Welcome to NoteNest',
                content: '<h1>Welcome to NoteNest! ðŸ“</h1><p>Start taking beautiful notes with rich formatting. Create folders to organize your thoughts!</p><p><strong>Pro tip:</strong> You can resize the sidebar by dragging the left edge!</p>',
                createdAt: Date.now(),
                updatedAt: Date.now()
              }
            ]
          }
        ],
        activeFolder: 'default',
        activeNote: 'welcome'
      };
      
      chrome.storage.local.set({ noteNestData: initialData });
    }
    
    // Set default sidebar width if not exists
    if (!result.sidebarWidth) {
      chrome.storage.local.set({ sidebarWidth: 400 });
    }
  });
});

// Utility function to handle sidebar toggle
async function toggleSidebarOnTab(tab) {
  console.log('Attempting to toggle sidebar on tab:', tab.url);
  
  // Check if the tab is a restricted URL
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || 
      tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) {
    console.log('Cannot run on restricted URL:', tab.url);
    return;
  }
  
  try {
    // First, test if content script is already injected
    console.log('Testing if content script is ready...');
    await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    console.log('Content script is ready, toggling sidebar');
    await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
  } catch (error) {
    console.log('Content script not ready, injecting...', error.message);
    
    try {
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content_script.js']
      });
      
      console.log('Content script injected, waiting for initialization...');
      
      // Wait longer for content script to initialize, then try toggle
      setTimeout(async () => {
        try {
          console.log('Attempting to toggle sidebar after injection...');
          await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
          console.log('Successfully toggled sidebar');
        } catch (retryError) {
          console.error('Failed to toggle sidebar after injection:', retryError.message);
          
          // Try one more time with a longer delay
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { action: 'toggleSidebar' });
              console.log('Successfully toggled sidebar on second retry');
            } catch (finalError) {
              console.error('Final attempt failed:', finalError.message);
            }
          }, 1000);
        }
      }, 500);
      
    } catch (injectError) {
      console.error('Failed to inject content script:', injectError.message);
      
      // Check if it's a permissions issue
      if (injectError.message.includes('Cannot access')) {
        console.log('This appears to be a permissions issue or restricted page');
      }
    }
  }
}

// Handle toolbar icon click
chrome.action.onClicked.addListener(async (tab) => {
  await toggleSidebarOnTab(tab);
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-sidebar') {
    console.log('Keyboard shortcut triggered:', command);
    
    try {
      // Get current active tab and toggle sidebar
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await toggleSidebarOnTab(tab);
      } else {
        console.error('No active tab found');
      }
    } catch (error) {
      console.error('Error handling keyboard shortcut:', error.message);
    }
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'getData') {
    // Return stored data to sidebar
    chrome.storage.local.get(['noteNestData'], (result) => {
      console.log('Sending data to sidebar:', result.noteNestData ? 'Data found' : 'No data');
      sendResponse(result.noteNestData || {});
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === 'saveData') {
    // Save data from sidebar
    console.log('Saving data to storage');
    chrome.storage.local.set({ noteNestData: request.data }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving data:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError });
      } else {
        console.log('Data saved successfully');
        sendResponse({ success: true });
      }
    });
    return true;
  }
  
  if (request.action === 'contentScriptReady') {
    console.log('Content script reported ready');
    sendResponse({ success: true });
  }
});