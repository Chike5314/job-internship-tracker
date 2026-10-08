import styles from './Icon.module.css';

/** Every symbol in `public/icons.svg`, so a name that is not in the sprite is a
 *  typecheck failure rather than an icon that silently renders as nothing.
 *  Regenerate alongside `docs/brand/icons/build-icons.py` when the sprite grows. */
export type IconName =
  | 'search' | 'bell' | 'notification' | 'account' | 'settings' | 'sign-out'
  | 'menu' | 'close' | 'chevron-down' | 'chevron-right' | 'back' | 'forward'
  | 'job' | 'internship' | 'company' | 'location' | 'remote' | 'salary'
  | 'deadline' | 'openings' | 'skills' | 'posting'
  | 'document' | 'cv' | 'upload' | 'download' | 'attachment' | 'link'
  | 'history' | 'interview' | 'calendar' | 'message'
  | 'submitted' | 'under-review' | 'offer' | 'rejected' | 'withdrawn'
  | 'warning' | 'info' | 'verified' | 'pending' | 'loading'
  | 'edit' | 'delete' | 'filter' | 'sort' | 'add' | 'confirm' | 'copy'
  | 'export' | 'open-external' | 'bulk'
  | 'analytics' | 'funnel' | 'trend' | 'admin' | 'suspend' | 'approve'
  | 'theme-paper' | 'theme-ink' | 'theme-system'
  | 'dashboard' | 'applications' | 'file' | 'folder' | 'date' | 'star'
  | 'send' | 'save' | 'home' | 'person' | 'lock';

type Props = {
  name: IconName;
  /** Edge length in pixels. The sprite is drawn on a 24 grid and holds its
   *  weight from 16 up to 32. */
  size?: number;
  /** What the icon says on its own. Give this only when the icon carries
   *  meaning no adjacent text already carries; an icon beside its own label is
   *  decoration and stays hidden from a screen reader. */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 20, label, className }: Props) {
  const classes = className ? `${styles.icon} ${className}` : styles.icon;
  return (
    <svg
      className={classes}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`/icons.svg#i-${name}`} />
    </svg>
  );
}
