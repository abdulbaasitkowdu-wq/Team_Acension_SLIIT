import { ApiFailure } from '@/components/common/ApiFailure'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { CustodyGraph } from '@/components/graph/CustodyGraph'
import { env } from '@/config/env'
import { useCustodyGraph } from '@/services/api'

export default function BatchGraph({ batchId }: { batchId: string }) {
  const graph = useCustodyGraph(batchId)

  if (graph.error) {
    return <ApiFailure title="The custody graph could not be loaded" error={graph.error} onRetry={() => void graph.refetch()} />
  }
  if (!graph.data) return <LoadingSkeleton variant="table" count={6} label="Loading custody graph" />
  return <CustodyGraph graph={graph.data} isDemoData={env.mocksEnabled} />
}
