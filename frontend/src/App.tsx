import { Suspense } from "react";
import { RouterProvider } from "react-router";

import { AuthGate } from "@/components/layout/AuthGate";
import { ToastViewport } from "@/components/ui/Toast";
import { router } from "@/routes/router";

/**
 * Three things, in this order. AuthGate first, because the router's guards
 * cannot decide anything until the session is resolved; the toast viewport
 * outside the router, so a toast survives the navigation that triggered it.
 *
 * The Suspense boundary here is the backstop for the lazy routes that render
 * outside the app shell — the two auth pages. AppLayout has its own, closer to
 * the content, so an in-app navigation shows a skeleton in the content column
 * rather than blanking the whole window.
 */
const App = () => (
  <AuthGate>
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
    <ToastViewport />
  </AuthGate>
);

export default App;
