export function ConfigErrorScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-gray-600">
          Create a <code className="rounded bg-gray-100 px-1">.env</code> file in the project root (copy{' '}
          <code className="rounded bg-gray-100 px-1">.env.example</code>) and set:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`}
        </pre>
        <p className="mt-3 text-sm text-gray-600">
          Find both in Supabase: <strong>Project Settings &rarr; API</strong>. Use the <strong>anon / publishable</strong>{' '}
          key only. Then restart <code className="rounded bg-gray-100 px-1">npm run dev</code>.
        </p>
      </div>
    </div>
  )
}
