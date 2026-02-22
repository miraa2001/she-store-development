import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import "./ImageAnnotatorModal.css";

const TOOL_BRUSH = "brush";
const TOOL_ERASER = "eraser";
const TOOL_RECT = "rect";

const COLORS = ["#e11d48", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#111827", "#ffffff"];
const SIZE_MAP = { thin: 2, medium: 5, thick: 10 };

function getEditedFileName(name) {
  const base = String(name || "image").replace(/\.[^/.]+$/, "") || "image";
  return `${base}-edited.png`;
}

export default function ImageAnnotatorModal({ open, file, onCancel, onClose, onSave, disabled = false }) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const bgSourceRef = useRef("");
  const closeHandler = onCancel || onClose;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tool, setTool] = useState(TOOL_BRUSH);
  const [size, setSize] = useState("medium");
  const [color, setColor] = useState(COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [meta, setMeta] = useState({ width: 0, height: 0, scale: 1 });

  useEffect(() => {
    if (!open || !file) return undefined;
    let disposed = false;
    const imageUrl = URL.createObjectURL(file);
    const img = new window.Image();

    setLoading(true);
    setError("");

    img.onload = () => {
      if (disposed) return;

      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;
      const maxWidth = Math.max(280, window.innerWidth * 0.82);
      const maxHeight = Math.max(220, window.innerHeight * 0.58);
      const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight, 1);
      const displayWidth = Math.max(1, Math.round(originalWidth * scale));
      const displayHeight = Math.max(1, Math.round(originalHeight * scale));

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: displayWidth,
        height: displayHeight,
        backgroundColor: "#ffffff",
        isDrawingMode: false,
        preserveObjectStacking: true
      });

      fabricRef.current = canvas;
      bgSourceRef.current = imageUrl;
      setMeta({ width: originalWidth, height: originalHeight, scale });

      fabric.Image.fromURL(
        imageUrl,
        (fabricImage) => {
          if (disposed || !fabricRef.current) return;
          fabricImage.set({
            scaleX: scale,
            scaleY: scale,
            selectable: false,
            evented: false,
            excludeFromExport: false
          });
          canvas.setBackgroundImage(fabricImage, canvas.renderAll.bind(canvas));
          setLoading(false);
        },
        { crossOrigin: "anonymous" }
      );
    };

    img.onerror = () => {
      if (disposed) return;
      setError("تعذر تحميل الصورة للتحرير.");
      setLoading(false);
    };

    img.src = imageUrl;

    return () => {
      disposed = true;
      if (fabricRef.current) {
        fabricRef.current.dispose();
        fabricRef.current = null;
      }
      URL.revokeObjectURL(imageUrl);
    };
  }, [file, open]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.off("mouse:down");
    canvas.off("mouse:move");
    canvas.off("mouse:up");

    const brushWidth = SIZE_MAP[size] || SIZE_MAP.medium;
    if (tool === TOOL_BRUSH || tool === TOOL_ERASER) {
      canvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(canvas);
      brush.width = brushWidth;
      brush.color = tool === TOOL_ERASER ? "#ffffff" : color;
      canvas.freeDrawingBrush = brush;
      canvas.selection = false;
      return;
    }

    if (tool === TOOL_RECT) {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      let isDrawing = false;
      let startX = 0;
      let startY = 0;
      let rect = null;

      canvas.on("mouse:down", (event) => {
        isDrawing = true;
        const pointer = canvas.getPointer(event.e);
        startX = pointer.x;
        startY = pointer.y;
        rect = new fabric.Rect({
          left: startX,
          top: startY,
          width: 0,
          height: 0,
          fill: "transparent",
          stroke: color,
          strokeWidth: brushWidth,
          selectable: false,
          evented: false
        });
        canvas.add(rect);
      });

      canvas.on("mouse:move", (event) => {
        if (!isDrawing || !rect) return;
        const pointer = canvas.getPointer(event.e);
        const nextLeft = Math.min(startX, pointer.x);
        const nextTop = Math.min(startY, pointer.y);
        rect.set({
          left: nextLeft,
          top: nextTop,
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY)
        });
        canvas.requestRenderAll();
      });

      canvas.on("mouse:up", () => {
        isDrawing = false;
        rect = null;
      });
    }
  }, [color, size, tool]);

  const handleUndo = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    if (!objects.length) return;
    canvas.remove(objects[objects.length - 1]);
    canvas.requestRenderAll();
  };

  const handleClear = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getObjects().forEach((obj) => canvas.remove(obj));
    canvas.requestRenderAll();
  };

  const handleSave = async () => {
    if (saving || disabled) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    setSaving(true);
    setError("");

    try {
      const exportCanvas = new fabric.Canvas(null, {
        width: meta.width,
        height: meta.height,
        backgroundColor: "#ffffff"
      });

      const scaleFactor = 1 / meta.scale;
      if (bgSourceRef.current) {
        await new Promise((resolve, reject) => {
          fabric.Image.fromURL(
            bgSourceRef.current,
            (img) => {
              if (!img) {
                reject(new Error("Background image load failed"));
                return;
              }
              img.set({
                left: 0,
                top: 0,
                scaleX: 1,
                scaleY: 1,
                selectable: false,
                evented: false
              });
              exportCanvas.setBackgroundImage(img, exportCanvas.renderAll.bind(exportCanvas));
              resolve();
            },
            { crossOrigin: "anonymous" }
          );
        });
      }

      const objects = canvas.getObjects();
      for (const obj of objects) {
        await new Promise((resolve) => {
          obj.clone((clonedObj) => {
            clonedObj.set({
              left: (obj.left || 0) * scaleFactor,
              top: (obj.top || 0) * scaleFactor,
              scaleX: (obj.scaleX || 1) * scaleFactor,
              scaleY: (obj.scaleY || 1) * scaleFactor,
              strokeWidth: (obj.strokeWidth || 1) * scaleFactor
            });
            exportCanvas.add(clonedObj);
            resolve();
          });
        });
      }

      exportCanvas.renderAll();
      const dataUrl = exportCanvas.toDataURL({ format: "png", quality: 1, multiplier: 1 });
      const blob = await (await fetch(dataUrl)).blob();
      exportCanvas.dispose();

      const editedFile = new File([blob], getEditedFileName(file.name), {
        type: "image/png",
        lastModified: Date.now()
      });
      onSave?.(editedFile);
    } catch (saveError) {
      console.error(saveError);
      setError("تعذر حفظ الصورة المعدلة.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !file) return null;

  return (
    <div className="image-annotator-overlay" onClick={() => !saving && !disabled && closeHandler?.()}>
      <div className="image-annotator-modal" onClick={(event) => event.stopPropagation()}>
        <div className="annotator-header">
          <h3>تعديل الصورة</h3>
          <button type="button" className="close-btn" onClick={closeHandler} disabled={saving || disabled}>
            ×
          </button>
        </div>

        <div className="annotator-toolbar">
          <div className="tool-section">
            <label>الأداة</label>
            <div className="tool-buttons">
              <button type="button" className={tool === TOOL_BRUSH ? "active" : ""} onClick={() => setTool(TOOL_BRUSH)}>
                فرشاة
              </button>
              <button type="button" className={tool === TOOL_ERASER ? "active" : ""} onClick={() => setTool(TOOL_ERASER)}>
                ممحاة
              </button>
              <button type="button" className={tool === TOOL_RECT ? "active" : ""} onClick={() => setTool(TOOL_RECT)}>
                مستطيل
              </button>
            </div>
          </div>

          <div className="tool-section">
            <label>السُمك</label>
            <div className="size-buttons">
              <button type="button" className={size === "thin" ? "active" : ""} onClick={() => setSize("thin")}>
                رفيع
              </button>
              <button type="button" className={size === "medium" ? "active" : ""} onClick={() => setSize("medium")}>
                متوسط
              </button>
              <button type="button" className={size === "thick" ? "active" : ""} onClick={() => setSize("thick")}>
                سميك
              </button>
            </div>
          </div>

          <div className="tool-section">
            <label>اللون</label>
            <div className="color-palette">
              {COLORS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`color-swatch ${color === item ? "active" : ""}`}
                  style={{ backgroundColor: item }}
                  onClick={() => setColor(item)}
                />
              ))}
              <button type="button" className="color-picker-btn" onClick={() => setShowColorPicker((prev) => !prev)}>
                +
              </button>
            </div>
            {showColorPicker ? (
              <div className="custom-color-picker">
                <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
              </div>
            ) : null}
          </div>

          <div className="tool-section">
            <button type="button" className="action-btn" onClick={handleUndo}>
              تراجع
            </button>
            <button type="button" className="action-btn" onClick={handleClear}>
              مسح
            </button>
          </div>
        </div>

        <div className="annotator-canvas-container">
          {loading ? <div className="loading-indicator">جاري تحميل الصورة...</div> : null}
          <canvas ref={canvasElRef} />
        </div>

        {error ? <div className="annotator-error">{error}</div> : null}

        <div className="annotator-footer">
          <button type="button" className="cancel-btn" onClick={closeHandler} disabled={saving || disabled}>
            إلغاء
          </button>
          <button type="button" className="save-btn" onClick={handleSave} disabled={loading || saving || disabled}>
            {saving ? "جاري الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>
    </div>
  );
}
