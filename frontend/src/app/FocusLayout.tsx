import { Outlet } from 'react-router-dom'
import { BloomField } from './BloomField'
import { SkipToContent } from './SkipToContent'
import styles from './FocusLayout.module.css'

/**
 * A task the viewer finishes in one sitting, such as sending an application,
 * set without the rail and the search bar. The page brings its own header, a
 * way back and the one fact the task turns on, as the canvas's apply board
 * draws it.
 */
export function FocusLayout() {
  return (
    <div className={styles.shell}>
      <BloomField />
      <div className={styles.foreground}>
        <SkipToContent />
        <Outlet />
      </div>
    </div>
  )
}
