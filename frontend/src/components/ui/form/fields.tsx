"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const FORM_INPUT_CLASSES =
  "w-full border border-foreground/30 bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-brutal-violet aria-[invalid=true]:border-brutal-pink";

export interface FieldLabelProps {
  children: ReactNode;
  htmlFor?: string;
  hint?: string;
}

export function FieldLabel({ children, htmlFor, hint }: FieldLabelProps) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {children}
      </label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export interface TextFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  label?: string;
  hint?: string;
  error?: string | null;
  type?: "text" | "email" | "url" | "search";
  inputMode?: "text" | "decimal" | "numeric";
  disabled?: boolean;
}

export function TextField({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  label,
  hint,
  error,
  type = "text",
  inputMode,
  disabled,
}: TextFieldProps) {
  return (
    <div>
      {label ? <FieldLabel htmlFor={id} hint={hint}>{label}</FieldLabel> : null}
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={FORM_INPUT_CLASSES}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-brutal-pink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface TextareaFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
  hint?: string;
  error?: string | null;
}

export function TextareaField({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  label,
  hint,
  error,
}: TextareaFieldProps) {
  return (
    <div>
      {label ? <FieldLabel htmlFor={id} hint={hint}>{label}</FieldLabel> : null}
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(FORM_INPUT_CLASSES, "resize-none")}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-brutal-pink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | SelectOption>;
  label?: string;
  hint?: string;
  error?: string | null;
}

export function SelectField({
  id,
  value,
  onChange,
  options,
  label,
  hint,
  error,
}: SelectFieldProps) {
  const normalized = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option
  );

  return (
    <div>
      {label ? <FieldLabel htmlFor={id} hint={hint}>{label}</FieldLabel> : null}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(FORM_INPUT_CLASSES, "appearance-none pr-9")}
        >
          {normalized.map((option) => (
            <option key={option.value} value={option.value} className="bg-card">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-brutal-pink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface NumberFieldProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefixIcon?: ReactNode;
  label?: string;
  hint?: string;
  error?: string | null;
}

export function NumberField({
  id,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefixIcon,
  label,
  hint,
  error,
}: NumberFieldProps) {
  const update = (next: number) => {
    const bounded = Math.max(min, max === undefined ? next : Math.min(max, next));
    onChange(bounded);
  };

  return (
    <div>
      {label ? <FieldLabel htmlFor={id} hint={hint}>{label}</FieldLabel> : null}
      <div className="relative">
        {prefixIcon ? (
          <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">
            {prefixIcon}
          </span>
        ) : null}
        <input
          id={id}
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) => update(Number(event.target.value))}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            FORM_INPUT_CLASSES,
            "[appearance:textfield] pr-9",
            prefixIcon ? "pl-9" : "",
            "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          )}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col">
          <button
            type="button"
            aria-label="Increase"
            onClick={() => update(value + step)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Decrease"
            onClick={() => update(value - step)}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-brutal-pink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface AmountFieldProps extends Omit<TextFieldProps, "type"> {
  decimals?: number;
}

export function AmountField({ decimals = 7, ...props }: AmountFieldProps) {
  return (
    <TextField
      {...props}
      inputMode="decimal"
      hint={props.hint ?? `Up to ${decimals} decimal places`}
    />
  );
}

export type AddressFieldProps = TextFieldProps;

export function AddressField(props: AddressFieldProps) {
  return <TextField {...props} maxLength={56} />;
}

export interface DateFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string | null;
}

export function DateField({ id, value, onChange, label, hint, error }: DateFieldProps) {
  return (
    <div>
      {label ? <FieldLabel htmlFor={id} hint={hint}>{label}</FieldLabel> : null}
      <input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(FORM_INPUT_CLASSES, "[color-scheme:dark]")}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-brutal-pink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface CheckboxFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  error?: string | null;
}

export function CheckboxField({ checked, onChange, label, error }: CheckboxFieldProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 shrink-0 accent-brutal-violet"
        aria-invalid={!!error}
      />
      <span>{label}</span>
      {error ? <span className="text-xs text-brutal-pink">{error}</span> : null}
    </label>
  );
}

export interface RadioCardProps {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

export function RadioCard({ title, description, selected, onSelect }: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex-1 border p-4 text-left transition-colors",
        selected
          ? "border-brutal-violet bg-brutal-violet/10"
          : "border-foreground/30 bg-transparent hover:border-foreground/60"
      )}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-brutal-violet bg-brutal-violet" : "border-foreground/30"
          )}
        >
          {selected ? <Check className="size-2.5 text-foreground" aria-hidden="true" /> : null}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
    </button>
  );
}
