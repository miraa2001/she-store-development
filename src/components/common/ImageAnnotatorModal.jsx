import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import "./ImageAnnotatorModal.css";

const COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#000000",
  "#FFFFFF",
  "#FFA500",
  "#800080"
];

const BRUSH_SIZES = {
  thin: 2,
  medium: 5,
  thick: 10
};

function toEditedFileName(name) {
  const base = String(name || "image").replace(/\.[^/.]+$/, "") || "image";
  return `${base}-edited.png`;
}

export default function ImageAnnotatorModal({
  open,
  file,
  onCancel,
  onClose,
  onSave,
  disabled = false
}) {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const imageUrlRef = useRef(null);
  const sourceImageRef = useRef(null);
  const baseImageObjectRef = useRef(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [activeTool, setActiveTool] = useState("brush");
  const [brushSize, setBrushSize] = useState("medium");
  const [selectedColor, setSelectedColor] = useState("#FF0000");
  const [showColorPicker, setShowColorPicker] = useState(false);

  const closeHandler = onCancel || onClose;

  useEffect(() => {
    if (!open || !file) return undefined;

    let mounted = true;
    setIsLoading(true);
    setLoadError("");

    const imageUrl = URL.createObjectURL(file);
    imageUrlRef.current = imageUrl;

    console.log("File to edit:", file);
    console.log("File type:", file?.type);
    console.log("File size:", file?.size);

    const img = new Image();

    img.onload = () => {
      if (!mounted) return;

      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;
      console.log("Image loaded:", originalWidth, "x", originalHeight);

      if (!originalWidth || !originalHeight) {
        setLoadError("Invalid image dimensions");
        setIsLoading(false);
        return;
      }

      const maxWidth = Math.min(window.innerWidth * 0.85, 1200);
      const maxHeight = Math.min(window.innerHeight * 0.6, 800);
      const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
      const displayWidth = Math.max(1, Math.floor(originalWidth * scale));
      const displayHeight = Math.max(1, Math.floor(originalHeight * scale));
      console.log("Display size:", displayWidth, "x", displayHeight, "scale:", scale);

      setOriginalDimensions({ width: originalWidth, height: originalHeight });

      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      const canvas = new fabric.Canvas(canvasRef.current, {
        width: displayWidth,
        height: displayHeight,
        backgroundColor: "#ffffff"
      });

      canvas.originalScale = scale;
      canvas.originalWidth = originalWidth;
      canvas.originalHeight = originalHeight;
      fabricCanvasRef.current = canvas;

      sourceImageRef.current = img;

      const fabricImg = new fabric.Image(img, {
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        lockMovementX: true,
        lockMovementY: true
      });
      baseImageObjectRef.current = fabricImg;
      canvas.add(fabricImg);
      fabricImg.sendToBack();
      canvas.requestRenderAll();
      if (mounted) setIsLoading(false);
    };

    img.onerror = (error) => {
      if (!mounted) return;
      console.error("Image load error:", error);
      setLoadError("Failed to load image");
      setIsLoading(false);
    };

    img.src = imageUrl;

    return () => {
      mounted = false;
      sourceImageRef.current = null;
      baseImageObjectRef.current = null;
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

  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.off("mouse:down");
    canvas.off("mouse:move");
    canvas.off("mouse:up");

    if (activeTool === "brush" || activeTool === "eraser") {
      canvas.isDrawingMode = true;
      canvas.selection = false;

      const brush = new fabric.PencilBrush(canvas);
      brush.width = BRUSH_SIZES[brushSize] || BRUSH_SIZES.medium;
      brush.color = activeTool === "eraser" ? "#ffffff" : selectedColor;
      canvas.freeDrawingBrush = brush;
      return;
    }

    if (activeTool === "rectangle") {
      canvas.isDrawingMode = false;
      canvas.selection = false;

      let rect = null;
      let isDown = false;
      let startX = 0;
      let startY = 0;

      canvas.on("mouse:down", (event) => {
        isDown = true;
        const pointer = canvas.getPointer(event.e);
        startX = pointer.x;
        startY = pointer.y;

        rect = new fabric.Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: selectedColor,
          strokeWidth: BRUSH_SIZES[brushSize] || BRUSH_SIZES.medium,
          selectable: true
        });
        canvas.add(rect);
      });

      canvas.on("mouse:move", (event) => {
        if (!isDown || !rect) return;
        const pointer = canvas.getPointer(event.e);
        rect.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY)
        });
        canvas.renderAll();
      });

      canvas.on("mouse:up", () => {
        isDown = false;
        rect = null;
      });
    }
  }, [activeTool, brushSize, selectedColor]);

  const handleUndo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (!objects.length) return;
    const removable = objects.filter((object) => object !== baseImageObjectRef.current);
    if (!removable.length) return;
    canvas.remove(removable[removable.length - 1]);
    canvas.renderAll();
  };

  const handleClear = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    objects.forEach((object) => {
      if (object !== baseImageObjectRef.current) {
        canvas.remove(object);
      }
    });
    if (baseImageObjectRef.current) {
      baseImageObjectRef.current.sendToBack();
    }
    canvas.requestRenderAll();
  };

  const handleSave = async () => {
    if (saving || disabled) return;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      setSaving(true);
      setLoadError("");
      setIsLoading(true);

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = originalDimensions.width;
      exportCanvas.height = originalDimensions.height;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context unavailable");

      const scaleFactor = 1 / canvas.originalScale;

      if (!sourceImageRef.current) {
        throw new Error("Missing source image");
      }
      ctx.drawImage(sourceImageRef.current, 0, 0, originalDimensions.width, originalDimensions.height);

      const tempCanvas = new fabric.Canvas(null, {
        width: originalDimensions.width,
        height: originalDimensions.height
      });

      const objects = canvas.getObjects().filter((object) => object !== baseImageObjectRef.current);
      for (const obj of objects) {
        // eslint-disable-next-line no-await-in-loop
        const cloned = await new Promise((resolve) => {
          obj.clone((clonedObj) => {
            clonedObj.set({
              scaleX: (obj.scaleX || 1) * scaleFactor,
              scaleY: (obj.scaleY || 1) * scaleFactor,
              left: (obj.left || 0) * scaleFactor,
              top: (obj.top || 0) * scaleFactor,
              strokeWidth: (obj.strokeWidth || 1) * scaleFactor
            });

            if (clonedObj.type === "path" && clonedObj.path) {
              clonedObj.path = clonedObj.path.map((pathPoint) =>
                pathPoint.map((val, idx) => (idx > 0 && typeof val === "number" ? val * scaleFactor : val))
              );
            }
            resolve(clonedObj);
          });
        });
        tempCanvas.add(cloned);
      }

      tempCanvas.renderAll();
      const drawingsDataUrl = tempCanvas.toDataURL({ format: "png", quality: 1, multiplier: 1 });
      tempCanvas.dispose();

      const drawingsImage = new Image();
      await new Promise((resolve, reject) => {
        drawingsImage.onload = resolve;
        drawingsImage.onerror = reject;
        drawingsImage.src = drawingsDataUrl;
      });
      ctx.drawImage(drawingsImage, 0, 0);

      const blob = await new Promise((resolve, reject) => {
        exportCanvas.toBlob(
          (outputBlob) => {
            if (!outputBlob) {
              reject(new Error("Failed to export edited image"));
              return;
            }
            resolve(outputBlob);
          },
          "image/png",
          1
        );
      });

      const editedFile = new File([blob], toEditedFileName(file.name), {
        type: "image/png",
        lastModified: Date.now()
      });

      setIsLoading(false);
      onSave?.(editedFile);
    } catch (error) {
      console.error("Error saving edited image:", error);
      setIsLoading(false);
      setLoadError(error?.message || "Failed to save edited image");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="image-annotator-overlay">
      <div className="image-annotator-modal">
        <div className="annotator-header">
          <h3>تعديل الصورة</h3>
          <button type="button" className="close-btn" onClick={closeHandler} disabled={disabled || saving}>
            ×
          </button>
        </div>

        <div className="annotator-toolbar">
          <div className="tool-section">
            <label>الأداة:</label>
            <div className="tool-buttons">
              <button type="button" className={activeTool === "brush" ? "active" : ""} onClick={() => setActiveTool("brush")}>
                B
              </button>
              <button type="button" className={activeTool === "eraser" ? "active" : ""} onClick={() => setActiveTool("eraser")}>
                E
              </button>
              <button
                type="button"
                className={activeTool === "rectangle" ? "active" : ""}
                onClick={() => setActiveTool("rectangle")}
              >
                ▭
              </button>
            </div>
          </div>

          <div className="tool-section">
            <label>السُمك:</label>
            <div className="size-buttons">
              <button type="button" className={brushSize === "thin" ? "active" : ""} onClick={() => setBrushSize("thin")}>
                رفيع
              </button>
              <button
                type="button"
                className={brushSize === "medium" ? "active" : ""}
                onClick={() => setBrushSize("medium")}
              >
                متوسط
              </button>
              <button type="button" className={brushSize === "thick" ? "active" : ""} onClick={() => setBrushSize("thick")}>
                سميك
              </button>
            </div>
          </div>

          <div className="tool-section">
            <label>اللون:</label>
            <div className="color-palette">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${selectedColor === color ? "active" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
              <button type="button" className="color-picker-btn" onClick={() => setShowColorPicker((prev) => !prev)}>
                +
              </button>
            </div>
            {showColorPicker ? (
              <div className="custom-color-picker">
                <input type="color" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} />
              </div>
            ) : null}
          </div>

          <div className="tool-section">
            <button type="button" className="action-btn" onClick={handleUndo}>
              ↶ تراجع
            </button>
            <button type="button" className="action-btn" onClick={handleClear}>
              مسح
            </button>
          </div>
        </div>

        <div className="annotator-canvas-container">
          {isLoading ? <div className="loading-indicator">جاري التحميل...</div> : null}
          {loadError ? (
            <div className="error-indicator">
              خطأ: {loadError}
              <br />
              <button type="button" onClick={closeHandler} style={{ marginTop: "10px" }}>
                إغلاق
              </button>
            </div>
          ) : null}
          <canvas ref={canvasRef} />
        </div>

        <div className="annotator-footer">
          <button type="button" className="cancel-btn" onClick={closeHandler} disabled={isLoading || saving || disabled}>
            إلغاء
          </button>
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={isLoading || Boolean(loadError) || saving || disabled}
          >
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
