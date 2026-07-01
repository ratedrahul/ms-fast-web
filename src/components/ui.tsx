import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useEffect } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "link";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`btn btn--${variant} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function Field({ label, hint, id, className = "", ...rest }: FieldProps) {
  const inputId = id || `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label className="field" htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <input id={inputId} className={`input ${className}`} {...rest} />
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  options: readonly (string | { value: string; label: string })[];
};

export function Select({
  label,
  hint,
  options,
  id,
  className = "",
  ...rest
}: SelectProps) {
  const selectId = id || `s-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label className="field" htmlFor={selectId}>
      <span className="field__label">{label}</span>
      <select id={selectId} className={`input select ${className}`} {...rest}>
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <button
            type="button"
            className="modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function Alert({
  kind = "info",
  children,
}: {
  kind?: "error" | "success" | "info";
  children: ReactNode;
}) {
  return (
    <div className={`alert alert--${kind}`} role={kind === "error" ? "alert" : undefined}>
      {children}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="card card--pad">
      {title && <h1 className="card__title">{title}</h1>}
      {subtitle && <p className="card__subtitle">{subtitle}</p>}
      {children}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading-block">
      <span className="spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
