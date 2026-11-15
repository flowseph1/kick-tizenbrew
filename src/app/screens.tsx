import type { VNode } from 'preact';
import { CategoryScreen } from '../screens/Category';
import { Home } from '../screens/Home';
import type { Route } from './routes';

/** Renders the screen for a route. Add one case per new route. */
export function renderScreen(route: Route): VNode {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'category':
      return <CategoryScreen key={route.category.slug} category={route.category} />;
  }
}
