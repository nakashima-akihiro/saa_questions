export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="flex gap-2 border-b border-gray-200 pb-px">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-9 w-14 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded animate-pulse" />
    </div>
  )
}
