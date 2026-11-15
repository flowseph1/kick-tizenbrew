import type { VNode } from 'preact';
import { Home } from '../screens/Home';
import { SettingsScreen } from '../screens/Settings';
import type { Route } from './routes';

/** Renders the screen for a route. Add one case per new route. */
export function renderScreen(route: Route): VNode {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'settings':
      return <SettingsScreen />;
  }
}
