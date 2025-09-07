import React, { useState } from 'react';
import './App.css';
import ImageUpload from './components/ImageUpload';
import CanvasEditor from './components/CanvasEditor';
import PromptInput from './components/PromptInput';
import { ClipLoader } from 'react-spinners';

// Import icons
import brushIcon from './assets/brush.png';
import eraserIcon from './assets/eraser.png';
import clearIcon from './assets/clear.png';
import resetIcon from './assets/reset.png';
import maskIcon from './assets/mask.png';
import promptIcon from './assets/prompt.png';
import imageIcon from './assets/image.png';
import addIcon from './assets/add.png';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
console.log('API Base URL:', API_BASE_URL);

function App() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [mask, setMask] = useState(window.lastValidMask || null);
  const [editedImage, setEditedImage] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('edit'); // edit, generate
  const [isDrawing, setIsDrawing] = useState(false); // Track drawing status
  const [maskMode, setMaskMode] = useState(true); // true = masked edit, false = whole image prompt edit
  const [activePrompt, setActivePrompt] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalImage, setModalImage] = useState(null);
  const [modalType, setModalType] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [blendImage, setBlendImage] = useState(null); // For image blending feature
  
  // Toolbar states
  const [tool, setTool] = useState('insert'); // insert | remove
  const [brushSize, setBrushSize] = useState(20);

  // Ref to access CanvasEditor methods
  const canvasEditorRef = React.useRef(null);

  // Magic loading messages
  const magicMessages = [
    "✨ Weaving digital magic...",
    "🎨 Painting pixels with AI...",
    "🌟 Crafting your masterpiece...",
    "⚡ Channeling creative energy...",
    "🔮 Consulting the AI oracle...",
    "🎭 Transforming reality...",
    "💫 Manifesting your vision...",
    "🌈 Blending art and algorithm..."
  ];

  // Function to cycle through magic messages
  const startMagicLoading = () => {
    setLoading(true);
    let messageIndex = 0;
    setLoadingMessage(magicMessages[messageIndex]);
    
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % magicMessages.length;
      setLoadingMessage(magicMessages[messageIndex]);
    }, 2000);
    
    // Store interval reference to clear it later
    window.magicMessageInterval = messageInterval;
  };

  const stopMagicLoading = () => {
    setLoading(false);
    if (window.magicMessageInterval) {
      clearInterval(window.magicMessageInterval);
      window.magicMessageInterval = null;
    }
  };

  // Handle image file selection for blending
  const handleBlendImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setBlendImage(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Remove blend image
  const removeBlendImage = () => {
    setBlendImage(null);
    // Reset file input
    const fileInput = document.getElementById('blend-image-input');
    if (fileInput) fileInput.value = '';
  };

  // Handle image blending
  const handleImageBlend = async (prompt) => {
    if (!uploadedImage) {
      alert('Please upload a base image first.');
      return;
    }
    if (!blendImage) {
      alert('Please select an image to blend.');
      return;
    }

    startMagicLoading();
    try {
      const response = await fetch(`${API_BASE_URL}/blend-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseImage: uploadedImage,
          blendImage: blendImage,
          prompt: prompt,
        }),
      });

      const data = await response.json();
      if (data.blended_image) {
        setEditedImage(data.blended_image);
        setHistory([...history, { 
          type: 'blend', 
          image: data.blended_image,
          timestamp: new Date().toISOString(),
          prompt: prompt
        }]);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      stopMagicLoading();
    }
  };

  const handleImageUpload = (image) => {
    setUploadedImage(image);
    setEditedImage(null);
    setGeneratedImage(null);
    // Reset mask when uploading a new image
    setMask(null);
    
    // Reset global flag
    if (window.nanoBananaMaskAvailable !== undefined) {
      window.nanoBananaMaskAvailable = false;
      console.log('Reset mask availability flag on image upload');
    }
  };

  const handleMaskChange = (maskData) => {
    console.log('App: Mask data received:', maskData ? 'Yes' : 'No');
    
    if (maskData) {
      // Store last valid mask in a global variable to prevent it from disappearing
      window.lastValidMask = maskData;
      
      // Set a timeout to check if the mask is still valid after a short delay
      // This helps catch cases where the mask might be cleared accidentally
      setTimeout(() => {
        if (!mask && window.lastValidMask) {
          console.log('Mask was lost, restoring from lastValidMask');
          setMask(window.lastValidMask);
        }
      }, 100);
    }
    
    // Update the mask state
    setMask(maskData);
    
    // Debug info
    if (maskData) {
      console.log('Mask data length:', maskData.length);
      console.log('Mask data prefix:', maskData.substring(0, 50));
    }
  };
  
  const handleDrawingChange = (drawingStatus) => {
    console.log('Drawing status changed:', drawingStatus);
    setIsDrawing(drawingStatus);
    
    // When drawing completes, try to restore mask if needed
    if (!drawingStatus && window.lastValidMask && !mask) {
      console.log('Drawing ended, checking for mask restoration');
      setTimeout(() => {
        if (!mask && window.lastValidMask) {
          console.log('Restoring mask after drawing completion');
          setMask(window.lastValidMask);
        }
      }, 100);
    }
  };
  
  // Effect to monitor and ensure mask persistence
  React.useEffect(() => {
    // Check for mask loss and try to restore
    const checkMask = () => {
      if (!mask && window.lastValidMask && !isDrawing) {
        console.log('Mask persistence check: restoring mask');
        setMask(window.lastValidMask);
      }
    };
    
    // Check immediately and set up periodic checks
    checkMask();
    const interval = setInterval(checkMask, 500);
    
    return () => clearInterval(interval);
  }, [mask, isDrawing]);

  const handlePromptSubmit = async (prompt) => {
    if (!uploadedImage) {
      alert('Please upload an image first.');
      return;
    }
    
    // Check if we have a blend image - prioritize blending
    if (blendImage) {
      await handleImageBlend(prompt);
      return;
    }
    
    // Use current mode: masked or whole image
    if (maskMode) {
      // Original masked flow
    } else {
      // Whole image edit flow (reuse handleEditWhole)
      await handleEditWhole(prompt);
      return;
    }
    
    // Check for mask status
    if (!mask) {
      // First check if we have a stored mask
      if (window.lastValidMask) {
        console.log('Using last valid mask from global storage');
        submitWithMask(prompt, window.lastValidMask);
        return;
      }
      
      const canvasElements = document.querySelectorAll('.konvajs-content canvas');
      const drawingLayer = document.querySelector('.konvajs-content canvas:nth-child(2)');
      
      // Check if a drawing exists but hasn't been processed into a mask yet
      if (window.nanoBananaMaskAvailable) {
        console.log('Mask is available via window flag');
      } else if (canvasElements && canvasElements.length >= 2 && drawingLayer) {
        try {
          // Try to capture the current drawing directly from the canvas
          const mainCanvas = document.createElement('canvas');
          mainCanvas.width = canvasElements[0].width;
          mainCanvas.height = canvasElements[0].height;
          const ctx = mainCanvas.getContext('2d');
          
          // Draw the image layer (background)
          ctx.drawImage(canvasElements[0], 0, 0);
          
          // Draw the mask layer (yellow lines)
          ctx.drawImage(canvasElements[1], 0, 0);
          
          // Add text annotation
          ctx.font = 'bold 16px Arial';
          ctx.fillStyle = '#FF0000';
          ctx.fillText('AUTO-CAPTURED MASK', 10, 20);
          
          const capturedMask = mainCanvas.toDataURL('image/png', 1.0);
          console.log('Auto-captured mask from canvas');
          setMask(capturedMask);
          
          // Continue with submission using the captured mask
          submitWithMask(prompt, capturedMask);
          return;
        } catch (err) {
          console.error('Failed to auto-capture mask:', err);
        }
      }
      
      // If we get here, no mask is available
      alert('Please draw a yellow mask on the image to indicate which areas to edit.');
      return;
    }
    
    // We have a valid mask, continue with submission
    submitWithMask(prompt, mask);
  };
  
  // Helper function to submit with a valid mask
  const submitWithMask = async (prompt, maskData) => {
    console.log('Submitting prompt with mask');
    console.log('Prompt:', prompt);
    console.log('Mask image is present:', !!maskData);
    
    // Display the mask being sent in the console for debugging
    console.log('Mask image data URL (first 100 chars):', maskData.substring(0, 100) + '...');
    
    startMagicLoading();
    
    try {
      console.log('Sending edit request to API...');
      const requestData = {
        image: uploadedImage,
        mask: maskData,  // Use the passed maskData instead of the state variable
        prompt: prompt,
      };
      console.log('Request data prepared, sending to API...');
      
      const response = await fetch(`${API_BASE_URL}/edit-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API responded with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('API response:', data);
      
      // Save all response data for debugging
      window.lastApiResponse = data;
      console.log('Full response saved to window.lastApiResponse');
      
      if (data.edited_image) {
        console.log('Received edited image from API');
        console.log('Prompt used:', data.prompt_used || prompt);
        
        // Log any text responses from the API
        if (data.text_responses && data.text_responses.length > 0) {
          console.log('API text responses:', data.text_responses);
        }
        
        // Log debug info if available
        if (data.debug_info) {
          console.log('Debug info:', data.debug_info);
        }
        
        setEditedImage(data.edited_image);
        
        // Store in history with additional debug info
        setHistory([...history, { 
          type: 'edit', 
          image: data.edited_image,
          timestamp: new Date().toISOString(),
          prompt: prompt,
          fullPrompt: data.prompt_used,
          apiResponses: data.text_responses
        }]);
        
        // Display success message
        console.log('Image successfully edited!');
      } else {
        console.error('API response missing edited_image:', data);
        alert('Error: ' + (data.error || 'No image was generated. Please try again with a different mask or prompt.'));
      }
    } catch (error) {
      console.error('Error during image editing:', error);
      alert('Error: ' + error.message);
    } finally {
      stopMagicLoading();
    }
  };

  const handleGenerate = async (prompt) => {
    startMagicLoading();
    try {
      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (data.generated_image) {
        setGeneratedImage(data.generated_image);
        setHistory([...history, { type: 'generate', image: data.generated_image }]);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      stopMagicLoading();
    }
  };

  const handleEditWhole = async (prompt) => {
    if (!uploadedImage) {
      alert('Please upload an image first.');
      return;
    }

    startMagicLoading();
    try {
      const response = await fetch(`${API_BASE_URL}/edit-whole`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: uploadedImage,
          prompt: prompt,
        }),
      });

      const data = await response.json();
      if (data.edited_image) {
        setEditedImage(data.edited_image);
        setHistory([...history, { type: 'edit-whole', image: data.edited_image }]);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      stopMagicLoading();
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleHistoryClick = (historyItem, index) => {
    console.log('History item clicked:', historyItem);
    console.log('Clicking history item at index:', index);
    
    // Set the clicked image as the current edited result
    setEditedImage(historyItem.image);
    
    // If the history item has a prompt, set it as the active prompt
    if (historyItem.prompt) {
      setActivePrompt(historyItem.prompt);
      console.log('Restored prompt:', historyItem.prompt);
    }
    
    // Show modal with image and download option
    const message = `${historyItem.type.charAt(0).toUpperCase() + historyItem.type.slice(1)} Result${historyItem.prompt ? '\n\nPrompt: ' + historyItem.prompt : ''}`;
    setModalMessage(message);
    setModalImage(historyItem.image);
    setModalType(historyItem.type);
    setShowModal(true);
    
    console.log(`Restored result from history item ${index + 1}: ${historyItem.type}`);
  };

  const downloadImage = () => {
    if (!modalImage) return;
    
    const link = document.createElement('a');
    link.href = modalImage;
    link.download = `nano-banana-${modalType}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`App ${darkMode ? 'dark' : ''}`}>
      <header className="main-header">
        <div className="brand"><h1>Nano-Banana Studio</h1></div>
        <div className="header-actions">
          <button onClick={toggleDarkMode}>{darkMode ? 'Light Mode' : 'Dark Mode'}</button>
        </div>
      </header>
      <div className="main-content single-column">
        <main>
          {activeTab === 'edit' && (
            <div className="edit-section merged-mode">
              {!uploadedImage ? (
                <div className="upload-container">
                  <h2>Upload Image</h2>
                  <ImageUpload onImageUpload={handleImageUpload} />
                </div>
              ) : (
                <div className="unified-editor">

                  <div className="canvas-block">
                    <CanvasEditor
                      ref={canvasEditorRef}
                      imageSrc={uploadedImage}
                      onMaskChange={handleMaskChange}
                      onDrawingChange={handleDrawingChange}
                      maskEnabled={maskMode}
                      renderToolbar={false}
                      tool={tool}
                      brushSize={brushSize}
                    />
                  </div>

                  {/* Inline History directly under canvas hint text */}
                  <div className="history-inline">
                    <div className="history-inline-header">
                      <h3>History {history.length > 0 && <span className="count">{history.length}</span>}</h3>
                    </div>
                    {history.length === 0 ? (
                      <p className="empty-history">No history yet</p>
                    ) : (
                      <div className="history-row inline" role="list">
                        {history.map((item, index) => (
                          <div 
                            className="history-card clickable" 
                            role="listitem" 
                            key={index} 
                            title={`Click to view: ${item.prompt || item.type}`}
                            onClick={() => handleHistoryClick(item, index)}
                            style={{ 
                              cursor: 'pointer',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            <div className="thumb-wrapper">
                              <img src={item.image} alt={item.type} />
                              <span className={`badge badge-${item.type}`}>{item.type}</span>
                            </div>
                            {item.prompt && (
                              <div className="meta" title={item.prompt}>{item.prompt.slice(0,50)}{item.prompt.length>50?'…':''}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* {editedImage && (
                    <div className="result-container unified-result">
                      <h3>Result</h3>
                      <div className="image-comparison">
                        <div className="image-container">
                          <h4>Input{maskMode && mask ? ' (with Mask)' : ''}</h4>
                          <img src={(maskMode && mask) ? mask : uploadedImage} alt="Input" style={{maxWidth:'100%',maxHeight:'300px',border:'1px solid #ccc'}} />
                        </div>
                        <div className="image-container">
                          <h4>Edited</h4>
                          <img src={editedImage} alt="Edited" style={{maxWidth:'100%',maxHeight:'300px',border:'1px solid #ccc'}} />
                        </div>
                      </div>
                    </div>
                  )} */}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'generate' && (
            <div className="generate-section">
              <h2>Generate Image from Text</h2>
              <PromptInput onSubmit={handleGenerate} placeholder="Generate image from text..." />
              {generatedImage && (
                <div className="generated-result">
                  <h3>Generated Image:</h3>
                  <img 
                    src={generatedImage} 
                    alt="Generated" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '500px',
                      border: '1px solid #ccc',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                      margin: '10px 0'
                    }}
                  />
                </div>
              )}
            </div>
          )}
          
          {loading && (
            <div className="loading-overlay">
              <div className="magic-circle"></div>
              <p>{loadingMessage || "✨ Weaving digital magic... ✨"}</p>
            </div>
          )}

          {/* Custom Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>🖼️ Generated Result</h3>
                  <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                </div>
                <div className="modal-body">
                  {/* Display the image */}
                  {modalImage && (
                    <div className="modal-image-container">
                      <img 
                        src={modalImage} 
                        alt={modalType || 'Generated result'} 
                        style={{
                          maxWidth: '100%',
                          maxHeight: '70vh',
                          borderRadius: '12px',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                          objectFit: 'contain',
                          display: 'block',
                          margin: '0 auto'
                        }}
                      />
                    </div>
                  )}
                  {/* Display the message */}
                  <p style={{ 
                    whiteSpace: 'pre-line', 
                    marginTop: modalImage ? '16px' : '0',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    color: '#64748b'
                  }}>
                    {modalMessage}
                  </p>
                </div>
                <div className="modal-footer">
                  {modalImage && (
                    <button 
                      className="modal-btn download-btn" 
                      onClick={downloadImage}
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        marginRight: '12px'
                      }}
                    >
                      📥 Download
                    </button>
                  )}
                  <button className="modal-btn" onClick={() => setShowModal(false)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Toolbar - positioned outside main content for proper fixed positioning */}
      {activeTab === 'edit' && uploadedImage && (
        <div className="merged-interface">
          {/* Toolbar Section */}
          <div className="toolbar-section">
            {/* Mode Toggle Buttons */}
            <div className="mode-toggle-group">
              <button 
                type="button"
                className={maskMode ? 'mode-toggle-btn active' : 'mode-toggle-btn'}
                onClick={() => setMaskMode(true)}
              >
                <img src={maskIcon} alt="mask" className="mode-icon" />
                Mask Mode
              </button>
              <button 
                type="button"
                className={!maskMode ? 'mode-toggle-btn active' : 'mode-toggle-btn'}
                onClick={() => setMaskMode(false)}
              >
                <img src={promptIcon} alt="prompt" className="mode-icon" />
                Prompt Mode
              </button>
            </div>

            <div className="divider-vertical" />

            {/* Status Indicators */}
            <div className="status-group">
              <button 
                className="new-image-btn"
                onClick={() => setUploadedImage(null)}
              >
                <img src={imageIcon} alt="new image" className="btn-icon" />
                New Image
              </button>
              {/* {maskMode && (
                <span className={`mask-status-indicator ${isDrawing ? 'drawing' : (mask ? 'ready' : 'empty')}`}>
                  {isDrawing ? 'Drawing…' : (mask ? 'Mask Ready' : 'Paint Area')}
                </span>
              )} */}
            </div>

            {maskMode && (
              <>
                <div className="divider-vertical" />
                
                <div className="tool-group">
                  <button 
                    className={tool === 'insert' ? 'tool-btn primary active' : 'tool-btn primary'} 
                    onClick={() => setTool('insert')}
                  >
                    <img src={brushIcon} alt="brush" style={{width: '16px', height: '16px', marginRight: '6px'}} />
                    Paint
                  </button>
                  <button 
                    className={tool === 'remove' ? 'tool-btn primary active' : 'tool-btn primary'} 
                    onClick={() => setTool('remove')}
                  >
                    <img src={eraserIcon} alt="eraser" style={{width: '16px', height: '16px', marginRight: '6px'}} />
                    Erase
                  </button>
                </div>
                
                <div className="divider-vertical" />
                
                <div className="brush-control">
                  <span className="brush-size-label">{brushSize}</span>
                  <input
                    type="range"
                    min="5"
                    max="120"
                    value={brushSize}
                    onChange={e => setBrushSize(parseInt(e.target.value))}
                    className="brush-slider"
                  />
                </div>
                
                <div className="divider-vertical" />
                
                <div className="action-buttons">
                  <button 
                    className="tool-btn"
                    onClick={() => {
                      setMask(null);
                      canvasEditorRef.current?.clearMask();
                    }}
                  >
                    <img src={clearIcon} alt="clear" style={{width: '16px', height: '16px', marginRight: '6px'}} />
                    Clear
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    onClick={() => {
                      // Reset view functionality using CanvasEditor ref
                      if (canvasEditorRef.current) {
                        // Reset scale and position
                        canvasEditorRef.current.resetView && canvasEditorRef.current.resetView();
                      }
                    }}
                  >
                    <img src={resetIcon} alt="reset" style={{width: '16px', height: '16px', marginRight: '6px'}} />
                    Reset
                  </button>
                </div>
              </>
            )}
          </div>          {/* Prompt Section */}
          <div className="prompt-section-merged">
            <form onSubmit={(e)=>{e.preventDefault(); handlePromptSubmit(activePrompt);}} className="merged-prompt-form">
              <div className="prompt-input-container">
                {/* Blend image preview */}
                {blendImage && (
                  <div className="blend-image-preview">
                    <img src={blendImage} alt="Blend image" className="blend-preview-img" />
                    <button 
                      type="button" 
                      className="remove-blend-btn" 
                      onClick={removeBlendImage}
                      title="Remove blend image"
                    >
                      ×
                    </button>
                    <span className="blend-label">🎨 Blend Image</span>
                  </div>
                )}
                
                <div className="textarea-container">
                  <textarea
                    value={activePrompt}
                    onChange={e=>setActivePrompt(e.target.value)}
                    placeholder={blendImage ? 'Describe how to blend these images...' : (maskMode ? 'Describe what to add or modify in the masked region...' : 'Describe how to edit the whole image...')}
                    rows={2}
                    className="merged-textarea"
                  />
                  
                  {/* Image blend button - positioned inside textarea */}
                  <label className="blend-image-btn-inside tool-btn" title="Add image to blend">
                    <input
                      id="blend-image-input"
                      type="file"
                      accept="image/*"
                      onChange={handleBlendImageSelect}
                      style={{ display: 'none' }}
                    />
                    <img src={addIcon} alt="add" style={{width: '14px', height: '14px'}} />
                  </label>
                </div>
                
                <button type="submit" className={`generate-btn ${loading ? 'generating' : ''}`}>
                  <span className="btn-icon">✨</span>
                  {loading ? 'Generating...' : (blendImage ? 'Blend' : 'Generate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

  {/* External history removed; now inline within editor */}
    </div>
  );
}

export default App;
