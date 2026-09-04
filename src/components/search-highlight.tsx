export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function highlightMatch(text: string, query: string) {
  if (!query?.trim() || !text) return text
  const re = new RegExp(`(${escapeRegex(query.trim())})`, 'gi')
  return text.split(re).map((p, i) =>
    i % 2 ? (
      <mark key={i} className="bg-yellow-500/30 text-inherit">
        {p}
      </mark>
    ) : (
      p
    ),
  )
}
