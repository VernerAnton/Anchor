import { useRef, useState, type FormEvent, type Ref } from 'react';
import type { BuildInfo } from '../lib/build';
import type { ProjectNavItem, SidebarModel } from '../lib/sidebar';

interface Props {
  build: BuildInfo;
  model: SidebarModel;
  /** "On this device", "Synced", "Offline"… */
  syncText: string;
  /** The narrow layout's drawer: adds a close control. */
  drawer: boolean;
  closeRef: Ref<HTMLButtonElement>;
  onClose(): void;
  onCreateProject(name: string): void;
}

function Count({ count }: { count: number }) {
  return count > 0 ? <span className="nav-list__count">{count}</span> : null;
}

/** Navigation: the views, the projects, and the build stamp. */
export function Sidebar({ build, model, syncText, drawer, closeRef, onClose, onCreateProject }: Props) {
  const { views, projects, archived, labels, manageLabels, settings } = model;
  const classes = ['sidebar'];
  if (drawer) classes.push('sidebar--drawer');

  return (
    <nav id="sidebar" className={classes.join(' ')} aria-label="Views and projects">
      <div className="sidebar__header">
        <p className="sidebar__name">Anchor</p>
        {drawer && (
          <button type="button" className="button" ref={closeRef} onClick={onClose}>
            Close
          </button>
        )}
      </div>

      <ul className="nav-list">
        {views.map((item) => (
          <li key={item.key}>
            <a
              className="nav-list__link"
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              onClick={onClose}
            >
              <span className="nav-list__label">{item.label}</span>
              <Count count={item.count} />
            </a>
          </li>
        ))}
      </ul>

      <section className="sidebar__projects" aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="sidebar__heading">
          Projects
        </h2>

        {projects.length > 0 && (
          <ul className="nav-list">
            {projects.map((node) => (
              <li key={node.id}>
                <ProjectLink item={node} onClose={onClose} />
                {node.children.length > 0 && (
                  <ul className="nav-list nav-list--nested">
                    {node.children.map((child) => (
                      <li key={child.id}>
                        <ProjectLink item={child} onClose={onClose} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        <NewProject onCreate={onCreateProject} />

        {archived.length > 0 && (
          <details className="sidebar__archived">
            <summary className="sidebar__archived-summary">Archived projects</summary>
            <ul className="nav-list">
              {archived.map((item) => (
                <li key={item.id}>
                  <ProjectLink item={item} onClose={onClose} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="sidebar__labels" aria-labelledby="labels-heading">
        <h2 id="labels-heading" className="sidebar__heading">
          Labels
        </h2>
        {labels.length > 0 && (
          <ul className="nav-list">
            {labels.map((label) => (
              <li key={label.id}>
                <a
                  className="nav-list__link"
                  href={label.href}
                  aria-current={label.current ? 'page' : undefined}
                  onClick={onClose}
                >
                  <span className="label-mark" data-color={label.colorId} aria-hidden="true" />
                  <span className="nav-list__label">{label.name}</span>
                  <Count count={label.count} />
                </a>
              </li>
            ))}
          </ul>
        )}
        <a
          className="nav-list__link sidebar__manage"
          href={manageLabels.href}
          aria-current={manageLabels.current ? 'page' : undefined}
          onClick={onClose}
        >
          {labels.length > 0 ? 'Manage labels' : 'Add labels'}
        </a>
      </section>

      <footer className="sidebar__footer">
        <a
          className="nav-list__link"
          href={settings.href}
          aria-current={settings.current ? 'page' : undefined}
          onClick={onClose}
        >
          <span className="nav-list__label">Settings</span>
          <span className="sidebar__sync" aria-label={`Sync: ${syncText}`}>
            {syncText}
          </span>
        </a>
        <p className="app-version" title={build.detail}>
          {build.label}
        </p>
      </footer>
    </nav>
  );
}

function ProjectLink({ item, onClose }: { item: ProjectNavItem; onClose(): void }) {
  return (
    <a
      className="nav-list__link"
      href={item.href}
      aria-current={item.current ? 'page' : undefined}
      onClick={onClose}
    >
      <span className="project-dot" data-color={item.colorId} aria-hidden="true" />
      <span className="nav-list__label">{item.name}</span>
      <Count count={item.count} />
    </a>
  );
}

/** "New project" opens a name field in place; Enter creates, Escape backs out. */
function NewProject({ onCreate }: { onCreate(name: string): void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setName('');
    queueMicrotask(() => buttonRef.current?.focus());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setOpen(false);
    setName('');
  };

  if (!open) {
    return (
      <button type="button" className="button sidebar__new-project" ref={buttonRef} onClick={() => setOpen(true)}>
        New project
      </button>
    );
  }

  return (
    <form
      className="new-project"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
    >
      <label className="field__label" htmlFor="new-project-name">
        Project name
      </label>
      <input
        id="new-project-name"
        className="text-input"
        type="text"
        autoComplete="off"
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div className="button-row">
        <button type="submit" className="button button--primary">
          Create
        </button>
        <button type="button" className="button" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  );
}
