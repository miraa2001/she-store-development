import { useId, useMemo, useState } from "react";
import "./minimal-input.css";

export default function MinimalInput({
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  disabled = false,
  autoComplete,
  dir = "rtl"
}) {
  const reactId = useId();
  const inputId = useMemo(() => `minimal-input-${name || reactId.replace(/[:]/g, "")}`, [name, reactId]);
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = String(value || "").length > 0;
  const isActive = isFocused || hasValue;

  return (
    <div className={`minimal-input-wrapper ${isActive ? "is-active" : ""}`}>
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        name={name}
        className="minimal-input"
        required
        disabled={disabled}
        autoComplete={autoComplete}
        dir={dir}
      />
      <label className={`minimal-label ${isActive ? "active" : ""}`} htmlFor={inputId}>
        {placeholder}
      </label>
      <span className="minimal-border" aria-hidden="true" />
    </div>
  );
}
