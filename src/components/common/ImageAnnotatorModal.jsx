import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Image as KonvaImage, Layer, Line, Rect, Stage } from "react-konva";

const TOOL_BRUSH = "brush";
const TOOL_ERASER = "eraser";
const TOOL_RECT = "rect";

const SIZE_OPTIONS = [
  { id: "thin", label: "Thin", factor: 0.0025, min: 2 },
  { id: "medium", label: "Medium", factor: 0.005, min: 4 },
  { id: "thick", label: "Thick", factor: 0.008, min: 7 }
];

const COLOR_PRESETS = ["#e11d48", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#111827", "#ffffff"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getSupportedType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp") {
    return normalized;
  }
  return "image/png";
}

function getEditedFileName(originalName, outputType) {
  if (!originalName) return outputType === "image/png" ? "edited-image.png" : "edited-image.jpg";
  if (outputType === "image/png" && !/\.png$/i.test(originalName)) {
    const base = originalName.replace(/\.[^/.]+$/, "");
    return `${base || "image"}-edited.png`;
  }
  return originalName;
}

function computeViewBox(imgW, imgH) {
  const maxW = Math.max(280, window.innerWidth - 96);
  const maxH = Math.max(220, window.innerHeight - 360);
  const scale = Math.min(maxW / imgW, maxH / imgH, 1);
  return {
    scale,
    stageW: Math.max(1, Math.round(imgW * scale)),
    stageH: Math.max(1, Math.round(imgH * scale))
  };
}

function pointsToStage(points, scale) {
  const out = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push(points[i] * scale, points[i + 1] * scale);
  }
  return out;
}

function rectFromStartEnd(startX, startY, endX, endY) {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    w: Math.abs(endX - startX),
    h: Math.abs(endY - startY)
  };
}

function toImagePoint(stage, nativeEvent, scale, imgW, imgH) {
  stage.setPointersPositions(nativeEvent);
  const pos = stage.getPointerPosition();
  if (!pos) return null;
  return {
    x: clamp(pos.x / scale, 0, imgW),
    y: clamp(pos.y / scale, 0, imgH)
  };
}

function renderOps(layer, ops) {
  ops.forEach((op) => {
    if (op.kind === "stroke") {
      layer.add(
        new Konva.Line({
          points: op.points,
          stroke: op.color,
          strokeWidth: op.width,
          lineCap: "round",
          lineJoin: "round",
          globalCompositeOperation: op.tool === TOOL_ERASER ? "destination-out" : "source-over",
          listening: false
        })
      );
      return;
    }

    layer.add(
      new Konva.Rect({
        x: op.x,
        y: op.y,
        width: op.w,
        height: op.h,
        stroke: op.color,
        strokeWidth: op.width,
        fillEnabled: false,
        listening: false
      })
    );
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to export image blob."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export default function ImageAnnotatorModal({
  open,
  file,
  onCancel,
  onClose,
  onSave,
  Icon,
  disabled = false
}) {
  const closeHandler = onCancel || onClose;
  const stageRef = useRef(null);
  const draftLayerRef = useRef(null);
  const draftLineRef = useRef(null);
  const draftRectRef = useRef(null);
  const activeRef = useRef(false);
  const draftOpRef = useRef(null);
  const pendingPointRef = useRef(null);
  const rafRef = useRef(0);

  const [tool, setTool] = useState(TOOL_BRUSH);
  const [sizeId, setSizeId] = useState("medium");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ops, setOps] = useState([]);
  const [imageMeta, setImageMeta] = useState(null);
  const [view, setView] = useState({ scale: 1, stageW: 0, stageH: 0 });

  const outputType = useMemo(() => getSupportedType(file?.type), [file]);
  const isDirty = ops.length > 0;
  const canDraw = open && !disabled && !loading && !saving && !!imageMeta;

  const strokeWidth = useMemo(() => {
    const option = SIZE_OPTIONS.find((entry) => entry.id === sizeId) || SIZE_OPTIONS[1];
    const shortSide = imageMeta ? Math.min(imageMeta.width, imageMeta.height) : 1000;
    return Math.max(option.min, Math.round(shortSide * option.factor));
  }, [imageMeta, sizeId]);

  useEffect(() => {
    if (!open || !file) return undefined;
    let disposed = false;
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();

    setLoading(true);
    setError("");
    setOps([]);

    img.onload = () => {
      if (disposed) return;
      const meta = { image: img, width: img.naturalWidth, height: img.naturalHeight };
      setImageMeta(meta);
      setView(computeViewBox(meta.width, meta.height));
      setLoading(false);
    };

    img.onerror = () => {
      if (disposed) return;
      setError("Unable to open this image for editing.");
      setLoading(false);
    };

    img.src = objectUrl;

    return () => {
      disposed = true;
      URL.revokeObjectURL(objectUrl);
      activeRef.current = false;
      draftOpRef.current = null;
      pendingPointRef.current = null;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [file, open]);

  useEffect(() => {
    if (!open || !imageMeta) return undefined;
    const onResize = () => setView(computeViewBox(imageMeta.width, imageMeta.height));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [imageMeta, open]);

  useEffect(() => {
    if (!open || !imageMeta) return undefined;
    const stage = stageRef.current?.getStage?.();
    if (!stage) return undefined;
    const container = stage.container();
    if (!container) return undefined;
    container.style.touchAction = "none";

    const renderDraftFrame = () => {
      rafRef.current = 0;
      if (!activeRef.current || !pendingPointRef.current || !imageMeta) return;
      const point = pendingPointRef.current;
      const draft = draftOpRef.current;
      if (!draft) return;

      if (draft.kind === "stroke") {
        draft.points.push(point.x, point.y);
        const lineNode = draftLineRef.current;
        if (lineNode) {
          lineNode.points(pointsToStage(draft.points, view.scale));
        }
      } else if (draft.kind === "rect") {
        draft.endX = point.x;
        draft.endY = point.y;
        const rectNode = draftRectRef.current;
        if (rectNode) {
          const nextRect = rectFromStartEnd(draft.startX, draft.startY, draft.endX, draft.endY);
          rectNode.x(nextRect.x * view.scale);
          rectNode.y(nextRect.y * view.scale);
          rectNode.width(nextRect.w * view.scale);
          rectNode.height(nextRect.h * view.scale);
        }
      }

      draftLayerRef.current?.batchDraw();
    };

    const scheduleFrame = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(renderDraftFrame);
    };

    const finishCurrentOperation = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }

      const draft = draftOpRef.current;
      draftOpRef.current = null;
      pendingPointRef.current = null;

      const lineNode = draftLineRef.current;
      const rectNode = draftRectRef.current;
      if (lineNode) lineNode.visible(false);
      if (rectNode) rectNode.visible(false);
      draftLayerRef.current?.batchDraw();

      if (!draft) return;

      if (draft.kind === "stroke" && draft.points.length >= 2) {
        const points = [...draft.points];
        if (points.length === 2) {
          points.push(points[0], points[1]);
        }
        setOps((prev) => [...prev, { ...draft, points }]);
      }

      if (draft.kind === "rect") {
        const rect = rectFromStartEnd(draft.startX, draft.startY, draft.endX, draft.endY);
        if (rect.w >= 1 && rect.h >= 1) {
          setOps((prev) => [...prev, { kind: "rect", color: draft.color, width: draft.width, ...rect }]);
        }
      }
    };

    const onPointerDown = (event) => {
      if (!canDraw) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      const point = toImagePoint(stage, event, view.scale, imageMeta.width, imageMeta.height);
      if (!point) return;

      activeRef.current = true;

      if (tool === TOOL_BRUSH || tool === TOOL_ERASER) {
        draftOpRef.current = {
          kind: "stroke",
          tool,
          color,
          width: strokeWidth,
          points: [point.x, point.y]
        };
        const lineNode = draftLineRef.current;
        if (lineNode) {
          lineNode.visible(true);
          lineNode.globalCompositeOperation(tool === TOOL_ERASER ? "destination-out" : "source-over");
          lineNode.stroke(color);
          lineNode.strokeWidth(strokeWidth * view.scale);
          lineNode.lineCap("round");
          lineNode.lineJoin("round");
          lineNode.points([point.x * view.scale, point.y * view.scale, point.x * view.scale, point.y * view.scale]);
        }
        if (draftRectRef.current) draftRectRef.current.visible(false);
      } else if (tool === TOOL_RECT) {
        draftOpRef.current = {
          kind: "rect",
          color,
          width: strokeWidth,
          startX: point.x,
          startY: point.y,
          endX: point.x,
          endY: point.y
        };
        const rectNode = draftRectRef.current;
        if (rectNode) {
          rectNode.visible(true);
          rectNode.stroke(color);
          rectNode.strokeWidth(strokeWidth * view.scale);
          rectNode.globalCompositeOperation("source-over");
          rectNode.x(point.x * view.scale);
          rectNode.y(point.y * view.scale);
          rectNode.width(0);
          rectNode.height(0);
        }
        if (draftLineRef.current) draftLineRef.current.visible(false);
      }

      draftLayerRef.current?.batchDraw();
      container.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (!activeRef.current) return;
      event.preventDefault();
      const point = toImagePoint(stage, event, view.scale, imageMeta.width, imageMeta.height);
      if (!point) return;
      pendingPointRef.current = point;
      scheduleFrame();
    };

    const onPointerUp = (event) => {
      event?.preventDefault?.();
      finishCurrentOperation();
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [canDraw, color, imageMeta, open, strokeWidth, tool, view.scale]);

  const undo = () => {
    setOps((prev) => prev.slice(0, -1));
  };

  const clear = () => {
    if (!ops.length) return;
    setOps([]);
  };

  const exportEditedFile = async () => {
    if (!imageMeta || !file) throw new Error("Unable to prepare image.");

    const mount = document.createElement("div");
    mount.style.position = "fixed";
    mount.style.left = "-10000px";
    mount.style.top = "-10000px";
    mount.style.width = "1px";
    mount.style.height = "1px";
    document.body.appendChild(mount);

    let stage;
    try {
      // Export stage is always 1:1 with original image dimensions so output keeps original resolution.
      stage = new Konva.Stage({
        container: mount,
        width: imageMeta.width,
        height: imageMeta.height
      });

      const baseLayer = new Konva.Layer();
      baseLayer.add(
        new Konva.Image({
          image: imageMeta.image,
          x: 0,
          y: 0,
          width: imageMeta.width,
          height: imageMeta.height,
          listening: false
        })
      );
      stage.add(baseLayer);

      const opsLayer = new Konva.Layer();
      renderOps(opsLayer, ops);
      stage.add(opsLayer);
      stage.draw();

      const canvas = stage.toCanvas({ pixelRatio: 1 });
      const quality = outputType === "image/jpeg" || outputType === "image/webp" ? 1 : undefined;
      const blob = await canvasToBlob(canvas, outputType, quality);
      const fileName = getEditedFileName(file.name, outputType);

      return new File([blob], fileName, {
        type: outputType,
        lastModified: Date.now()
      });
    } finally {
      if (stage) stage.destroy();
      mount.remove();
    }
  };

  const save = async () => {
    if (!open || saving) return;
    setSaving(true);
    setError("");
    try {
      const editedFile = await exportEditedFile();
      onSave?.(editedFile);
    } catch (err) {
      console.error(err);
      setError("Failed to save image edits.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !file) return null;

  return (
    <div
      className="purchase-modal-backdrop image-editor-backdrop"
      onClick={(event) => {
        event.stopPropagation();
        if (!saving) closeHandler?.();
      }}
    >
      <div className="purchase-modal-card image-editor-card" onClick={(event) => event.stopPropagation()}>
        <div className="purchase-modal-head image-editor-head">
          <h3>Edit image</h3>
          <button type="button" className="icon-btn tiny" onClick={closeHandler} disabled={saving}>
            {Icon ? <Icon name="close" className="icon" /> : "×"}
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
              Brush
            </button>
            <button
              type="button"
              className={`btn-ghost-light ${tool === TOOL_ERASER ? "is-active" : ""}`}
              onClick={() => setTool(TOOL_ERASER)}
              disabled={!canDraw}
            >
              Eraser
            </button>
            <button
              type="button"
              className={`btn-ghost-light ${tool === TOOL_RECT ? "is-active" : ""}`}
              onClick={() => setTool(TOOL_RECT)}
              disabled={!canDraw}
            >
              Rectangle
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
                aria-label={`Color ${preset}`}
              />
            ))}
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} disabled={!canDraw} />
          </div>

          <div className="image-editor-group">
            <button type="button" className="btn-ghost-light" onClick={undo} disabled={!canDraw || !ops.length}>
              Undo
            </button>
            <button type="button" className="btn-ghost-light" onClick={clear} disabled={!canDraw || !ops.length}>
              Clear
            </button>
          </div>
        </div>

        <div className="image-editor-canvas-wrap image-editor-stage-wrap">
          {loading || !imageMeta ? (
            <div className="workspace-empty">Preparing image…</div>
          ) : (
            <Stage ref={stageRef} width={view.stageW} height={view.stageH} className="image-editor-stage">
              <Layer listening={false}>
                <KonvaImage image={imageMeta.image} x={0} y={0} width={view.stageW} height={view.stageH} />
              </Layer>

              <Layer listening={false}>
                {ops.map((op, index) => {
                  if (op.kind === "stroke") {
                    return (
                      <Line
                        key={`op-${index}`}
                        points={pointsToStage(op.points, view.scale)}
                        stroke={op.color}
                        strokeWidth={op.width * view.scale}
                        lineCap="round"
                        lineJoin="round"
                        globalCompositeOperation={op.tool === TOOL_ERASER ? "destination-out" : "source-over"}
                      />
                    );
                  }

                  return (
                    <Rect
                      key={`op-${index}`}
                      x={op.x * view.scale}
                      y={op.y * view.scale}
                      width={op.w * view.scale}
                      height={op.h * view.scale}
                      stroke={op.color}
                      strokeWidth={op.width * view.scale}
                      fillEnabled={false}
                    />
                  );
                })}
              </Layer>

              <Layer ref={draftLayerRef} listening={false}>
                <Line ref={draftLineRef} visible={false} />
                <Rect ref={draftRectRef} visible={false} fillEnabled={false} />
              </Layer>
            </Stage>
          )}
        </div>

        {error ? <div className="modal-error">{error}</div> : null}

        <div className="purchase-modal-foot image-editor-foot">
          <button type="button" className="btn-primary" onClick={save} disabled={saving || loading || !imageMeta}>
            {saving ? "Saving..." : "Save"}
          </button>
          <button type="button" className="btn-ghost-light" onClick={closeHandler} disabled={saving}>
            Cancel
          </button>
          <span className="image-editor-state">{isDirty ? "Edited" : "No changes"}</span>
        </div>
      </div>
    </div>
  );
}
