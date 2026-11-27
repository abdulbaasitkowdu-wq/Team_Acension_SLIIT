import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ModuleTab } from '@/config/navigation'

interface TabNavigationProps {
  tabs: readonly ModuleTab[]
  value: string
  onValueChange: (value: string) => void
  /** Accessible name for the tab list. */
  label: string
  /** Renders the panel for the active tab. */
  children: (tab: ModuleTab) => ReactNode
}

export function TabNavigation({ tabs, value, onValueChange, label, children }: TabNavigationProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className="gap-4">
      <div className="overflow-x-auto overflow-y-hidden border-b">
        <TabsList variant="line" aria-label={label} className="gap-2 p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="px-1 text-subtle-foreground after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-0 data-[state=active]:text-primary-strong"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {children(tab)}
        </TabsContent>
      ))}
    </Tabs>
  )
}
