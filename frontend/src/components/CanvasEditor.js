import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Stage, Layer, Image } from 'react-konva';

// Import custom icons
import brushIcon from '../assets/brush.png';
import eraserIcon from '../assets/eraser.png';
import clearIcon from '../assets/clear.png';
import resetIcon from '../assets/reset.png';

const CanvasEditor = forwardRef(({
  imageSrc,
  onMaskChange,
  onDrawingChange,
  maskEnabled = true,
  maskMode = true,
  onToggleMode,
  history = [],
  renderToolbar = true, // New prop to control toolbar rendering
  tool: externalTool, // External tool control
  brushSize: externalBrushSize // External brush size control
}, ref) => {
  // State for image and canvas
  const [image, setImage] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  // State for history modal
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // State for drawing
  const [brushSize, setBrushSize] = useState(externalBrushSize || 20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState([]);
  const [currentLine, setCurrentLine] = useState(null);
  const [tool, setTool] = useState(externalTool || 'insert'); // insert | remove | expand | pan
  const isDrawingTool = tool === 'insert' || tool === 'remove';
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef(null);
  const [maskImageData, setMaskImageData] = useState(null);
  const maskUpdateTimeoutRef = useRef(null);
  
  // Refs
  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const imageLayerRef = useRef(null);
  const maskLayerRef = useRef(null);

  // Performance optimization refs
  const currentLineRef = useRef(null);
  const lastPointRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  // Sync external props with internal state
  useEffect(() => {
    if (externalTool !== undefined) {
      setTool(externalTool);
    }
  }, [externalTool]);

  // Debug tool state changes
  useEffect(() => {
    console.log('Tool state changed to:', tool);
  }, [tool]);

  useEffect(() => {
    if (externalBrushSize !== undefined) {
      setBrushSize(externalBrushSize);
    }
  }, [externalBrushSize]);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    clearMask: () => {
      console.log('Clearing mask via ref...');
      setLines([]);
      setCurrentLine(null);
      setMaskImageData(null);
      onMaskChange && onMaskChange(null);
      console.log('Mask cleared via ref successfully');
    },
    resetView: () => {
      console.log('Resetting view via ref...');
      setScale(1);
      setPosition({ x: 0, y: 0 });
      console.log('View reset successfully');
    }
  }));

  // Optimized smooth line drawing with Catmull-Rom splines for better performance
  const drawSmoothLine = (ctx, points, brushSize, mode) => {
    if (points.length < 6) return; // Need at least 3 points for smooth curve

    ctx.save();
    if (mode === 'remove') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#FFFF00';
    }

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);

    // Use Catmull-Rom spline for smoother curves with better performance
    const tension = 0.3; // Lower tension for smoother curves
    for (let i = 2; i < points.length - 4; i += 2) {
      const p0x = points[i - 2], p0y = points[i - 1];
      const p1x = points[i], p1y = points[i + 1];
      const p2x = points[i + 2], p2y = points[i + 3];
      const p3x = points[i + 4], p3y = points[i + 5];

      // Catmull-Rom to Bezier conversion
      const c1x = p1x + (p2x - p0x) * tension / 3;
      const c1y = p1y + (p2y - p0y) * tension / 3;
      const c2x = p2x - (p3x - p1x) * tension / 3;
      const c2y = p2y - (p3y - p1y) * tension / 3;

      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2x, p2y);
    }

    // Handle remaining points with quadratic curves
    if (points.length >= 6) {
      const lastIndex = points.length - 2;
      ctx.quadraticCurveTo(
        points[lastIndex - 2],
        points[lastIndex - 1],
        points[lastIndex],
        points[lastIndex + 1]
      );
    }

    ctx.stroke();
    ctx.restore();
  };

  // Optimized mask generation with debouncing
  const generateMask = () => {
    if (!image || !maskEnabled) return;

    // Create mask canvas for visual display
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvasSize.width;
    maskCanvas.height = canvasSize.height;
    const maskCtx = maskCanvas.getContext('2d');

    // Draw all completed strokes
    lines.forEach((line) => {
      const { points, brushSize, mode } = line;
      if (points.length >= 4) {
        drawSmoothLine(maskCtx, points, brushSize, mode);
      } else if (points.length >= 2) {
        // Fallback for very short strokes
        maskCtx.save();
        if (mode === 'remove') {
          maskCtx.globalCompositeOperation = 'destination-out';
        } else {
          maskCtx.globalCompositeOperation = 'source-over';
        }
        maskCtx.fillStyle = '#FFFF00';
        maskCtx.beginPath();
        maskCtx.arc(points[0], points[1], brushSize / 2, 0, Math.PI * 2);
        maskCtx.fill();
        maskCtx.restore();
      }
    });

    // Add current line if drawing
    if (currentLine && currentLine.points.length >= 2) {
      const { points, brushSize, mode } = currentLine;
      if (points.length >= 4) {
        drawSmoothLine(maskCtx, points, brushSize, mode);
      } else {
        // Draw a dot for the start
        maskCtx.save();
        if (mode === 'remove') {
          maskCtx.globalCompositeOperation = 'destination-out';
        } else {
          maskCtx.globalCompositeOperation = 'source-over';
        }
        maskCtx.fillStyle = '#FFFF00';
        maskCtx.beginPath();
        maskCtx.arc(points[0], points[1], brushSize / 2, 0, Math.PI * 2);
        maskCtx.fill();
        maskCtx.restore();
      }
    }

    // Convert to image data for Konva display
    const maskImage = new window.Image();
    maskImage.onload = () => {
      setMaskImageData(maskImage);
    };
    maskImage.src = maskCanvas.toDataURL();

    // Generate final masked image for API
    if (lines.length === 0 && !currentLine) {
      onMaskChange && onMaskChange(null);
      return;
    }

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = canvasSize.width;
    baseCanvas.height = canvasSize.height;
    const baseCtx = baseCanvas.getContext('2d');
    baseCtx.drawImage(image, 0, 0, canvasSize.width, canvasSize.height);
    baseCtx.drawImage(maskCanvas, 0, 0);
    
    const dataURL = baseCanvas.toDataURL('image/png', 1.0);
    onMaskChange && onMaskChange(dataURL);
  };
  useEffect(() => {
    if (!imageSrc) return;

    console.log('Loading image:', imageSrc);
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;

    img.onload = () => {
      console.log('Image loaded, dimensions:', img.width, 'x', img.height);
      setImage(img);

      // Calculate aspect ratio and set appropriate canvas size
      const maxWidth = 800;
      const maxHeight = 600;
      let newWidth = img.width;
      let newHeight = img.height;

      if (newWidth > maxWidth) {
        const scale = maxWidth / newWidth;
        newWidth = maxWidth;
        newHeight = Math.floor(img.height * scale);
      }

      if (newHeight > maxHeight) {
        const scale = maxHeight / newHeight;
        newHeight = maxHeight;
        newWidth = Math.floor(newWidth * scale);
      }

      setCanvasSize({
        width: newWidth,
        height: newHeight
      });

      // Reset view and clear any previous drawings
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setLines([]);
      setCurrentLine(null);
    };

    img.onerror = () => {
      console.error('Failed to load image');
    };
  }, [imageSrc]);

  // Watch for changes in lines and generate mask with real-time updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Clear any existing timeout
    if (maskUpdateTimeoutRef.current) {
      clearTimeout(maskUpdateTimeoutRef.current);
    }

    // Generate mask immediately during drawing for real-time feedback
    if (isDrawing) {
      generateMask();
    } else {
      // Debounce mask generation when not drawing
      maskUpdateTimeoutRef.current = setTimeout(() => {
        generateMask();
      }, 50);

      return () => {
        if (maskUpdateTimeoutRef.current) {
          clearTimeout(maskUpdateTimeoutRef.current);
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, currentLine, image, canvasSize, maskEnabled, isDrawing]);

  const handleMouseDown = (e) => {
    if (!image) return;
    if (e.evt.button !== 0) return; // only left

    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (tool === 'pan') {
      setIsPanning(true);
      panStartRef.current = { pointer: pos, position: { ...position } };
      return;
    }

    if (!isDrawingTool || !maskEnabled) return; // expand not implemented yet or mask disabled

    const transformedPos = {
      x: (pos.x - position.x) / scale,
      y: (pos.y - position.y) / scale
    };

    setIsDrawing(true);
    onDrawingChange && onDrawingChange(true);

    const newLine = {
      points: [transformedPos.x, transformedPos.y],
      brushSize,
      mode: tool === 'remove' ? 'remove' : 'insert'
    };

    // Initialize refs for performance optimization
    currentLineRef.current = newLine;
    lastPointRef.current = transformedPos;
    lastUpdateTimeRef.current = Date.now();

    setCurrentLine(newLine);
  };

  const handleMouseMove = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    if (!point) return;

    if (!maskEnabled) return; // disable interactions when mask off

    if (isPanning && panStartRef.current) {
      const { pointer, position: startPos } = panStartRef.current;
      const dx = point.x - pointer.x;
      const dy = point.y - pointer.y;
      setPosition({ x: startPos.x + dx, y: startPos.y + dy });
      return;
    }

    if (!isDrawing || !currentLineRef.current) return;

    const transformedPoint = {
      x: (point.x - position.x) / scale,
      y: (point.y - position.y) / scale
    };

    // Throttle updates using requestAnimationFrame for smooth performance
    if (animationFrameRef.current) return;

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;

      // Add point smoothing to reduce sharp edges and noise
      if (lastPointRef.current) {
        const distance = Math.sqrt(
          Math.pow(transformedPoint.x - lastPointRef.current.x, 2) +
          Math.pow(transformedPoint.y - lastPointRef.current.y, 2)
        );

        // Only add point if it's far enough from the last point (reduces noise)
        if (distance > 1.5) { // Reduced threshold for smoother lines
          // Use refs to avoid state updates during drawing
          currentLineRef.current.points.push(transformedPoint.x, transformedPoint.y);
          lastPointRef.current = transformedPoint;

          // Update state immediately for real-time feedback
          setCurrentLine({...currentLineRef.current});
        }
      } else {
        currentLineRef.current.points.push(transformedPoint.x, transformedPoint.y);
        lastPointRef.current = transformedPoint;
        setCurrentLine({...currentLineRef.current});
      }
    });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }
    if (!maskEnabled) return;
    if (!isDrawing || !currentLine) return;

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsDrawing(false);
    onDrawingChange && onDrawingChange(false);

    if (currentLine.points.length >= 2) {
      setLines(prev => [...prev, currentLine]);
    }
    setCurrentLine(null);

    // Clean up refs
    currentLineRef.current = null;
    lastPointRef.current = null;
    lastUpdateTimeRef.current = 0;
  };



  const handleWheel = (e) => {
    e.evt.preventDefault();
    
    const scaleBy = 1.1;
    const stage = stageRef.current;
    const oldScale = scale;
    
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale
    };
    
    // Calculate new scale
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    // Calculate new position
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    };
    
    setScale(newScale);
    setPosition(newPos);
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const clearMask = () => {
    console.log('Clearing mask...');

    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setLines([]);
    setCurrentLine(null);
    setMaskImageData(null);
    onMaskChange && onMaskChange(null);

    // Clean up performance refs
    currentLineRef.current = null;
    lastPointRef.current = null;
    lastUpdateTimeRef.current = 0;

    console.log('Mask cleared successfully');
  };

  // History modal functions
  const openHistoryModal = (item) => {
    console.log('Opening history modal with item:', item);
    setSelectedHistoryItem(item);
    setIsHistoryModalOpen(true);
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedHistoryItem(null);
  };

  const downloadImage = (imageUrl, filename = 'generated-image.png') => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Debug modal state changes
  useEffect(() => {
    console.log('Modal state changed:', { isHistoryModalOpen, selectedHistoryItem });
  }, [isHistoryModalOpen, selectedHistoryItem]);


  return (
    <div ref={containerRef} className="canvas-editor">
      <div className="stage-wrapper">
        <Stage
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          ref={stageRef}
        >
          {/* Image Layer */}
          <Layer ref={imageLayerRef}>
            {image && (
              <Image 
                image={image} 
                width={canvasSize.width}
                height={canvasSize.height}
              />
            )}
          </Layer>
          
          {/* Drawing Layer */}
          <Layer ref={maskLayerRef}>
            {/* Display the mask as a single image with proper erasing */}
            {maskImageData && (
              <Image
                image={maskImageData}
                width={canvasSize.width}
                height={canvasSize.height}
                opacity={0.85}
              />
            )}
          </Layer>
        </Stage>


      <div className="hint-text">{image ? (!maskEnabled ? 'Prompt mode: drawing disabled. Switch to Mask mode to paint.' : (tool === 'pan' ? 'Drag to move, scroll to zoom' : 'Draw on image. Scroll to zoom.')) : 'Upload an image to start.'}</div>
  {/* Bottom toolbar only in mask mode and when renderToolbar is true */}
  {maskEnabled && renderToolbar && <div className="bottom-toolbar">
    
          <div className="group">
            <button type="button" className={`${tool === 'insert' ? 'primary active add-btn' : 'primary'} add-btn`} onClick={() => {
              console.log('Add button clicked, current tool:', tool);
              setTool('insert');
              console.log('Tool set to insert');
            }}>
              <img
                src={brushIcon}
                alt="brush"
                style={{
                  width: '16px',
                  height: '16px',
                  marginRight: '6px'
                }}
              />
              Add
            </button>
            <button type="button" className={`${tool === 'remove' ? 'primary active subtract-btn' : 'primary'} subtract-btn`} onClick={() => {
              console.log('Subtract button clicked, current tool:', tool);
              setTool('remove');
              console.log('Tool set to remove');
            }}>
              <img
                src={eraserIcon}
                alt="eraser"
                style={{
                  width: '16px',
                  height: '16px',
                  marginRight: '6px'
                }}
              />
              Subtract
            </button>
          </div>
          <div className="divider-vertical" />
          <div className="brush-size">{brushSize}
            <input
              type="range"
              min="5"
              max="120"
              value={brushSize}
              onChange={e => setBrushSize(parseInt(e.target.value))}
            />
          </div>
          <div className="divider-vertical" />
          <button type="button" onClick={clearMask}>
            <img src={clearIcon} alt="clear" style={{width: '16px', height: '16px', marginRight: '6px'}} />
            Clear Mask
          </button>
          <button type="button" onClick={resetView}>
            <img src={resetIcon} alt="reset" style={{width: '16px', height: '16px', marginRight: '6px'}} />
            Reset
          </button>
          <div className="divider-vertical" />
          <button className="primary new-image-btn" onClick={() => window.location.reload()}>
            <span style={{fontSize: '18px', fontWeight: 'bold', marginRight: '6px'}}>+</span>
            New Image
          </button>
        </div>}
      </div>




      {/* Inline history directly below hint text / toggle */}
      {image && history && history.length > 0 && (
        <div className="inline-history-wrapper">
          <div className="inline-history" role="list">
            {history.map((item, i) => (
              <div
                className="inline-history-card"
                role="listitem"
                key={i}
                title={item.prompt || item.type}
                onClick={() => {
                  console.log('History item clicked:', item);
                  openHistoryModal(item);
                }}
                style={{ cursor: 'pointer' }}
              >
                <img src={item.image} alt={item.type} />
                <span className={`tag tag-${item.type}`}>{item.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Masked Image Preview
      {maskedImagePreview && (
        <div className="mask-preview">
          <h3>Masked Image Preview (This is what will be sent to the API):</h3>
          <img 
            src={maskedImagePreview} 
            alt="Masked Preview" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '400px', 
              border: '1px solid #ff0000',
              marginTop: '15px'
            }} 
          />
          <div style={{ marginTop: '5px', fontSize: '0.9em', color: '#666' }}>
            ⬆️ This is the exact image being sent to the API for processing
          </div>
        </div>
      )} */}

      {/* History Modal */}
      {isHistoryModalOpen && selectedHistoryItem && (() => {
        console.log('Rendering modal with item:', selectedHistoryItem);
        return (
          <div className="history-modal-overlay" onClick={closeHistoryModal}>
          <div className="history-modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button className="history-modal-close" onClick={closeHistoryModal}>
              ×
            </button>

            {/* Image */}
            <div style={{ textAlign: 'center' }}>
              <img
                src={selectedHistoryItem.image}
                alt={selectedHistoryItem.type}
              />
            </div>

            {/* Prompt */}
            {selectedHistoryItem.prompt && (
              <div>
                <h3>Prompt:</h3>
                <p>{selectedHistoryItem.prompt}</p>
              </div>
            )}

            {/* Actions */}
            <div className="history-modal-actions">
              <span className={`tag tag-${selectedHistoryItem.type}`}>
                {selectedHistoryItem.type}
              </span>
              <button
                className="download-btn"
                onClick={() => downloadImage(selectedHistoryItem.image, `generated-${selectedHistoryItem.type}-${Date.now()}.png`)}
              >
                📥 Download
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
});

CanvasEditor.displayName = 'CanvasEditor';

export default CanvasEditor;