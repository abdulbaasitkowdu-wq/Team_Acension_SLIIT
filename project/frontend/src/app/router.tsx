import { createBrowserRouter, Navigate } from 'react-router'
import {
  DataExplorerPage,
  InvestigationCenterPage,
  NotFoundPage,
  OverviewPage,
  ResearchLaboratoryPage,
} from '@/app/lazy-pages'
import { RouteError } from '@/app/RouteError'
import { PhantomLayout } from '@/components/layout/PhantomLayout'
import { MODULES } from '@/config/navigation'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PhantomLayout />,
    errorElement: <RouteError />,
    children: [
      {
        // Pathless boundary so page errors render inside the shell.
        errorElement: <RouteError />,
        children: [
          { index: true, element: <Navigate to={MODULES.overview.path} replace /> },
          { path: MODULES.overview.path, element: <OverviewPage /> },
          { path: MODULES.dataExplorer.path, element: <DataExplorerPage /> },
          { path: MODULES.investigations.path, element: <InvestigationCenterPage /> },
          { path: MODULES.research.path, element: <ResearchLaboratoryPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
