export function Audits(): JSX.Element {
  return (
    <div className="space-y-6">
      <h1>Site Audits</h1>

      <div className="card">
        <h2 className="mb-4">Pending Audits</h2>
        <p className="text-gray-600">
          Websites waiting to be audited for performance, accessibility, and mobile issues.
        </p>
        <div className="mt-4">
          <button className="btn-primary">Run Audits</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Performance Issues</p>
          <p className="text-2xl font-bold text-red-600">—</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Accessibility Issues</p>
          <p className="text-2xl font-bold text-orange-600">—</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Mobile Issues</p>
          <p className="text-2xl font-bold text-yellow-600">—</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4">Recent Audits</h2>
        <p className="text-gray-500 text-center py-8">
          No audits completed yet. Run an audit to see results.
        </p>
      </div>
    </div>
  );
}
