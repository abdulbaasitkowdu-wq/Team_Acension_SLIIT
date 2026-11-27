import type { ReactNode } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface DetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

/** Right-hand panel for inspecting one record without leaving the list behind it. */
export function DetailDrawer({ open, onOpenChange, title, description, children, footer }: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full gap-0 bg-card sm:max-w-md lg:max-w-lg"
        // Radix warns unless the description link is explicitly cleared when there is none.
        {...(description ? {} : { 'aria-describedby': undefined })}
      >
        <SheetHeader className="border-b px-6 py-5 pr-12">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <SheetFooter className="flex-row justify-end border-t px-6 py-4">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
