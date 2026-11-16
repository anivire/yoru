import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@yoru/ui'
import type { ReactNode } from 'react'

export function Group({ title, hint, children }: { title: ReactNode; hint: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{hint}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}
