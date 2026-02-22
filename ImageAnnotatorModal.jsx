import React, { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import './ImageAnnotatorModal.css';

const ImageAnnotatorModal = ({ open, file, onCancel, onSave }) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const imageUrlRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  
  // Tool states
  const [activeTool, setActiveTool] = useState('brush');
  const [brushSize, setBrushSize] = useState('medium');
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Preset colors
  const presetColors = [
    '#FF0000', // Red
    '#00FF00', // Green
    '#0000FF', // Blue
    '#FFFF00', // Yellow
    '#FF00FF', // Magenta
    '#00FFFF', // Cyan
    '#000000', // Black
    '#FFFFFF', // White
    '#FFA500', // Orange
    '#800080', // Purple
  ];

  // Brush size mapping
  const brushSizes = {
    thin: 2,
    medium: 5,
    thick: 10,
  };

  useEffect(() => {
    if (!open || !file) return;

    let mounted = true;

    const loadImage = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Create object URL from file
        const imageUrl = URL.createObjectURL(file);
        imageUrlRef.current = imageUrl;
        
        // Load image to get dimensions
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            if (!mounted) return;
            
            const originalWidth = img.naturalWidth || img.width;
            const originalHeight = img.naturalHeight || img.height;
            
            console.log('Image loaded:', originalWidth, 'x', originalHeight);
            
            if (originalWidth === 0 || originalHeight === 0) {
              reject(new Error('Invalid image dimensions'));
              return;
            }
            
            setOriginalDimensions({ width: originalWidth, height: originalHeight });

            // Calculate scaled dimensions to fit in modal
            const maxWidth = Math.min(window.innerWidth * 0.85, 1200);
            const maxHeight = Math.min(window.innerHeight * 0.6, 800);
            const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
            
            const displayWidth = Math.floor(originalWidth * scale);
            const displayHeight = Math.floor(originalHeight * scale);

            console.log('Display size:', displayWidth, 'x', displayHeight, 'scale:', scale);

            // Dispose old canvas if exists
            if (fabricCanvasRef.current) {
              fabricCanvasRef.current.dispose();
              fabricCanvasRef.current = null;
            }

            // Initialize Fabric canvas
            const canvas = new fabric.Canvas(canvasRef.current, {
              width: displayWidth,
              height: displayHeight,
              backgroundColor: '#ffffff',
            });

            fabricCanvasRef.current = canvas;

            // Load image into Fabric
            fabric.Image.fromURL(imageUrl, (fabricImg) => {
              if (!mounted || !fabricCanvasRef.current) return;
              
              fabricImg.set({
                scaleX: scale,
                scaleY: scale,
                selectable: false,
                evented: false,
              });
              
              canvas.setBackgroundImage(fabricImg, () => {
                canvas.renderAll();
                if (mounted) {
                  setIsLoading(false);
                }
              });
            }, {
              crossOrigin: 'anonymous'
            });

            // Store metadata for export
            canvas.originalScale = scale;
            canvas.originalWidth = originalWidth;
            canvas.originalHeight = originalHeight;

            resolve();
          };

          img.onerror = (err) => {
            console.error('Image load error:', err);
            reject(new Error('Failed to load image'));
          };
          
          img.src = imageUrl;
        });

      } catch (error) {
        console.error('Error in loadImage:', error);
        if (mounted) {
          setLoadError(error.message || 'Failed to load image');
          setIsLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      mounted = false;
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, [open, file]);

  // Configure brush tool
  const configureBrush = (canvas) => {
    if (!canvas) return;
    
    canvas.isDrawingMode = true;
    canvas.selection = false;
    
    const brush = new fabric.PencilBrush(canvas);
    brush.width = brushSizes[brushSize];
    brush.color = activeTool === 'eraser' ? '#ffffff' : selectedColor;
    
    if (activeTool === 'eraser') {
      // For eraser, we'll use a white brush with destination-out
      // But Fabric's PencilBrush doesn't support compositing directly
      // So we use white color and let user know it erases to white background
      brush.color = '#ffffff';
    }
    
    canvas.freeDrawingBrush = brush;
  };

  // Update tool when active tool or settings change
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove all event listeners first
    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

    if (activeTool === 'brush' || activeTool === 'eraser') {
      configureBrush(canvas);
    } else if (activeTool === 'rectangle') {
      configureRectangle(canvas);
    } else if (activeTool === 'arrow') {
      configureArrow(canvas);
    } else if (activeTool === 'text') {
      configureText(canvas);
    } else if (activeTool === 'select') {
      canvas.isDrawingMode = false;
      canvas.selection = true;
    }
  }, [activeTool, brushSize, selectedColor]);

  // Configure rectangle tool
  const configureRectangle = (canvas) => {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    
    let rect, isDown, origX, origY;

    canvas.on('mouse:down', (options) => {
      isDown = true;
      const pointer = canvas.getPointer(options.e);
      origX = pointer.x;
      origY = pointer.y;
      
      rect = new fabric.Rect({
        left: origX,
        top: origY,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: selectedColor,
        strokeWidth: brushSizes[brushSize],
        selectable: true,
      });
      
      canvas.add(rect);
    });

    canvas.on('mouse:move', (options) => {
      if (!isDown) return;
      const pointer = canvas.getPointer(options.e);
      
      if (pointer.x < origX) {
        rect.set({ left: pointer.x });
      }
      if (pointer.y < origY) {
        rect.set({ top: pointer.y });
      }
      
      rect.set({
        width: Math.abs(pointer.x - origX),
        height: Math.abs(pointer.y - origY),
      });
      
      canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
      isDown = false;
      rect = null;
    });
  };

  // Configure arrow tool
  const configureArrow = (canvas) => {
    canvas.isDrawingMode = false;
    canvas.selection = false;
    
    let line, isDown, origX, origY;

    const makeArrow = (x1, y1, x2, y2) => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLength = 15;
      
      const points = [
        x2 - headLength * Math.cos(angle - Math.PI / 6),
        y2 - headLength * Math.sin(angle - Math.PI / 6),
        x2,
        y2,
        x2 - headLength * Math.cos(angle + Math.PI / 6),
        y2 - headLength * Math.sin(angle + Math.PI / 6),
      ];
      
      return new fabric.Polyline(
        [
          { x: points[0], y: points[1] },
          { x: points[2], y: points[3] },
          { x: points[4], y: points[5] },
        ],
        {
          fill: 'transparent',
          stroke: selectedColor,
          strokeWidth: brushSizes[brushSize],
          selectable: false,
        }
      );
    };

    canvas.on('mouse:down', (options) => {
      isDown = true;
      const pointer = canvas.getPointer(options.e);
      origX = pointer.x;
      origY = pointer.y;
      
      line = new fabric.Line([origX, origY, origX, origY], {
        stroke: selectedColor,
        strokeWidth: brushSizes[brushSize],
        selectable: true,
      });
      
      canvas.add(line);
    });

    canvas.on('mouse:move', (options) => {
      if (!isDown) return;
      const pointer = canvas.getPointer(options.e);
      line.set({ x2: pointer.x, y2: pointer.y });
      canvas.renderAll();
    });

    canvas.on('mouse:up', (options) => {
      if (!isDown) return;
      isDown = false;
      
      const pointer = canvas.getPointer(options.e);
      const arrow = makeArrow(origX, origY, pointer.x, pointer.y);
      canvas.add(arrow);
      canvas.renderAll();
    });
  };

  // Configure text tool
  const configureText = (canvas) => {
    canvas.isDrawingMode = false;
    canvas.selection = false;

    canvas.on('mouse:down', (options) => {
      const pointer = canvas.getPointer(options.e);
      
      const text = new fabric.IText('اضغط للكتابة', {
        left: pointer.x,
        top: pointer.y,
        fill: selectedColor,
        fontSize: 20,
        fontFamily: 'Arial',
        selectable: true,
        editable: true,
      });
      
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      canvas.renderAll();
    });
  };

  // Handle undo
  const handleUndo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const objects = canvas.getObjects();
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1]);
      canvas.renderAll();
    }
  };

  // Handle clear all
  const handleClear = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    
    // Re-add background image
    if (imageUrlRef.current) {
      fabric.Image.fromURL(imageUrlRef.current, (fabricImg) => {
        fabricImg.set({
          scaleX: canvas.originalScale,
          scaleY: canvas.originalScale,
          selectable: false,
          evented: false,
        });
        canvas.setBackgroundImage(fabricImg, canvas.renderAll.bind(canvas));
      }, {
        crossOrigin: 'anonymous'
      });
    }
  };

  // Handle save
  const handleSave = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      setIsLoading(true);

      // Create an offscreen canvas at original resolution
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = originalDimensions.width;
      exportCanvas.height = originalDimensions.height;
      const ctx = exportCanvas.getContext('2d');

      // Scale factor from display to original
      const scaleFactor = 1 / canvas.originalScale;

      // Draw original image
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, originalDimensions.width, originalDimensions.height);
          resolve();
        };
        img.onerror = reject;
        img.src = imageUrlRef.current;
      });

      // Create temporary Fabric canvas for scaling objects
      const tempCanvas = new fabric.Canvas(null, {
        width: originalDimensions.width,
        height: originalDimensions.height,
      });

      // Clone and scale all drawing objects
      const objects = canvas.getObjects();
      for (const obj of objects) {
        const cloned = await new Promise((resolve) => {
          obj.clone((clonedObj) => {
            // Scale the object to original size
            clonedObj.set({
              scaleX: (obj.scaleX || 1) * scaleFactor,
              scaleY: (obj.scaleY || 1) * scaleFactor,
              left: obj.left * scaleFactor,
              top: obj.top * scaleFactor,
            });
            
            // For paths (brush strokes), scale the path points
            if (clonedObj.type === 'path' && clonedObj.path) {
              const path = clonedObj.path;
              clonedObj.path = path.map((point) => {
                return point.map((val, idx) => {
                  if (idx > 0 && typeof val === 'number') {
                    return val * scaleFactor;
                  }
                  return val;
                });
              });
            }
            
            // Scale stroke width
            if (clonedObj.strokeWidth) {
              clonedObj.strokeWidth = clonedObj.strokeWidth * scaleFactor;
            }
            
            resolve(clonedObj);
          });
        });
        
        tempCanvas.add(cloned);
      }

      tempCanvas.renderAll();

      // Draw the Fabric canvas onto the export canvas
      const fabricDataUrl = tempCanvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });

      const fabricImg = new Image();
      await new Promise((resolve, reject) => {
        fabricImg.onload = () => {
          ctx.drawImage(fabricImg, 0, 0);
          resolve();
        };
        fabricImg.onerror = reject;
        fabricImg.src = fabricDataUrl;
      });

      // Convert canvas to blob
      const blob = await new Promise((resolve) => {
        exportCanvas.toBlob(resolve, 'image/png', 1);
      });

      // Create file with original name or add -edited suffix
      const fileName = file.name.replace(/\.[^/.]+$/, '') + '-edited.png';
      const editedFile = new File([blob], fileName, { type: 'image/png' });

      // Cleanup
      tempCanvas.dispose();

      setIsLoading(false);
      onSave(editedFile);
    } catch (error) {
      console.error('Error saving edited image:', error);
      setIsLoading(false);
      alert('فشل في حفظ الصورة المعدلة: ' + error.message);
    }
  };

  if (!open) return null;

  return (
    <div className="image-annotator-overlay">
      <div className="image-annotator-modal">
        <div className="annotator-header">
          <h3>تعديل الصورة</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <div className="annotator-toolbar">
          <div className="tool-section">
            <label>الأداة:</label>
            <div className="tool-buttons">
              <button
                className={activeTool === 'select' ? 'active' : ''}
                onClick={() => setActiveTool('select')}
                title="تحديد"
              >
                <span>👆</span>
              </button>
              <button
                className={activeTool === 'brush' ? 'active' : ''}
                onClick={() => setActiveTool('brush')}
                title="فرشاة"
              >
                <span>🖌️</span>
              </button>
              <button
                className={activeTool === 'eraser' ? 'active' : ''}
                onClick={() => setActiveTool('eraser')}
                title="ممحاة"
              >
                <span>🧹</span>
              </button>
              <button
                className={activeTool === 'rectangle' ? 'active' : ''}
                onClick={() => setActiveTool('rectangle')}
                title="مستطيل"
              >
                <span>▭</span>
              </button>
              <button
                className={activeTool === 'arrow' ? 'active' : ''}
                onClick={() => setActiveTool('arrow')}
                title="سهم"
              >
                <span>➜</span>
              </button>
              <button
                className={activeTool === 'text' ? 'active' : ''}
                onClick={() => setActiveTool('text')}
                title="نص"
              >
                <span>T</span>
              </button>
            </div>
          </div>

          <div className="tool-section">
            <label>السمك:</label>
            <div className="size-buttons">
              <button
                className={brushSize === 'thin' ? 'active' : ''}
                onClick={() => setBrushSize('thin')}
              >
                رفيع
              </button>
              <button
                className={brushSize === 'medium' ? 'active' : ''}
                onClick={() => setBrushSize('medium')}
              >
                متوسط
              </button>
              <button
                className={brushSize === 'thick' ? 'active' : ''}
                onClick={() => setBrushSize('thick')}
              >
                سميك
              </button>
            </div>
          </div>

          <div className="tool-section">
            <label>اللون:</label>
            <div className="color-palette">
              {presetColors.map((color) => (
                <button
                  key={color}
                  className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  title={color}
                />
              ))}
              <button
                className="color-picker-btn"
                onClick={() => setShowColorPicker(!showColorPicker)}
              >
                +
              </button>
            </div>
            {showColorPicker && (
              <div className="custom-color-picker">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="tool-section">
            <button className="action-btn" onClick={handleUndo}>
              ↶ تراجع
            </button>
            <button className="action-btn" onClick={handleClear}>
              🗑️ مسح
            </button>
          </div>
        </div>

        <div className="annotator-canvas-container" ref={containerRef}>
          {isLoading && (
            <div className="loading-indicator">جاري التحميل...</div>
          )}
          {loadError && (
            <div className="error-indicator">
              خطأ: {loadError}
              <br />
              <button onClick={onCancel} style={{ marginTop: '10px' }}>إغلاق</button>
            </div>
          )}
          <canvas ref={canvasRef} />
        </div>

        <div className="annotator-footer">
          <button className="cancel-btn" onClick={onCancel} disabled={isLoading}>
            إلغاء
          </button>
          <button className="save-btn" onClick={handleSave} disabled={isLoading || loadError}>
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageAnnotatorModal;
