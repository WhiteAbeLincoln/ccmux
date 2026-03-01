import type { RouteSectionProps } from '@solidjs/router'
import ThemeToggle from './components/ThemeToggle'
import styles from './App.module.css'

export default function Layout(props: RouteSectionProps) {
  return (
    <>
      <nav class={styles.nav}>
        <ThemeToggle />
      </nav>
      <main>{props.children}</main>
    </>
  )
}
