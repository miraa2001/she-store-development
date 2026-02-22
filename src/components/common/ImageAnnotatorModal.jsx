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

const TEXT_SIZES = {
  thin: 16,
  medium: 24,
  thick: 32
};

const TOOL_OPTIONS = [
  { id: "brush", label: "\u0641\u0631\u0634\u0627\u0629", hint: "Brush" },
  { id: "rectangle", label: "\u0645\u0633\u062A\u0637\u064A\u0644", hint: "Rectangle" },
  { id: "crop", label: "\u0642\u0635 \u062D\u0631", hint: "Crop" },
  { id: "text", label: "\u0646\u0635", hint: "Text" }
];

const SIZE_OPTIONS = [
  { id: "thin", label: "\u0631\u0641\u064A\u0639", hint: "Thin" },
  { id: "medium", label: "\u0645\u062A\u0648\u0633\u0637", hint: "Medium" },
  { id: "thick", label: "\u0633\u0645\u064A\u0643", hint: "Thick" }
];

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

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [canvasReadyTick, setCanvasReadyTick] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [activeTool, setActiveTool] = useState("brush");
  const [brushSize, setBrushSize] = useState("medium");
  const [selectedColor, setSelectedColor] = useState("#FF0000");
  const [showColorPicker, setShowColorPicker] = useState(false);

  const closeHandler = onCancel || onClose;

  useEffect(() => {
    if (!["brush", "rectangle", "crop", "text"].includes(activeTool)) {
      setActiveTool("brush");
    }
  }, [activeTool]);

  useEffect(() => {
    if (!open) return;
    setActiveTool("brush");
    setBrushSize("medium");
    setSelectedColor("#FF0000");
  }, [open]);

  useEffect(() => {
    if (!open || !file) return undefined;

    let mounted = true;
    setIsLoading(true);
    setLoadError("");

    const imageUrl = URL.createObjectURL(file);
    imageUrlRef.current = imageUrl;
    setPreviewUrl(imageUrl);

    const img = new Image();
    img.onload = () => {
      if (!mounted) return;

      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;

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

      setOriginalDimensions({ width: originalWidth, height: originalHeight });
      setDisplayDimensions({ width: displayWidth, height: displayHeight });
      sourceImageRef.current = img;

      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      if (!canvasRef.current) {
        setLoadError("Canvas element not found");
        setIsLoading(false);
        return;
      }

      const canvas = new fabric.Canvas(canvasRef.current, {
        width: displayWidth,
        height: displayHeight,
        backgroundColor: "transparent",
        preserveObjectStacking: true,
        selection: false
      });

      canvas.originalScale = scale;
      canvas.originalWidth = originalWidth;
      canvas.originalHeight = originalHeight;
      fabricCanvasRef.current = canvas;
      setCanvasReadyTick((prev) => prev + 1);

      canvas.requestRenderAll();
      setIsLoading(false);
    };

    img.onerror = () => {
      if (!mounted) return;
      setLoadError("Failed to load image");
      setIsLoading(false);
    };

    img.src = imageUrl;

    return () => {
      mounted = false;
      sourceImageRef.current = null;
      setPreviewUrl("");
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

    canvas.off("path:created");
    canvas.off("mouse:down");
    canvas.off("mouse:move");
    canvas.off("mouse:up");

    if (activeTool === "brush") {
      canvas.isDrawingMode = true;
      canvas.selection = false;

      const brush = new fabric.PencilBrush(canvas);
      brush.width = BRUSH_SIZES[brushSize] || BRUSH_SIZES.medium;
      brush.color = selectedColor;
      canvas.freeDrawingBrush = brush;

      canvas.on("path:created", (event) => {
        const path = event?.path;
        if (!path) return;
        path.set({
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true
        });
        canvas.requestRenderAll();
      });
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
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true
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
        canvas.requestRenderAll();
      });

      canvas.on("mouse:up", () => {
        isDown = false;
        if (rect && (!rect.width || !rect.height)) {
          canvas.remove(rect);
        }
        rect = null;
      });
      return;
    }

    if (activeTool === "crop") {
      canvas.isDrawingMode = false;
      canvas.selection = false;

      let cropRect = null;
      let isDown = false;
      let startX = 0;
      let startY = 0;

      canvas.on("mouse:down", (event) => {
        isDown = true;
        const pointer = canvas.getPointer(event.e);
        startX = pointer.x;
        startY = pointer.y;

        canvas
          .getObjects()
          .filter((object) => object?.isCrop)
          .forEach((object) => canvas.remove(object));

        cropRect = new fabric.Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: "rgba(255,255,255,0.15)",
          stroke: selectedColor,
          strokeWidth: 2,
          strokeDashArray: [8, 6],
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true,
          isCrop: true
        });
        canvas.add(cropRect);
      });

      canvas.on("mouse:move", (event) => {
        if (!isDown || !cropRect) return;
        const pointer = canvas.getPointer(event.e);
        cropRect.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY)
        });
        canvas.requestRenderAll();
      });

      canvas.on("mouse:up", () => {
        isDown = false;
        if (cropRect && (!cropRect.width || !cropRect.height)) {
          canvas.remove(cropRect);
        }
        cropRect = null;
      });
      return;
    }

    if (activeTool === "text") {
      canvas.isDrawingMode = false;
      canvas.selection = false;

      canvas.on("mouse:down", (event) => {
        const nextText = window.prompt("اكتبي النص");
        if (!nextText || !String(nextText).trim()) return;
        const pointer = canvas.getPointer(event.e);
        const textObject = new fabric.Text(String(nextText), {
          left: pointer.x,
          top: pointer.y,
          fill: selectedColor,
          fontSize: TEXT_SIZES[brushSize] || TEXT_SIZES.medium,
          fontFamily: "Arial",
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          lockRotation: true
        });
        canvas.add(textObject);
        canvas.requestRenderAll();
      });
      return;
    }

  }, [activeTool, brushSize, selectedColor, canvasReadyTick]);

  const handleUndo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (!objects.length) return;
    canvas.remove(objects[objects.length - 1]);
    canvas.requestRenderAll();
  };

  const handleClear = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    objects.forEach((object) => canvas.remove(object));
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

      if (!sourceImageRef.current) {
        throw new Error("Missing source image");
      }
      ctx.drawImage(sourceImageRef.current, 0, 0, originalDimensions.width, originalDimensions.height);

      const tempCanvas = new fabric.Canvas(null, {
        width: originalDimensions.width,
        height: originalDimensions.height
      });

      const scaleFactor = 1 / canvas.originalScale;
      const cropObject = canvas.getObjects().find((obj) => obj?.isCrop);
      let cropRegion = null;
      if (cropObject) {
        const rawX = Number(cropObject.left || 0) * scaleFactor;
        const rawY = Number(cropObject.top || 0) * scaleFactor;
        const rawW =
          Number(
            typeof cropObject.getScaledWidth === "function"
              ? cropObject.getScaledWidth()
              : (cropObject.width || 0) * (cropObject.scaleX || 1)
          ) * scaleFactor;
        const rawH =
          Number(
            typeof cropObject.getScaledHeight === "function"
              ? cropObject.getScaledHeight()
              : (cropObject.height || 0) * (cropObject.scaleY || 1)
          ) * scaleFactor;

        const x = Math.max(0, Math.min(originalDimensions.width - 1, Math.round(rawX)));
        const y = Math.max(0, Math.min(originalDimensions.height - 1, Math.round(rawY)));
        const w = Math.max(1, Math.round(rawW));
        const h = Math.max(1, Math.round(rawH));
        const clampedW = Math.max(1, Math.min(w, originalDimensions.width - x));
        const clampedH = Math.max(1, Math.min(h, originalDimensions.height - y));
        cropRegion = { x, y, w: clampedW, h: clampedH };
      }

      const objects = canvas.getObjects().filter((obj) => !obj?.isCrop);
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

      tempCanvas.requestRenderAll();
      const drawingsDataUrl = tempCanvas.toDataURL({ format: "png", quality: 1, multiplier: 1 });
      tempCanvas.dispose();

      const drawingsImage = new Image();
      await new Promise((resolve, reject) => {
        drawingsImage.onload = resolve;
        drawingsImage.onerror = reject;
        drawingsImage.src = drawingsDataUrl;
      });
      ctx.drawImage(drawingsImage, 0, 0);

      let outputCanvas = exportCanvas;
      if (cropRegion) {
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = cropRegion.w;
        croppedCanvas.height = cropRegion.h;
        const croppedCtx = croppedCanvas.getContext("2d");
        if (!croppedCtx) throw new Error("Crop canvas context unavailable");
        croppedCtx.drawImage(
          exportCanvas,
          cropRegion.x,
          cropRegion.y,
          cropRegion.w,
          cropRegion.h,
          0,
          0,
          cropRegion.w,
          cropRegion.h
        );
        outputCanvas = croppedCanvas;
      }

      const blob = await new Promise((resolve, reject) => {
        outputCanvas.toBlob(
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
      setIsLoading(false);
      setLoadError(error?.message || "Failed to save edited image");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="image-annotator-overlay"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        className="image-annotator-modal"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="annotator-header">
          <h3>Edit image</h3>
          <button type="button" className="close-btn" onClick={closeHandler} disabled={disabled || saving}>
            X
          </button>
        </div>

        <div className="annotator-toolbar">
          <div className="tool-section">
            <label>{`\u0627\u0644\u0623\u062F\u0627\u0629:`}</label>
            <div className="tool-buttons">
              {TOOL_OPTIONS.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  className={activeTool === tool.id ? "active" : ""}
                  onClick={() => setActiveTool(tool.id)}
                  aria-label={tool.hint}
                  title={tool.hint}
                >
                  <span className="tool-button-content">
                    <span className="tool-btn-title">{tool.label}</span>
                    <span className="tool-btn-sub">{tool.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="tool-section">
            <label>{`\u0627\u0644\u0633\u0645\u0643:`}</label>
            <div className="size-buttons">
              {SIZE_OPTIONS.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  className={brushSize === size.id ? "active" : ""}
                  onClick={() => setBrushSize(size.id)}
                  aria-label={size.hint}
                  title={size.hint}
                >
                  <span className="tool-button-content">
                    <span className="tool-btn-title">{size.label}</span>
                    <span className="tool-btn-sub">{size.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="tool-section">
            <label>{`\u0627\u0644\u0644\u0648\u0646:`}</label>
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
              {`\u062A\u0631\u0627\u062C\u0639`}
            </button>
            <button type="button" className="action-btn" onClick={handleClear}>
              {`\u0645\u0633\u062D`}
            </button>
          </div>
        </div>

        <div className="annotator-canvas-container">
          {isLoading ? <div className="loading-indicator">Loading...</div> : null}
          {loadError ? (
            <div className="error-indicator">
              Error: {loadError}
              <br />
              <button type="button" onClick={closeHandler} style={{ marginTop: "10px" }}>
                Close
              </button>
            </div>
          ) : null}
          <div
            className="annotator-stage"
            style={{
              width: displayDimensions.width || undefined,
              height: displayDimensions.height || undefined
            }}
          >
            {previewUrl && !loadError ? <img className="annotator-preview-image" src={previewUrl} alt="" draggable={false} /> : null}
            <canvas ref={canvasRef} />
          </div>
        </div>

        <div className="annotator-footer">
          <button type="button" className="cancel-btn" onClick={closeHandler} disabled={isLoading || saving || disabled}>
            Cancel
          </button>
          <button
            type="button"
            className="save-btn"
            onClick={handleSave}
            disabled={isLoading || Boolean(loadError) || saving || disabled}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
