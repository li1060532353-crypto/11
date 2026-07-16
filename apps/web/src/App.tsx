import { BrowserRouter, MemoryRouter } from 'react-router-dom';

import { AppRoutes } from './router';

type AppProps = {
  initialPath?: string;
};

export function App({ initialPath }: AppProps) {
  if (initialPath) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
