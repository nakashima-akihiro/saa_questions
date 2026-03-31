import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AWS SAA 一問一答',
  description: 'AWS Solutions Architect Associate 試験対策',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <nav className="max-w-4xl mx-auto flex gap-6">
            <a href="/" className="font-bold text-blue-600">AWS SAA 一問一答</a>
            <a href="/history" className="text-gray-600 hover:text-gray-900">履歴</a>
            <a href="/result/set1" className="text-gray-600 hover:text-gray-900">結果</a>
          </nav>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
