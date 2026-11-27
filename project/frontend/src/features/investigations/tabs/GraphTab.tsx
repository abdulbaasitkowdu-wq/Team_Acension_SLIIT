import { CustodyGraph } from '@/components/graph/CustodyGraph'
import type { GraphSelection } from '@/components/graph/graph-adapter'
import { useCustodyGraph } from '@/services/api'
import { Loaded, type Inspect, type Subject } from '../parts'

interface GraphTabProps {
  batchId: string
  isDemoData: boolean
  subject: Subject | null
  onInspect: Inspect
}

function toSelection(subject: Subject | null): GraphSelection | null {
  if (subject?.kind === 'entity') return { kind: 'node', id: subject.id }
  if (subject?.kind === 'transaction') return { kind: 'edge', id: subject.id }
  return null
}

/** The shared graph component, with its selection shown in the workspace inspector. */
export default function GraphTab({ batchId, isDemoData, subject, onInspect }: GraphTabProps) {
  const graph = useCustodyGraph(batchId)

  return (
    <Loaded query={graph} label="custody graph">
      {(data) => (
        <CustodyGraph
          graph={data}
          isDemoData={isDemoData}
          showInspector={false}
          selection={toSelection(subject)}
          onSelectionChange={(selection) =>
            onInspect(selection && { kind: selection.kind === 'node' ? 'entity' : 'transaction', id: selection.id })
          }
        />
      )}
    </Loaded>
  )
}
