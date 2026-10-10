import type { ReactNode, Ref } from 'react';
import type { ViewOptions } from '../types/settings';
import type { ListModel } from '../lib/views';
import { QuickAdd } from './QuickAdd';
import { TaskRowList } from './TaskRows';
import { ViewOptionsBar } from './ViewOptionsBar';

interface Props {
  /** `null` while the store hasn't answered yet. */
  list: ListModel | null;
  /** Shown while loading, before the list knows its own title. */
  fallbackTitle: string;
  selectedId: string | null;
  /** Shown only in the narrow layout, where the sidebar is a drawer. */
  onOpenMenu: (() => void) | null;
  menuButtonRef: Ref<HTMLButtonElement>;
  headingRef: Ref<HTMLHeadingElement>;
  /** Extra header controls — a project's Edit button. */
  headerActions?: ReactNode;
  /** Notices about the list as a whole — sample tasks. Shown under the header. */
  notices?: ReactNode;
  /** Content between the header and the list — a project's inline editor. */
  beforeList?: ReactNode;
  onAdd(title: string): void;
  onToggle(id: string, done: boolean): void;
  onOpen(id: string): void;
  onMove(shown: string[], id: string, toIndex: number): void;
  onOptions(changes: Partial<ViewOptions>): void;
}

/** A view's list: its heading, quick add, the sections, and what's done. */
export function TaskListPanel({
  list,
  fallbackTitle,
  selectedId,
  onOpenMenu,
  menuButtonRef,
  headingRef,
  headerActions,
  notices,
  beforeList,
  onAdd,
  onToggle,
  onOpen,
  onMove,
  onOptions,
}: Props) {
  const handlers = { selectedId, onToggle, onOpen, onMove: list?.options.manual ? onMove : null };

  return (
    <section className="list-panel" aria-labelledby="list-heading">
      <header className="list-panel__header">
        {onOpenMenu && (
          <button
            type="button"
            className="button"
            ref={menuButtonRef}
            onClick={onOpenMenu}
            aria-controls="sidebar"
          >
            Menu
          </button>
        )}
        <h1 id="list-heading" className="list-panel__title" tabIndex={-1} ref={headingRef}>
          {list?.title ?? fallbackTitle}
        </h1>
        {headerActions}
      </header>

      {notices}
      {beforeList}

      {list === null ? (
        <p className="list-panel__message" role="status">
          Loading tasks…
        </p>
      ) : (
        <>
          <QuickAdd placeholder={list.quickAdd.placeholder} onAdd={onAdd} />

          <ViewOptionsBar options={list.options} onChange={onOptions} />

          {list.sections.length === 0 && <p className="list-panel__message">{list.emptyText}</p>}

          {list.sections.map((section) =>
            section.title === null ? (
              <TaskRowList key={section.key} rows={section.rows} {...handlers} />
            ) : (
              <section
                key={section.key}
                className="list-section"
                aria-labelledby={`section-${section.key}`}
              >
                <h2 id={`section-${section.key}`} className="list-section__title">
                  {section.title}
                </h2>
                <TaskRowList rows={section.rows} {...handlers} />
              </section>
            ),
          )}

          {list.completed.length > 0 && (
            <details className="completed-block">
              <summary className="completed-block__summary">
                Completed <span className="completed-block__count">{list.completed.length}</span>
              </summary>
              <TaskRowList rows={list.completed} {...handlers} onMove={null} />
            </details>
          )}
        </>
      )}
    </section>
  );
}
