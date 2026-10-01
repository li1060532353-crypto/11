import { useState } from 'react';
import { createBrowserRouter, MemoryRouter, RouterProvider } from 'react-router-dom';

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

  return <BrowserApp />;
}

function BrowserApp() {
  const [router] = useState(() => createBrowserRouter([{ path: '*', element: <AppRoutes /> }]));
  return <RouterProvider router={router} />;
}
