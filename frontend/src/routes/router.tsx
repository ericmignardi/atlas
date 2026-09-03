import { lazy } from "react";
import { createBrowserRouter } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { GuestRoute, ProtectedRoute } from "@/routes/guards";

/**
 * NFR-1.3 caps the production bundle at 350 kB gzipped with routes code-split,
 * so every page is lazy. The two auth pages are lazy as well — a signed-in user
 * on a warm session never downloads a sign-in form they will not see.
 *
 * `React.lazy` needs a default export, which is why every page module has one
 * even though the rest of the codebase uses named exports throughout.
 */
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"));
const TasksPage = lazy(() => import("@/pages/TasksPage"));
const EnvironmentsPage = lazy(() => import("@/pages/EnvironmentsPage"));
const TagsPage = lazy(() => import("@/pages/TagsPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/projects", element: <ProjectsPage /> },
          { path: "/projects/:slug", element: <ProjectDetailPage /> },
          { path: "/tasks", element: <TasksPage /> },
          { path: "/environments", element: <EnvironmentsPage /> },
          { path: "/tags", element: <TagsPage /> },
          { path: "/settings", element: <SettingsPage /> },
          /* Inside the shell, so a wrong URL still has navigation on it. It is
             also behind the guard: an anonymous visitor to /nonsense should be
             asked to sign in, not told the page does not exist — the answer
             might be different once they are. */
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
