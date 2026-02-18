import { useEffect, useMemo, useRef } from "react";

function toImageUrl(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  return image.url || "";
}

export default function LightboxModal({ lightbox, onClose, onPrev, onNext, Icon }) {
  const images = useMemo(() => {
    return (lightbox.images || []).map(toImageUrl).filter(Boolean);
  }, [lightbox.images]);

  const total = images.length;
  const index = total ? ((lightbox.index % total) + total) % total : 0;
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!lightbox.open || total === 0) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (total < 2) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox.open, onClose, onNext, onPrev, total]);

  useEffect(() => {
    if (!lightbox.open || total === 0) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightbox.open, total]);

  if (!lightbox.open || total === 0) return null;

  return (
    <div
      className="purchase-modal-backdrop lightbox-backdrop"
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.changedTouches?.[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (total < 2 || touchStartX.current === null) return;
        const startX = touchStartX.current;
        const endX = event.changedTouches?.[0]?.clientX;
        touchStartX.current = null;
        if (typeof endX !== "number") return;
        const dx = endX - startX;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) onNext();
        else onPrev();
      }}
    >
      <div className="lightbox-card" onClick={(event) => event.stopPropagation()}>
        <div className="lightbox-head">
          <strong>{lightbox.title}</strong>
          <div className="lightbox-head-meta">
            {total > 1 ? (
              <span className="lightbox-count-badge">
                {index + 1}/{total}
              </span>
            ) : null}
            <button type="button" className="icon-btn tiny" onClick={onClose} aria-label="إغلاق">
              <Icon name="close" className="icon" />
            </button>
          </div>
        </div>

        <div className="lightbox-body">
          <img src={images[index]} alt="صورة" />
          {total > 1 ? (
            <>
              <button type="button" className="icon-btn lightbox-nav lightbox-nav-prev" onClick={onPrev} aria-label="الصورة السابقة">
                <Icon name="chevron-right" className="icon" />
              </button>
              <button type="button" className="icon-btn lightbox-nav lightbox-nav-next" onClick={onNext} aria-label="الصورة التالية">
                <Icon name="chevron-left" className="icon" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
