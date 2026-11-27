import { ArrowLeft } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { TabNavigation } from '@/components/common/TabNavigation'
import { useTableParams } from '@/components/data-table/use-table-params'
import { Button } from '@/components/ui/button'
import { MODULES, resolveTab, TAB_PARAM } from '@/config/navigation'
import { DataQualityTab } from './DataQualityTab'
import { BatchesTab, EntitiesTab, MedicinesTab, TransactionsTab, type Navigate } from './RecordTabs'

// The graph library is large; load it only when a graph is opened.
const BatchGraph = lazy(() => import('./BatchGraph'))

const GRAPH_PARAM = 'graph'

export default function ExplorerWorkspace() {
  const module = MODULES.dataExplorer
  const [params, setParams] = useSearchParams()
  const tab = resolveTab(module, params.get(TAB_PARAM))!.value
  const graphBatch = params.get(GRAPH_PARAM)
  const table = useTableParams()

  // Each tab has its own search, filters and paging, so moving between tabs starts clean.
  const go = (next: Record<string, string>) => setParams(new URLSearchParams(next))

  const navigate: Navigate = {
    toTransactions: (filter) => go({ [TAB_PARAM]: 'transactions', ...filter }),
    toGraph: (batchId) => go({ [TAB_PARAM]: 'batches', [GRAPH_PARAM]: batchId }),
  }

  const render = (value: string) => {
    if (value === 'batches' && graphBatch) {
      return (
        <div className="space-y-3">
          <Button variant="outline" size="sm" className="bg-card" onClick={() => go({ [TAB_PARAM]: 'batches' })}>
            <ArrowLeft aria-hidden="true" />
            Back to batches
          </Button>
          <Suspense fallback={<LoadingSkeleton variant="table" count={6} label="Loading graph tools" />}>
            <BatchGraph batchId={graphBatch} />
          </Suspense>
        </div>
      )
    }
    const shared = { table, navigate }
    switch (value) {
      case 'batches':
        return <BatchesTab {...shared} />
      case 'medicines':
        return <MedicinesTab {...shared} />
      case 'entities':
        return <EntitiesTab {...shared} />
      case 'quality':
        return <DataQualityTab onViewTransactions={navigate.toTransactions} />
      default:
        return <TransactionsTab {...shared} />
    }
  }

  return (
    <TabNavigation tabs={module.tabs} value={tab} onValueChange={(next) => go({ [TAB_PARAM]: next })} label={`${module.label} sections`}>
      {(active) => render(active.value)}
    </TabNavigation>
  )
}
