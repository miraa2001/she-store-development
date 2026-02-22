import { useEffect, useMemo, useState } from "react";
import { ImageEditor } from "@ozdemircibaris/react-image-editor";

function getFileName(baseName, type) {
  const source = String(baseName || "image");
  const nameWithoutExt = source.replace(/\.[^/.]+$/, "") || "image";
  const extFromType = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return `${nameWithoutExt}-edited.${extFromType}`;
}

export default function ImageAnnotatorModal({
  open,
  file,
  onCancel,
  onClose,
  onSave,
  disabled = false
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const closeHandler = onCancel || onClose;

  const imageUrl = useMemo(() => {
    if (!open || !file) return "";
    return URL.createObjectURL(file);
  }, [file, open]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleSave = async (blob) => {
    if (!blob || saving) return;
    setSaving(true);
    setError("");
    try {
      const safeType = blob.type || file?.type || "image/png";
      const editedFile = new File([blob], getFileName(file?.name, safeType), {
        type: safeType,
        lastModified: Date.now()
      });
      await onSave?.(editedFile);
    } catch (saveError) {
      console.error(saveError);
      setError("Failed to save edited image.");
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
        if (!saving && !disabled) closeHandler?.();
      }}
    >
      <div
        className="purchase-modal-card image-editor-card image-editor-card-external"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="purchase-modal-head image-editor-head">
          <h3>Edit image</h3>
          <button
            type="button"
            className="btn-ghost-light"
            onClick={closeHandler}
            disabled={saving || disabled}
          >
            Close
          </button>
        </div>

        <div className="image-editor-external-wrap">
          <ImageEditor imageUrl={imageUrl} onSave={handleSave} onCancel={closeHandler} />
        </div>

        {error ? <div className="modal-error">{error}</div> : null}
      </div>
    </div>
  );
}
