import { render } from 'solid-js/web'
import { Router, Route } from '@solidjs/router'
import './app.css'
import Layout from './App'
import SessionList from './components/SessionList'
import SessionView from './components/SessionView'
import RawLogView from './components/RawLogView'

render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={SessionList} />
      <Route path="/session/:id" component={SessionView} />
      <Route path="/session/:id/raw" component={RawLogView} />
    </Router>
  ),
  document.getElementById('app')!,
)
