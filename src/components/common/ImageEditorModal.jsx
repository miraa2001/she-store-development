import { useEffect, useMemo, useRef, useState } from "react";

const TOOL_BRUSH = "brush";
const TOOL_RECT = "rect";
const TOOL_ERASER = "eraser";

const SIZE_OPTIONS = [
  { id: "thin", label: "رفيع", factor: 0.002, min: 2 },
  { id: "medium", label: "متوسط", factor: 0.004, min: 4 },
  { id: "thick", label: "عريض", factor: 0.007, min: 7 }
];

const COLOR_PRESETS = ["#e11d48", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#111827", "#ffffff"];

function getSupportedType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }
  return "image/png";
}

function getCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * canvas.width) / rect.width,
    y: ((event.clientY - rect.top) * canvas.height) / rect.height
  };
}

function drawRect(ctx, start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  ctx.strokeRect(x, y, w, h);
}

export default function ImageEditorModal({ open, file, onClose, onSave, Icon, disabled = false }) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const activeRef = useRef(false);
  const startPointRef = useRef(null);
  const beforeDrawRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [tool, setTool] = useState(TOOL_BRUSH);
  const [sizeId, setSizeId] = useState("medium");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);
  const outputType = useMemo(() => getSupportedType(file?.type), [file]);

  const lineWidth = useMemo(() => {
    const option = SIZE_OPTIONS.find((item) => item.id === sizeId) || SIZE_OPTIONS[1];
    const canvas = canvasRef.current;
    if (!canvas) return option.min;
    const shortSide = Math.min(canvas.width, canvas.height);
    return Math.max(option.min, Math.round(shortSide * option.factor));
  }, [sizeId, canvasKey]);

  useEffect(() => {
    if (!open || !file) return;
    let revoked = false;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    setLoading(true);
    setError("");
    setIsDirty(false);
    undoStackRef.current = [];
    redoStackRef.current = [];

    img.onload = () => {
      if (revoked) return;
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setCanvasKey((prev) => prev + 1);
      setLoading(false);
    };

    img.onerror = () => {
      if (revoked) return;
      setError("تعذر فتح الصورة للتعديل.");
      setLoading(false);
    };

    img.src = objectUrl;
    return () => {
      revoked = true;
      URL.revokeObjectURL(objectUrl);
      activeRef.current = false;
      startPointRef.current = null;
      beforeDrawRef.current = null;
    };
  }, [open, file]);

  if (!open || !file) return null;

  const canDraw = !disabled && !loading && !saving;

  const beginStroke = (ctx, point) => {
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x + 0.01, point.y + 0.01);
    ctx.stroke();
  };

  const setupStroke = (ctx) => {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = tool === TOOL_ERASER ? "destination-out" : "source-over";
  };

  const restoreStroke = (ctx) => {
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  };

  const handlePointerDown = (event) => {
    if (!canDraw) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const point = getCanvasPoint(canvas, event);
    activeRef.current = true;
    startPointRef.current = point;
    beforeDrawRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.setPointerCapture?.(event.pointerId);

    if (tool === TOOL_BRUSH || tool === TOOL_ERASER) {
      setupStroke(ctx);
      beginStroke(ctx, point);
      restoreStroke(ctx);
    }
  };

  const handlePointerMove = (event) => {
    if (!activeRef.current || !canDraw) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = getCanvasPoint(canvas, event);

    if (tool === TOOL_BRUSH || tool === TOOL_ERASER) {
      setupStroke(ctx);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      restoreStroke(ctx);
      return;
    }

    if (tool === TOOL_RECT && beforeDrawRef.current && startPointRef.current) {
      ctx.putImageData(beforeDrawRef.current, 0, 0);
      setupStroke(ctx);
      drawRect(ctx, startPointRef.current, point);
      restoreStroke(ctx);
    }
  };

  const handlePointerUp = () => {
    if (!activeRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    activeRef.current = false;
    startPointRef.current = null;

    if (!canvas || !ctx || !beforeDrawRef.current) return;
    undoStackRef.current.push(beforeDrawRef.current);
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
    redoStackRef.current = [];
    beforeDrawRef.current = null;
    setIsDirty(true);
  };

  const performUndo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !undoStackRef.current.length) return;

    const previous = undoStackRef.current.pop();
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    redoStackRef.current.push(current);
    ctx.putImageData(previous, 0, 0);
    setIsDirty(true);
  };

  const performRedo = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !redoStackRef.current.length) return;

    const next = redoStackRef.current.pop();
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(current);
    ctx.putImageData(next, 0, 0);
    setIsDirty(true);
  };

  const clearAll = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !imageRef.current) return;

    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStackRef.current.length > 30) undoStackRef.current.shift();
    redoStackRef.current = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
    setIsDirty(false);
  };

  const saveEditedImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas || saving) return;

    setSaving(true);
    setError("");
    try {
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, outputType, outputType === "image/jpeg" || outputType === "image/webp" ? 0.98 : undefined)
      );
      if (!blob) throw new Error("تعذر حفظ الصورة.");

      const edited = new File([blob], file.name, {
        type: outputType,
        lastModified: Date.now()
      });

      await onSave?.(edited);
    } catch (err) {
      console.error(err);
      setError("تعذر حفظ التعديلات على الصورة.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="purchase-modal-backdrop image-editor-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        if (!saving) onClose?.();
      }}
    >
      <div className="purchase-modal-card image-editor-card" onClick={(event) => event.stopPropagation()}>
        <div className="purchase-modal-head image-editor-head">
          <h3>تعديل الصورة</h3>
          <button type="button" className="icon-btn tiny" onClick={onClose} disabled={saving}>
            <Icon name="close" className="icon" />
          </button>
        </div>

        <div className="image-editor-tools">
          <div className="image-editor-group">
            <button
              type="button"
              className={`btn-ghost-light ${tool === TOOL_BRUSH ? "is-active" : ""}`}
              onClick={() => setTool(TOOL_BRUSH)}
              disabled={!canDraw}
            >
              فرشاة
            </button>
            <button
              type="button"
              className={`btn-ghost-light ${tool === TOOL_RECT ? "is-active" : ""}`}
              onClick={() => setTool(TOOL_RECT)}
              disabled={!canDraw}
            >
              مستطيل
            </button>
            <button
              type="button"
              className={`btn-ghost-light ${tool === TOOL_ERASER ? "is-active" : ""}`}
              onClick={() => setTool(TOOL_ERASER)}
              disabled={!canDraw}
            >
              ممحاة
            </button>
          </div>

          <div className="image-editor-group">
            {SIZE_OPTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`btn-ghost-light ${sizeId === item.id ? "is-active" : ""}`}
                onClick={() => setSizeId(item.id)}
                disabled={!canDraw}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="image-editor-group image-editor-colors">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`color-swatch ${color === preset ? "is-active" : ""}`}
                style={{ background: preset }}
                onClick={() => setColor(preset)}
                disabled={!canDraw}
                aria-label={`لون ${preset}`}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              disabled={!canDraw}
              aria-label="اختيار لون مخصص"
            />
          </div>

          <div className="image-editor-group">
            <button type="button" className="btn-ghost-light" onClick={performUndo} disabled={!undoStackRef.current.length || !canDraw}>
              تراجع
            </button>
            <button type="button" className="btn-ghost-light" onClick={performRedo} disabled={!redoStackRef.current.length || !canDraw}>
              إعادة
            </button>
            <button type="button" className="btn-ghost-light" onClick={clearAll} disabled={!canDraw}>
              مسح
            </button>
          </div>
        </div>

        <div className="image-editor-canvas-wrap">
          {loading ? <div className="workspace-empty">جاري تجهيز الصورة...</div> : null}
          <canvas
            ref={canvasRef}
            className={`image-editor-canvas ${loading ? "is-hidden" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        </div>

        {error ? <div className="modal-error">{error}</div> : null}

        <div className="purchase-modal-foot image-editor-foot">
          <button type="button" className="btn-primary" onClick={saveEditedImage} disabled={saving || loading}>
            {saving ? "جاري الحفظ..." : "حفظ الصورة"}
          </button>
          <button type="button" className="btn-ghost-light" onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <span className="image-editor-state">{isDirty ? "تم تعديل الصورة" : "بدون تعديلات"}</span>
        </div>
      </div>
    </div>
  );
}
