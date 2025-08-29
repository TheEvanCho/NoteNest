// Content script for NoteNest - injected into every page
// Handles sidebar creation, positioning, and communication

let sidebarIframe = null;
let sidebarVisible = false;
let sidebarWidth = 400; // Default width
let isResizing = false;

console.log('NoteNest content script loaded on:', window.location.href);

// Notify background script that content script is ready
chrome.runtime.sendMessage({ action: 'contentScriptReady' }).catch(() => {
  // Ignore errors if background script isn't ready
});

// Create and inject the sidebar iframe
function createSidebar() {
  if (sidebarIframe) {
    console.log('Sidebar already exists');
    return;
  }

  console.log('Creating sidebar...');

  // Create container for sidebar and resize handle
  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'notenest-container';
  
  // Apply styles one by one to ensure they take effect
  sidebarContainer.style.setProperty('position', 'fixed', 'important');
  sidebarContainer.style.setProperty('top', '0px', 'important');
  sidebarContainer.style.setProperty('right', `${-sidebarWidth}px`, 'important');
  sidebarContainer.style.setProperty('width', `${sidebarWidth}px`, 'important');
  sidebarContainer.style.setProperty('height', '100vh', 'important');
  sidebarContainer.style.setProperty('z-index', '2147483647', 'important');
  sidebarContainer.style.setProperty('transition', 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 'important');
  sidebarContainer.style.setProperty('display', 'flex', 'important');
  sidebarContainer.style.setProperty('pointer-events', 'all', 'important');
  
  console.log('Initial container position:', sidebarContainer.style.right);

  // Create resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.id = 'notenest-resize-handle';
  resizeHandle.style.cssText = `
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 6px !important;
    height: 100% !important;
    background: linear-gradient(90deg, rgba(139, 69, 19, 0.1), rgba(139, 69, 19, 0.3)) !important;
    cursor: col-resize !important;
    z-index: 1 !important;
    border-radius: 0 3px 3px 0 !important;
    transition: background 0.2s ease !important;
  `;

  // Create iframe element
  sidebarIframe = document.createElement('iframe');
  sidebarIframe.id = 'notenest-sidebar';
  sidebarIframe.src = chrome.runtime.getURL('sidebar.html');
  
  // Style the iframe
  sidebarIframe.style.cssText = `
    width: 100% !important;
    height: 100% !important;
    border: none !important;
    background: transparent !important;
    margin-left: 6px !important;
    box-shadow: -5px 0 20px rgba(139, 69, 19, 0.15) !important;
    border-radius: 8px 0 0 8px !important;
  `;

  // Add load event listener to iframe
  sidebarIframe.addEventListener('load', () => {
    console.log('Sidebar iframe loaded successfully');
  });

  sidebarIframe.addEventListener('error', (e) => {
    console.error('Sidebar iframe failed to load:', e);
  });

  // Add resize functionality
  setupResizeHandle(resizeHandle, sidebarContainer);

  // Append elements
  sidebarContainer.appendChild(resizeHandle);
  sidebarContainer.appendChild(sidebarIframe);
  document.body.appendChild(sidebarContainer);

  console.log('Sidebar container created and appended to body');

  // Handle messages from iframe
  window.addEventListener('message', handleIframeMessage);
}

// Setup resize handle functionality
function setupResizeHandle(resizeHandle, container) {
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener('mouseenter', () => {
    resizeHandle.style.background = 'linear-gradient(90deg, rgba(139, 69, 19, 0.2), rgba(139, 69, 19, 0.4)) !important';
  });

  resizeHandle.addEventListener('mouseleave', () => {
    if (!isResizing) {
      resizeHandle.style.background = 'linear-gradient(90deg, rgba(139, 69, 19, 0.1), rgba(139, 69, 19, 0.3)) !important';
    }
  });

  resizeHandle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebarWidth;
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Disable transitions during resize
    container.style.transition = 'none !important';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  });

  function handleMouseMove(e) {
    if (!isResizing) return;
    
    const deltaX = startX - e.clientX; // Inverted because we're resizing from the left
    const newWidth = Math.max(300, Math.min(800, startWidth + deltaX)); // Min 300px, max 800px
    
    sidebarWidth = newWidth;
    container.style.width = `${newWidth}px !important`;
    
    if (sidebarVisible) {
      container.style.right = '0px !important';
    } else {
      container.style.right = `${-newWidth}px !important`;
    }
  }

  function handleMouseUp() {
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    // Re-enable transitions
    const container = document.getElementById('notenest-container');
    if (container) {
      container.style.transition = 'right 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important';
    }
    
    resizeHandle.style.background = 'linear-gradient(90deg, rgba(139, 69, 19, 0.1), rgba(139, 69, 19, 0.3)) !important';
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    // Save the new width
    chrome.storage.local.set({ sidebarWidth: sidebarWidth });
  }
}

// Handle messages from the sidebar iframe
function handleIframeMessage(event) {
  // Ensure message is from our sidebar
  if (event.source !== sidebarIframe?.contentWindow) return;

  const { action, data } = event.data;
  console.log('Content script received iframe message:', action);

  switch (action) {
    case 'getData':
      // Forward request to background script
      chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting data:', chrome.runtime.lastError);
        } else {
          console.log('Forwarding data to sidebar');
          if (sidebarIframe && sidebarIframe.contentWindow) {
            sidebarIframe.contentWindow.postMessage({
              action: 'dataResponse',
              data: response
            }, '*');
          }
        }
      });
      break;

    case 'saveData':
      // Forward save request to background script
      chrome.runtime.sendMessage({ action: 'saveData', data: data }, (response) => {
        if (response?.success) {
          console.log('NoteNest: Data saved successfully');
        } else {
          console.error('NoteNest: Failed to save data', response?.error);
        }
      });
      break;

    case 'closeSidebar':
      console.log('Closing sidebar via iframe message');
      hideSidebar();
      break;
  }
}

// Show the sidebar
function showSidebar() {
  console.log('showSidebar called');
  
  if (!document.getElementById('notenest-container')) {
    createSidebar();
  }
  
  // Load saved width first, then show
  chrome.storage.local.get(['sidebarWidth'], (result) => {
    if (result.sidebarWidth) {
      sidebarWidth = result.sidebarWidth;
    }
    
    const container = document.getElementById('notenest-container');
    if (container) {
      console.log('Showing sidebar container, width:', sidebarWidth);
      
      // Update width
      container.style.setProperty('width', `${sidebarWidth}px`, 'important');
      
      // Force a reflow
      container.offsetHeight;
      
      // Move to visible position
      container.style.setProperty('right', '0px', 'important');
      sidebarVisible = true;
      
      // Debug: Check the actual computed style
      const computedStyle = window.getComputedStyle(container);
      console.log('After setting right to 0px:');
      console.log('- Computed right:', computedStyle.right);
      console.log('- Computed position:', computedStyle.position);
      console.log('- Computed z-index:', computedStyle.zIndex);
      console.log('- Container getBoundingClientRect:', container.getBoundingClientRect());
      
      console.log('Sidebar should now be visible at right: 0px');
    } else {
      console.error('Sidebar container not found when trying to show');
    }
  });
}

// Hide the sidebar
function hideSidebar() {
  console.log('hideSidebar called');
  
  const container = document.getElementById('notenest-container');
  if (container) {
    console.log('Hiding sidebar container, moving to right:', -sidebarWidth);
    
    // Use setProperty to ensure it overrides any existing styles
    container.style.setProperty('right', `${-sidebarWidth}px`, 'important');
    sidebarVisible = false;
    
    // Debug: Check the actual computed style
    setTimeout(() => {
      const computedStyle = window.getComputedStyle(container);
      console.log('After hiding sidebar:');
      console.log('- Computed right:', computedStyle.right);
      console.log('- Container getBoundingClientRect:', container.getBoundingClientRect());
    }, 100);
    
  } else {
    console.log('Sidebar container not found when trying to hide');
  }
}

// Toggle sidebar visibility
function toggleSidebar() {
  console.log('toggleSidebar called, current state:', sidebarVisible);
  
  // Add debugging to check actual container state
  const container = document.getElementById('notenest-container');
  if (container) {
    const computedStyle = window.getComputedStyle(container);
    console.log('Current container position before toggle:');
    console.log('- Style right:', container.style.right);
    console.log('- Computed right:', computedStyle.right);
    console.log('- BoundingClientRect:', container.getBoundingClientRect());
  }
  
  if (sidebarVisible) {
    hideSidebar();
  } else {
    showSidebar();
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  if (request.action === 'ping') {
    console.log('Responding to ping');
    sendResponse({ status: 'ready' });
    return true;
  }
  
  if (request.action === 'toggleSidebar') {
    console.log('Toggling sidebar via message');
    toggleSidebar();
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open
});

// Save data when page is about to unload
window.addEventListener('beforeunload', () => {
  if (sidebarIframe && sidebarVisible && sidebarIframe.contentWindow) {
    // Tell sidebar to save current state
    try {
      sidebarIframe.contentWindow.postMessage({ action: 'saveBeforeUnload' }, '*');
    } catch (error) {
      console.log('Error saving before unload:', error);
    }
  }
});

// Also handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && sidebarIframe && sidebarVisible && sidebarIframe.contentWindow) {
    // Tell sidebar to save when tab becomes hidden
    try {
      sidebarIframe.contentWindow.postMessage({ action: 'saveBeforeUnload' }, '*');
    } catch (error) {
      console.log('Error saving on visibility change:', error);
    }
  }
});

// Prevent conflicts with page styles
(function() {
  const style = document.createElement('style');
  style.textContent = `
    #notenest-container {
      all: initial !important;
    }
    #notenest-sidebar {
      all: initial !important;
    }
    #notenest-resize-handle {
      all: initial !important;
    }
  `;
  document.head.appendChild(style);
})();

console.log('NoteNest content script initialization complete');