import { useEffect, useState, type ReactNode } from 'react';
import { fmt, parseLength } from '../units';

/** A dimension box that reads and writes shop fractions (23 1/4, 23-1/4, 23.25, 2' 6"). */
export function LengthInput(props: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  allowAuto?: boolean;
  placeholder?: string;
}) {
  const { id, value, onChange, min = 0, allowAuto, placeholder } = props;
  const shown = value == null ? '' : fmt(value);
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(shown); setBad(false); }, [shown]);

  const commit = () => {
    if (allowAuto && text.trim() === '') {
      if (value != null) onChange(null);
      return;
    }
    const v = parseLength(text);
    if (v == null || v < min) {
      setBad(true);
      return;
    }
    setBad(false);
    if (Math.abs(v - (value ?? NaN)) > 1e-6 || value == null) onChange(v);
    setText(fmt(v));
  };

  return (
    <input
      id={id}
      className={`len${bad ? ' bad' : ''}`}
      value={text}
      placeholder={placeholder}
      inputMode="decimal"
      spellCheck={false}
      title={bad ? 'Use inches like 23 1/4, 23-1/4 or 23.25' : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); }
        if (e.key === 'Escape') { setText(shown); setBad(false); (e.target as HTMLInputElement).blur(); }
      }}
    />
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="sec">
      <header>
        <h3>{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}
