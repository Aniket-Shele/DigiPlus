import { useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'

const API_BASE_URL = 'http://localhost:8000/api'

export default function Ingestion({ role, username }) {
  const effectiveUser = username || localStorage.getItem('user_name') || 'David'
  const commitInputId = useId()
  const techStackInputId = useId()
  const architectureInputId = useId()
  const meetingNotesInputId = useId()
  const pdfUploadInputId = useId()

  const navigate = useNavigate()

  // Ingestion Mode (for Manager): 'meeting_text' | 'meeting_pdf' | 'developer_handoff'
  const [ingestMode, setIngestMode] = useState(
    role === 'Developer' ? 'developer_handoff' : 'meeting_text'
  )

  // Meeting Mode State
  const [rawText, setRawText] = useState('')
  const [pdfFile, setPdfFile] = useState(null)

  // Developer Handoff State
  const [githubCommits, setGithubCommits] = useState('')
  const [techStack, setTechStack] = useState('')
  const [archChanges, setArchChanges] = useState('')

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [latestRecap, setLatestRecap] = useState(null)

  // Quick Samples
  const loadQuickSample = (type) => {
    if (type === 'meeting') {
      setIngestMode('meeting_text')
      setRawText(
        `Executive Leadership & Sprint Alignment:\n` +
        `- Approved Q4 migration from REST polling to WebSockets for real-time order tracking.\n` +
        `- Decided to use Tailwind CSS enterprise design system across all internal dashboards.\n` +
        `- Alice to finalize OAuth2 PKCE token rotation by 2026-11-05.\n` +
        `- Bob will deliver the responsive React dashboard by 2026-11-08.\n` +
        `- Charlie will configure MongoDB Atlas read replicas and backup policies.`
      )
    } else {
      setIngestMode('developer_handoff')
      setGithubCommits('https://github.com/digiplus/core/commit/7a8f90c\nhttps://github.com/digiplus/core/pull/342')
      setTechStack('FastAPI, React 19, Tailwind CSS, PyPDF2, Motor, MongoDB Atlas')
      setArchChanges(
        'Refactored token refresh middleware to eliminate race conditions under high concurrent loads. ' +
        'David must verify staging integration by 2026-11-07. Sarah will add load testing scripts.'
      )
    }
  }

  // Handle Text Ingestion (Meeting or Dev Handoff)
  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    let contentToIngest = ''
    let sourceTypeToUse = 'meeting'

    if (role === 'Developer' || ingestMode === 'developer_handoff') {
      sourceTypeToUse = 'developer_handoff'
      if (!githubCommits.trim() && !techStack.trim() && !archChanges.trim()) {
        setSubmitError('Please complete the structured handoff fields.')
        return
      }
      contentToIngest =
        `Developer Handoff Overview:\n` +
        `• GitHub Commits / Links: ${githubCommits.trim() || 'None provided'}\n` +
        `• Tech Stack Used: ${techStack.trim() || 'Standard Stack'}\n` +
        `• Reasons for Architectural Changes: ${archChanges.trim() || 'Iterative enhancements'}`
    } else {
      sourceTypeToUse = 'meeting'
      if (!rawText.trim()) {
        setSubmitError('Please enter raw meeting notes or text.')
        return
      }
      contentToIngest = rawText.trim()
    }

    setIsSubmitting(true)
    setSubmitError(null)
    setLatestRecap(null)

    try {
      const res = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: contentToIngest,
          source_type: sourceTypeToUse,
          author: effectiveUser,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server error (${res.status})`)
      }

      const result = await res.json()
      setLatestRecap(result)

      // Clear fields
      setRawText('')
      setGithubCommits('')
      setTechStack('')
      setArchChanges('')
    } catch (err) {
      setSubmitError(err.message || 'Failed to ingest content.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle PDF Upload Ingestion
  const handlePdfSubmit = async (e) => {
    e.preventDefault()
    if (!pdfFile || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(null)
    setLatestRecap(null)

    const formData = new FormData()
    formData.append('file', pdfFile)
    formData.append('source_type', 'meeting')

    try {
      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Upload failed (${res.status})`)
      }

      const result = await res.json()
      setLatestRecap(result)
      setPdfFile(null)
    } catch (err) {
      setSubmitError(err.message || 'Failed to upload and process PDF.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-full px-6 lg:px-12 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {role === 'Developer' ? 'Developer Handoff Hub' : 'Intelligence Ingestion Hub'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {role === 'Developer'
              ? 'Submit architectural rationale, commit references, and tech stack details directly to the task stream.'
              : 'Ingest raw transcripts, upload meeting PDFs, or capture developer technical handoffs.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadQuickSample(role === 'Developer' ? 'handoff' : 'meeting')}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-200 transition-colors"
          >
            Load Sample
          </button>
        </div>
      </div>

      {/* Main 2-Column Responsive Ingestion Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
          {/* Mode Switcher for Manager */}
          {role === 'Manager' && (
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600 border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIngestMode('meeting_text')
                  setSubmitError(null)
                }}
                className={`py-2 px-3 rounded-lg transition-all ${
                  ingestMode === 'meeting_text'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Raw Meeting Notes
              </button>

              <button
                type="button"
                onClick={() => {
                  setIngestMode('meeting_pdf')
                  setSubmitError(null)
                }}
                className={`py-2 px-3 rounded-lg transition-all ${
                  ingestMode === 'meeting_pdf'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Upload PDF Document
              </button>

              <button
                type="button"
                onClick={() => {
                  setIngestMode('developer_handoff')
                  setSubmitError(null)
                }}
                className={`py-2 px-3 rounded-lg transition-all ${
                  ingestMode === 'developer_handoff'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                Developer Handoff
              </button>
            </div>
          )}

          {/* FORM 1: DEVELOPER HANDOFF (3 Structured Inputs) */}
          {(role === 'Developer' || ingestMode === 'developer_handoff') && (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div>
                <label htmlFor={commitInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  GitHub Commits / PR Links
                </label>
                <input
                  id={commitInputId}
                  type="text"
                  value={githubCommits}
                  onChange={(e) => setGithubCommits(e.target.value)}
                  placeholder="e.g. https://github.com/org/repo/pull/123, commit #8b71d4f"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600"
                />
              </div>

              <div>
                <label htmlFor={techStackInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Tech Stack Used
                </label>
                <input
                  id={techStackInputId}
                  type="text"
                  value={techStack}
                  onChange={(e) => setTechStack(e.target.value)}
                  placeholder="e.g. FastAPI, Motor, React 19, Tailwind CSS, PyPDF2"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600"
                />
              </div>

              <div>
                <label htmlFor={architectureInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Reasons for Architectural Changes & Next Steps
                </label>
                <textarea
                  id={architectureInputId}
                  rows={6}
                  value={archChanges}
                  onChange={(e) => setArchChanges(e.target.value)}
                  placeholder="Explain why changes were made, tradeoffs, and remaining developer deliverables..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600 resize-none leading-relaxed"
                />
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Extracting Tasks with Gemini 3.8 Flash...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Submit & Process Developer Handoff</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM 2: RAW MEETING NOTES (Manager Mode) */}
          {role === 'Manager' && ingestMode === 'meeting_text' && (
            <form onSubmit={handleTextSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={meetingNotesInputId} className="block text-xs font-bold text-slate-700">
                    Meeting Transcript / Raw Notes
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {rawText.length} characters
                  </span>
                </div>
                <textarea
                  id={meetingNotesInputId}
                  rows={8}
                  required
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste meeting discussion notes, agenda reviews, or transcripts..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-600 resize-none leading-relaxed"
                />
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !rawText.trim()}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Extracting Structured Tasks...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Process Notes with AI</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM 3: PDF UPLOAD (Manager Mode) */}
          {role === 'Manager' && ingestMode === 'meeting_pdf' && (
            <form onSubmit={handlePdfSubmit} className="space-y-4">
              <div>
                <label htmlFor={pdfUploadInputId} className="block text-xs font-bold text-slate-700 mb-1">
                  Upload PDF Document
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-8 text-center transition-colors bg-slate-50/60">
                  <input
                    id={pdfUploadInputId}
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor={pdfUploadInputId} className="cursor-pointer block">
                    <svg className="w-10 h-10 text-indigo-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-semibold text-slate-700">
                      {pdfFile ? pdfFile.name : 'Click to select or drag PDF file here'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {pdfFile ? `${(pdfFile.size / 1024).toFixed(1)} KB` : 'Meeting notes, product specifications, or executive briefs (PDF)'}
                    </p>
                  </label>
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !pdfFile}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Extracting PDF & Analyzing with Gemini...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Upload & Process PDF</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: AI Output Preview & Guidelines */}
        <div className="lg:col-span-5 space-y-6">
          {latestRecap ? (
            <div className="bg-white border border-emerald-200 rounded-2xl p-6 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Processed & Persisted to MongoDB!
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  ID: {latestRecap.id?.slice(-6)}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Executive Brief
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 font-medium">
                  {latestRecap.summary}
                </p>
              </div>

              {latestRecap.decisions?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Key Decisions
                  </h3>
                  <ul className="list-disc list-inside text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    {latestRecap.decisions.map((dec, i) => (
                      <li key={i}>{dec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {latestRecap.action_items?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Extracted Action Items ({latestRecap.action_items.length})
                    </h3>
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      View on Board &rarr;
                    </button>
                  </div>
                  <div className="space-y-2">
                    {latestRecap.action_items.map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-900">{item.description}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Assigned: {item.owner}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          {item.status || 'Open'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                AI Ingestion Pipeline Guidelines
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The DigiPlus pipeline automatically routes text or documents to Google Gemini 3.8 Flash, applying strict Pydantic schemas to convert unorganized conversations into actionable engineering tickets.
              </p>
              <div className="space-y-2.5 text-xs text-slate-600">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800">1. Automatic Owner Extraction:</span>
                  <p className="mt-0.5 text-slate-500">Names referenced in action items (e.g. &quot;Alice to configure auth&quot;) are isolated into ticket owners.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800">2. Deadline Normalization:</span>
                  <p className="mt-0.5 text-slate-500">Natural language dates are parsed to ISO format or marked as None.</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-800">3. Telemetry & Auditing:</span>
                  <p className="mt-0.5 text-slate-500">Every run logs full duration, tokens, and correlation ID to app_logs.json.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

