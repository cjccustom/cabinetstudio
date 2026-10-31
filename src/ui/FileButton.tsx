// A button that opens the file picker. The real file input sits invisibly over the button, so the
// tap lands on it directly: some app windows (the Claude desktop and iPad apps) won't open a picker
// for a hidden input clicked from code, or through a label.
import type { ReactNode } from 'react';

export function FileButton({ children, accept, multiple, capture, disabled, className = '', onFiles }: {
  children: ReactNode; accept?: string; multiple?: boolean; capture?: 'environment' | 'user'; disabled?: boolean; className?: string;
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <span className={`btn file-pick ${className}${disabled ? ' disabled' : ''}`}>
      {children}
      <input type="file" accept={accept} multiple={multiple} capture={capture} disabled={disabled} aria-label={typeof children === 'string' ? children : undefined}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
    </span>
  );
}
