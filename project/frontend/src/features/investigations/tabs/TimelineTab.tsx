import { formatTimestamp } from '@/lib/format'
import { useTimeline } from '@/services/api'
import { Card, Loaded, RecordLink, type Inspect } from '../parts'

export function TimelineTab({ caseId, onInspect }: { caseId: string; onInspect: Inspect }) {
  const timeline = useTimeline(caseId)

  return (
    <Loaded query={timeline} label="timeline">
      {({ items }) => (
        <Card>
          {items.length === 0 ? (
            <p className="text-muted-foreground">No events are recorded for this case.</p>
          ) : (
            <ol aria-label="Timeline" className="space-y-4 border-l pl-4">
              {[...items]
                .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
                .map((event) => (
                  <li key={event.id} className="relative space-y-1">
                    <span aria-hidden="true" className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-card bg-primary" />
                    <time dateTime={event.occurredAt} className="block text-xs text-muted-foreground">
                      {formatTimestamp(event.occurredAt)}
                    </time>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-subtle-foreground">{event.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {event.transactionId && (
                        <RecordLink subject={{ kind: 'transaction', id: event.transactionId }} onInspect={onInspect} />
                      )}
                      {event.evidenceId && <RecordLink subject={{ kind: 'evidence', id: event.evidenceId }} onInspect={onInspect} />}
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </Card>
      )}
    </Loaded>
  )
}
