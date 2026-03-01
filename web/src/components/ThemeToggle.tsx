import { createSignal, createEffect } from 'solid-js'
import styles from './ThemeToggle.module.css'

type Mode = 'system' | 'light' | 'dark'

export default function ThemeToggle() {
  const [mode, setMode] = createSignal<Mode>(
    (localStorage.getItem('theme') as Mode) || 'system',
  )

  createEffect(() => {
    const m = mode()
    document.documentElement.className = m
    localStorage.setItem('theme', m)
  })

  return (
    <select
      class={styles['theme-select']}
      value={mode()}
      onChange={(e) => setMode(e.currentTarget.value as Mode)}
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  )
}
