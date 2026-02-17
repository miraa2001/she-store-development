import { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";

const OPTIONS = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "arrived", label: "تم وصول الطلب" },
  { value: "at_pickup", label: "الطلب في نقطة الاستلام" },
  { value: "collected", label: "تم التحصيل" }
];

function labelFor(value) {
  return OPTIONS.find((option) => option.value === value)?.label || OPTIONS[0].label;
}

export default function OrderStatusDropdown({
  value = "pending",
  disabled = false,
  lockCollected = false,
  onChange
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedLabel = useMemo(() => labelFor(value), [value]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handlePick = (nextValue) => {
    if (disabled) return;
    if (nextValue === "collected" && !lockCollected) return;
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <StyledWrapper ref={rootRef}>
      <div className={`dropdown ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""}`}>
        <input hidden className="sr-only" name="state-dropdown" id="state-dropdown" type="checkbox" checked={open} readOnly />

        <button
          type="button"
          className="trigger"
          onClick={() => !disabled && setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
        >
          <span className="trigger-title">حالة الطلب</span>
          <span className="trigger-value">{selectedLabel}</span>
        </button>

        <ul className="list webkit-scrollbar" role="listbox" dir="auto" aria-label="اختيار حالة الطلب">
          {OPTIONS.map((option) => {
            const itemDisabled = option.value === "collected" && !lockCollected;
            const selected = value === option.value;
            return (
              <li className="listitem" role="option" aria-selected={selected} key={option.value}>
                <button
                  type="button"
                  className={`article ${selected ? "is-active" : ""}`}
                  onClick={() => handlePick(option.value)}
                  disabled={itemDisabled || disabled}
                >
                  {option.label}
                  {option.value === "collected" && !lockCollected ? <span className="lock-hint">🔒</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div`
  width: min(100%, 298px);

  .dropdown {
    border: 1px solid #b9d2ca;
    border-radius: 12px;
    transition: all 300ms;
    display: flex;
    flex-direction: column;
    min-height: 58px;
    background-color: #ffffff;
    overflow: hidden;
    position: relative;
    inset-inline: auto;
    width: 100%;
  }

  .dropdown.is-open .list {
    opacity: 1;
    transform: translateY(-3rem) scale(1);
    transition: all 500ms ease;
    margin-top: 32px;
    padding-top: 4px;
    margin-bottom: -32px;
  }

  .dropdown:not(.is-open) .list {
    opacity: 0;
    transform: translateY(3rem);
    margin-top: -100%;
    user-select: none;
    height: 0;
    max-height: 0;
    min-height: 0;
    pointer-events: none;
    transition: all 500ms ease-out;
  }

  .trigger {
    cursor: pointer;
    list-style: none;
    user-select: none;
    font-weight: 600;
    color: #1f2937;
    width: 100%;
    display: flex;
    align-items: center;
    flex-flow: row;
    gap: 0.6rem;
    padding: 1rem;
    height: max-content;
    position: relative;
    z-index: 99;
    border: 0;
    border-radius: inherit;
    background-color: #ffffff;
    text-align: right;
    font-family: inherit;
  }

  .trigger:disabled {
    cursor: not-allowed;
    opacity: 0.75;
  }

  .trigger-title {
    color: #3d6f61;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }

  .trigger-value {
    color: #111827;
    font-size: 13px;
    font-weight: 700;
    margin-inline-start: auto;
    text-align: right;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .dropdown.is-open .trigger {
    margin-bottom: 1rem;
  }

  .dropdown.is-open .trigger:before {
    rotate: 90deg;
    transition-delay: 0ms;
  }

  .trigger:before {
    content: "›";
    rotate: -90deg;
    width: 17px;
    height: 17px;
    color: #3d6f61;
    border-radius: 2px;
    font-size: 26px;
    transition: all 350ms ease;
    transition-delay: 85ms;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    order: 3;
    margin-inline-start: 6px;
  }

  .list {
    height: 100%;
    max-height: 20rem;
    width: calc(100% - calc(var(--w-scrollbar) / 2));
    display: grid;
    grid-auto-flow: row;
    overflow: hidden auto;
    gap: 0.7rem;
    padding: 0 1rem;
    margin-right: -8px;
    --w-scrollbar: 8px;
  }

  .listitem {
    height: 100%;
    width: calc(100% + calc(calc(var(--w-scrollbar) / 2) + var(--w-scrollbar)));
    list-style: none;
  }

  .article {
    padding: 0.85rem 1rem;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    text-align: right;
    width: 100%;
    border: 1px solid #b9d2ca;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    background-color: #ffffff;
    color: #1f2937;
    font-family: inherit;
    cursor: pointer;
  }

  .article:hover:not(:disabled) {
    background: #f0f7f4;
    border-color: #4f8a7b;
  }

  .article.is-active {
    background: #eaf4f1;
    border-color: #4f8a7b;
    color: #244b41;
  }

  .article:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .lock-hint {
    font-size: 12px;
    line-height: 1;
  }

  .webkit-scrollbar::-webkit-scrollbar {
    width: var(--w-scrollbar);
    height: var(--w-scrollbar);
    border-radius: 9999px;
  }

  .webkit-scrollbar::-webkit-scrollbar-track {
    background: #0000;
  }

  .webkit-scrollbar::-webkit-scrollbar-thumb {
    background: #0000;
    border-radius: 9999px;
  }

  .webkit-scrollbar:hover::-webkit-scrollbar-thumb {
    background: #b9d2ca;
  }
`;
