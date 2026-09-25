import type { ReactNode } from 'react'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex bg-crema overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8 max-w-3xl w-full">{children}</main>
      </div>
    </div>
  )
}
