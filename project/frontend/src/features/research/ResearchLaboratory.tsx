import { useSearchParams } from 'react-router'
import { TabNavigation } from '@/components/common/TabNavigation'
import { MODULES, TAB_PARAM } from '@/config/navigation'
import { useModuleTab } from '@/hooks/use-module-tab'
import { ComparisonTab } from './ComparisonTab'
import { ConfigurationTab } from './ConfigurationTab'
import { MetricsTab } from './MetricsTab'
import { RunsTab } from './RunsTab'

const EXPERIMENT_PARAM = 'experiment'

export default function ResearchLaboratory() {
  const module = MODULES.research
  const [tab, setTab] = useModuleTab(module)
  const [params, setParams] = useSearchParams()
  const experimentId = params.get(EXPERIMENT_PARAM)

  const go = (changes: Record<string, string>) =>
    setParams((next) => {
      for (const [key, value] of Object.entries(changes)) next.set(key, value)
      return next
    })
  const select = (id: string) => go({ [EXPERIMENT_PARAM]: id })

  const render = (value: string) => {
    switch (value) {
      case 'runs':
        return (
          <RunsTab
            onCompare={(id) => go({ [TAB_PARAM]: 'comparison', [EXPERIMENT_PARAM]: id })}
            onConfigure={() => setTab('configuration')}
          />
        )
      case 'comparison':
        return <ComparisonTab selectedId={experimentId} onSelect={select} />
      case 'metrics':
        return <MetricsTab selectedId={experimentId} onSelect={select} />
      default:
        return <ConfigurationTab onStarted={(experiment) => go({ [TAB_PARAM]: 'runs', [EXPERIMENT_PARAM]: experiment.id })} />
    }
  }

  return (
    <TabNavigation tabs={module.tabs} value={tab} onValueChange={setTab} label={`${module.label} sections`}>
      {(active) => render(active.value)}
    </TabNavigation>
  )
}
