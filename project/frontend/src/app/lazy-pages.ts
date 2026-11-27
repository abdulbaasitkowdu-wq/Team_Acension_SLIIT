import { lazy } from 'react'

/** Route-level code splitting: each module ships as its own chunk. */
export const OverviewPage = lazy(() => import('@/pages/OverviewPage'))
export const DataExplorerPage = lazy(() => import('@/pages/DataExplorerPage'))
export const InvestigationCenterPage = lazy(() => import('@/pages/InvestigationCenterPage'))
export const ResearchLaboratoryPage = lazy(() => import('@/pages/ResearchLaboratoryPage'))
export const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
