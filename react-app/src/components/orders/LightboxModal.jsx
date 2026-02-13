export default function LightboxModal({ lightbox, onClose, onPrev, onNext, Icon }) {
  if (!lightbox.open || !lightbox.images.length) return null;

  return (
    <div className="purchase-modal-backdrop" onClick={onClose}>
      <div className="lightbox-card" onClick={(event) => event.stopPropagation()}>
        <div className="lightbox-head">
          <strong>{lightbox.title}</strong>
          <button type="button" className="icon-btn tiny" onClick={onClose}>
            <Icon name="close" className="icon" />
          </button>
        </div>

        <div className="lightbox-body">
          <button type="button" className="icon-btn" onClick={onPrev}>
            <Icon name="chevron-right" className="icon" />
          </button>

          <img src={lightbox.images[lightbox.index]?.url} alt="صورة" />

          <button type="button" className="icon-btn" onClick={onNext}>
            <Icon name="chevron-left" className="icon" />
          </button>
        </div>
      </div>
    </div>
  );
}
