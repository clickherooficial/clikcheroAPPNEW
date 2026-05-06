// Input multi-tag reutilizado pelos passos. Spec: briefing-onboarding

import { forwardRef, useImperativeHandle, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  max?: number;
}

export interface TagInputHandle {
  /** Commits any pending text in the input as a tag. Safe to call from parent before flushing. */
  commit: () => void;
}

export const TagInput = forwardRef<TagInputHandle, TagInputProps>(function TagInput(
  { value, onChange, placeholder, disabled, max = 50 },
  ref,
) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft('');
      return;
    }
    if (value.length >= max) return;
    onChange([...value, v]);
    setDraft('');
  };

  useImperativeHandle(ref, () => ({ commit: add }), [draft, value, max]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={add}
        placeholder={placeholder}
        disabled={disabled || value.length >= max}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag, i) => (
            <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1">
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                  className="ml-1 hover:text-destructive"
                  aria-label={`Remover ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{value.length}/{max}</p>
    </div>
  );
});
