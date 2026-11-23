import { useState, type FormEvent } from 'react';

interface Props {
  /** Says where the task will land: "Add a task for today", "Add a task to Home". */
  placeholder: string;
  onAdd(title: string): void;
}

/**
 * The input at the top of a list. Enter adds and keeps focus here, so several
 * tasks can go in one after another without reaching for the mouse.
 */
export function QuickAdd({ placeholder, onAdd }: Props) {
  const [title, setTitle] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
  };

  return (
    <form className="quick-add" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="quick-add-title">
        {placeholder}
      </label>
      <input
        id="quick-add-title"
        className="quick-add__input text-input"
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button type="submit" className="button button--primary">
        Add
      </button>
    </form>
  );
}
