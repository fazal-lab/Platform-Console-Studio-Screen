import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import Header from '../components/Header'
import '../styles/dashboard.css'
import '../styles/screenBundle.css'
import { useXiaContext } from '../context/XiaContext'

function ScreenBundlePage() {
    const navigate = useNavigate()
    const { state } = useLocation()
    const [searchParams] = useSearchParams()

    const campaignId = searchParams.get('campaignId') || state?.campaignId || ''
    const selectedScreens = state?.selectedScreens || []
    const slotCount = state?.slotCount || {}

    const [screenData, setScreenData] = useState([])
    const [loading, setLoading] = useState(true)
    const [bundles, setBundles] = useState([])
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newBundleName, setNewBundleName] = useState('')
    const [screenSelections, setScreenSelections] = useState({})
    const [globalSelectedBundle, setGlobalSelectedBundle] = useState("")

    const token = localStorage.getItem('token')
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } }
    const { setPageContext } = useXiaContext()

    // Publish live page data for XIA — include per-screen and per-bundle details
    useEffect(() => {
        setPageContext({
            page: 'screen_bundle',
            page_label: 'Screen Bundle Manager',
            summary: `Managing creative bundles for campaign ${campaignId}. ${screenData.length} screens, ${bundles.length} bundles created.`,
            data: {
                campaign_id: campaignId,
                screens: screenData.map(s => ({
                    name: s.name || s.screen_name,
                    location: s.location || s.city,
                    media_type: s.media_type || s.mediaType,
                })),
                bundles: bundles.map(b => ({
                    name: b.name || b.bundle_name,
                    screens: b.screens?.map(s => s.screenName || s.name) || [],
                    has_creative_suggestion: !!b.creative_suggestion_url,
                })),
            }
        })
        return () => setPageContext(null)
    }, [screenData, bundles, campaignId])

    // Fetch existing bundles for this campaign on load
    // Also restores 'Open Creative' button state if creative_suggestion_url is already set in DB
    const fetchBundles = async () => {
        if (!campaignId) return
        try {
            const res = await axios.get(`/api/studio/campaign/${campaignId}/bundles/`, authHeaders)
            const data = res.data?.data || []
            const mapped = data.map(b => ({
                id: String(b.id),
                name: b.name,
                status: b.status,
                creative_suggestion_url: b.creative_suggestion_url,
                screens: (b.screen_slots || []).map(s => ({
                    screenId: s.screen_id,
                    screenName: s.screen_name,
                    slots: s.slots
                }))
            }))
            setBundles(mapped)

            // Restore 'Open Creative' state: if a bundle already has a URL saved on the server,
            // store it in cachedBriefHtml so the button shows 'Open Creative' after refresh
            const restored = {}
            mapped.forEach(b => {
                if (b.creative_suggestion_url) {
                    restored[b.id] = b.creative_suggestion_url  // server URL, not raw HTML
                }
            })
            if (Object.keys(restored).length > 0) {
                setCachedBriefHtml(prev => ({ ...prev, ...restored }))
            }
        } catch (_) { }
    }

    useEffect(() => {
        fetchBundles()
    }, [campaignId])

    useEffect(() => {
        const fetchScreens = async () => {
            if (selectedScreens.length === 0) {
                if (campaignId) {
                    try {
                        const manifestRes = await axios.get(`/api/console/campaign/${campaignId}/manifest/`)
                        const manifestRows = manifestRes.data?.assets || []
                        if (manifestRows.length > 0) {
                            const screenMap = {}
                            manifestRows.forEach(row => {
                                if (!screenMap[row.screen_id]) {
                                    screenMap[row.screen_id] = { id: row.screen_id, name: row.screen_name || `Screen ${row.screen_id}`, location: row.screen_location || '', slot_count: 0 }
                                }
                                screenMap[row.screen_id].slot_count++
                            })
                            setScreenData(Object.values(screenMap))
                        }
                    } catch (_) { }
                }
                setLoading(false)
                return
            }

            const screens = await Promise.all(selectedScreens.map(async (s) => {
                try {
                    const res = await axios.get(`/api/console/screen-specs/${s.id}/`, { _skipAuthRedirect: true })
                    const spec = res.data
                    return {
                        id: s.id,
                        name: spec.screen_name || s.name || 'Unknown Screen',
                        location: spec.city || s.location || 'Unknown',
                        slot_count: slotCount?.[s.id] || s.slot_count || 1,
                        screen_id_display: `S-${String(s.id).padStart(3, '0')}`,
                        specs: {
                            resolution: (spec.resolution_width && spec.resolution_height)
                                ? `${spec.resolution_width}x${spec.resolution_height}` : '—',
                            orientation: spec.orientation || '',
                            maxSize: spec.max_file_size_mb || '—',
                            format: Array.isArray(spec.supported_formats_json)
                                ? spec.supported_formats_json.join(' / ')
                                : (spec.format || ''),
                            audioRule: spec.audio_supported ? 'Allowed' : 'Not Allowed',
                        },
                        rules: {
                            adDuration: spec.standard_ad_duration_sec || spec.ad_duration || null,
                        }
                    }
                } catch (_) {
                    return {
                        id: s.id,
                        name: s.name || `Screen ${s.id}`,
                        location: s.location || 'Unknown',
                        slot_count: slotCount?.[s.id] || s.slot_count || 1,
                        screen_id_display: `S-${String(s.id).padStart(3, '0')}`,
                        specs: {},
                        rules: {}
                    }
                }
            }))
            setScreenData(screens)
            setLoading(false)
        }
        fetchScreens()
    }, [campaignId])

    const handleCreateBundle = async () => {
        if (!newBundleName.trim() || !campaignId) return
        try {
            const res = await axios.post(`/api/studio/campaign/${campaignId}/bundles/`, { name: newBundleName.trim() }, authHeaders)
            const b = res.data.data
            setBundles(prev => [...prev, { id: String(b.id), name: b.name, status: b.status, creative_suggestion_url: b.creative_suggestion_url, screens: [] }])
        } catch (err) {
            console.error('Failed to create bundle:', err)
        }
        setNewBundleName('')
        setShowCreateModal(false)
    }

    const handleDeleteBundle = async (bundleId) => {
        try {
            await axios.delete(`/api/studio/campaign/${campaignId}/bundles/${bundleId}/`, authHeaders)
        } catch (err) {
            console.error('Failed to delete bundle:', err)
        }
        setBundles(prev => prev.filter(b => b.id !== bundleId))
        setGlobalSelectedBundle(prev => prev === bundleId ? '' : prev)
    }

    const toggleSlot = (screenId, slotNum) => {
        setScreenSelections(prev => {
            const current = prev[screenId] || { selectedSlots: [], selectedBundle: '' }
            const slots = [...current.selectedSlots]
            if (slots.includes(slotNum)) {
                return { ...prev, [screenId]: { ...current, selectedSlots: slots.filter(s => s !== slotNum) } }
            }
            return { ...prev, [screenId]: { ...current, selectedSlots: [...slots, slotNum] } }
        })
    }

    const toggleAllSlots = (screenId, totalSlots) => {
        const assignedSlots = getAssignedSlots(screenId)
        setScreenSelections(prev => {
            const current = prev[screenId] || { selectedSlots: [], selectedBundle: '' }
            const availableSlots = Array.from({ length: totalSlots }, (_, i) => i + 1).filter(s => !assignedSlots.includes(s))
            const allSelected = availableSlots.length > 0 && availableSlots.every(s => current.selectedSlots.includes(s))
            return { ...prev, [screenId]: { ...current, selectedSlots: allSelected ? [] : availableSlots } }
        })
    }

    const setBundleForScreen = (screenId, bundleId) => {
        setScreenSelections(prev => ({
            ...prev,
            [screenId]: { ...(prev[screenId] || { selectedSlots: [], selectedBundle: '' }), selectedBundle: bundleId }
        }))
    }

    const handleGlobalSubmit = async () => {
        if (!globalSelectedBundle) return

        const screensToSubmit = Object.entries(screenSelections)
            .filter(([_, sel]) => sel.selectedSlots.length > 0)
            .map(([screenId, sel]) => ({
                screenId: parseInt(screenId),
                slots: sel.selectedSlots
            }))

        if (screensToSubmit.length === 0) return

        const bundle = bundles.find(b => b.id === globalSelectedBundle)
        if (!bundle) return

        const updatedScreens = [...bundle.screens]
        screensToSubmit.forEach(({ screenId, slots }) => {
            const screen = screenData.find(s => s.id === screenId)
            if (!screen) return
            const existingIdx = updatedScreens.findIndex(s => s.screenId === screenId)
            if (existingIdx >= 0) {
                const merged = [...new Set([...updatedScreens[existingIdx].slots, ...slots])].sort((a, b) => a - b)
                updatedScreens[existingIdx] = { ...updatedScreens[existingIdx], slots: merged }
            } else {
                updatedScreens.push({ screenId, screenName: screen.name, slots: [...slots].sort((a, b) => a - b) })
            }
        })

        // Build the JSON payload shape the backend expects
        const screenSlotsPayload = updatedScreens.map(s => ({
            screen_id: s.screenId,
            screen_name: s.screenName,
            slots: s.slots
        }))

        try {
            await axios.put(
                `/api/studio/campaign/${campaignId}/bundles/${globalSelectedBundle}/`,
                { screen_slots: screenSlotsPayload },
                authHeaders
            )
        } catch (err) {
            console.error('Failed to update bundle slots:', err)
        }

        setBundles(prev => prev.map(b => b.id !== globalSelectedBundle ? b : { ...b, screens: updatedScreens }))
        setScreenSelections({})
        setGlobalSelectedBundle("")

        // Bundle changed: clear cached creative suggestion so
        // the button resets to 'Creative Suggestion' (local + DB)
        setCachedBriefHtml(prev => { const n = { ...prev }; delete n[globalSelectedBundle]; return n })
        // Clear the stored URL in DB so refresh also shows 'Creative Suggestion'
        axios.put(
            `/api/studio/campaign/${campaignId}/bundles/${globalSelectedBundle}/`,
            { creative_suggestion_url: '' },
            authHeaders
        ).catch(() => { /* non-critical */ })
    }

    // { [bundleId]: generatedHtmlString } — cached brief per bundle
    const [cachedBriefHtml, setCachedBriefHtml] = useState({})

    const removeSlotFromBundle = (bundleId, screenId, slotNum) => {
        // Clear cached brief (local + DB) so button resets to 'Creative Suggestion'
        setCachedBriefHtml(prev => { const n = { ...prev }; delete n[bundleId]; return n })
        axios.put(`/api/studio/campaign/${campaignId}/bundles/${bundleId}/`, { creative_suggestion_url: '' }, authHeaders).catch(() => { })
        setBundles(prev => prev.map(bundle => {
            if (bundle.id !== bundleId) return bundle
            const upd = bundle.screens.map(s => s.screenId !== screenId ? s : { ...s, slots: s.slots.filter(sl => sl !== slotNum) }).filter(s => s.slots.length > 0)
            return { ...bundle, screens: upd }
        }))
    }

    const removeScreenFromBundle = (bundleId, screenId) => {
        // Clear cached brief (local + DB) so button resets to 'Creative Suggestion'
        setCachedBriefHtml(prev => { const n = { ...prev }; delete n[bundleId]; return n })
        axios.put(`/api/studio/campaign/${campaignId}/bundles/${bundleId}/`, { creative_suggestion_url: '' }, authHeaders).catch(() => { })
        setBundles(prev => prev.map(b => b.id !== bundleId ? b : { ...b, screens: b.screens.filter(s => s.screenId !== screenId) }))
    }

    const [suggestionLoading, setSuggestionLoading] = useState(null) // bundleId being processed

    // Render a single screen brief section as HTML
    const renderBriefSection = (suggestion) => {
        const brief = suggestion.brief || {}
        const fmt = brief.format_recommendation || {}
        const vis = brief.visual_guidelines || {}
        const strat = brief.content_strategy || {}
        const aud = brief.audience_context || {}
        const restrict = brief.restrictions || {}
        const checklist = brief.production_checklist || []
        const idea = brief.creative_idea || {}

        const colorPills = (vis.color_palette || []).map(c => `<span class="color-pill">${c}</span>`).join('')
        const keyElements = (strat.key_elements || []).map(e => `<li>${e}</li>`).join('')
        const avoidItems = (strat.avoid || []).map(a => `<li>${a}</li>`).join('')
        const bannedTags = (restrict.banned_content || restrict.banned_categories || []).map(c => `<span class="tag red">${c}</span>`).join('')
        const checklistItems = checklist.map(c => `<div class="check-item">${c}</div>`).join('')

        return `
        <div class="screen-section">
          <div class="screen-header">
            <h2>${suggestion.screen_name || `Screen ${suggestion.screen_id}`}</h2>
            <div class="screen-meta">Screen ID: ${suggestion.screen_id} &bull; Slots: ${(suggestion.slots || []).join(', ')}</div>
          </div>
          ${suggestion.error ? `<div class="error-card">⚠️ ${suggestion.error}</div>` : `
          <h3 class="brief-headline">${brief.headline || ''}</h3>

          <div class="section">
            <div class="section-title">Format Specifications</div>
            <div class="grid3">
              <div class="card"><div class="card-label">Resolution</div><div class="card-value">${fmt.resolution || '—'}</div></div>
              <div class="card"><div class="card-label">Duration</div><div class="card-value">${fmt.duration_sec ? fmt.duration_sec + 's' : '—'}</div></div>
              <div class="card"><div class="card-label">Format</div><div class="card-value">${fmt.primary_format || '—'}</div></div>
            </div>
          </div>

          ${vis.style || colorPills ? `
          <div class="section">
            <div class="section-title">Visual Guidelines</div>
            <div class="vis-card">
              <div class="vis-row">
                <div><div class="vis-label">Style</div><div class="vis-value">${vis.style || '—'}</div></div>
                <div><div class="vis-label">Motion</div><div class="vis-value">${vis.motion || '—'}</div></div>
              </div>
              ${colorPills ? `<div><div class="vis-label">Color Palette</div><div style="margin-top:4px">${colorPills}</div></div>` : ''}
            </div>
          </div>` : ''}

          ${strat.primary_message ? `
          <div class="section">
            <div class="section-title">Content Strategy</div>
            <div class="strat-card">
              <div style="margin-bottom:10px"><div class="strat-label">Primary Message</div><div class="strat-value" style="font-size:14px;font-weight:700">${strat.primary_message || '—'}</div></div>
              <div class="vis-row">
                <div><div class="strat-label">Tone</div><div class="strat-value">${strat.tone || '—'}</div></div>
                <div><div class="strat-label">Call to Action</div><div class="strat-value">${strat.call_to_action || '—'}</div></div>
              </div>
              <div class="strat-cols">
                <div class="do-list"><h4>✓ Key Elements</h4><ul>${keyElements || '<li>—</li>'}</ul></div>
                <div class="avoid-list"><h4>✗ Avoid</h4><ul>${avoidItems || '<li>—</li>'}</ul></div>
              </div>
            </div>
          </div>` : ''}

          ${idea.concept ? `
          <div class="section">
            <div class="section-title">Creative Idea</div>
            <div class="card" style="padding:14px">
              <div class="card-label">Concept</div><div class="card-value" style="font-size:13px;font-weight:500;margin-bottom:8px">${idea.concept}</div>
              ${idea.scene_description ? `<div class="card-label" style="margin-top:6px">Scene</div><div style="font-size:12px;color:#334155">${idea.scene_description}</div>` : ''}
            </div>
          </div>` : ''}

          ${checklist.length > 0 ? `
          <div class="section">
            <div class="section-title">Production Checklist</div>
            <div class="checklist">${checklistItems}</div>
          </div>` : ''}
          `}
        </div>`
    }

    // ── File Grouping Algorithm ──────────────────────────────────────────────
    // Screens sharing the same (resolution + duration + format) = ONE unique file.
    // Each different combination = a new file the user must produce.
    // Bundle name is prefixed so filenames are unique across multiple bundles.
    const computeRequiredFiles = (suggestions, bundleName) => {
        const cleanBundle = bundleName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')
        const groups = {}
        suggestions.forEach(s => {
            if (s.error || !s.brief) return
            const fmt = s.brief.format_recommendation || {}
            const resolution = fmt.resolution || '1920x1080'
            const durationSec = fmt.duration_sec ? `${fmt.duration_sec}sec` : '15sec'
            const format = (fmt.primary_format || 'MOV').toUpperCase()
            const key = `${resolution}|${durationSec}|${format}`
            if (!groups[key]) {
                groups[key] = {
                    filename: `${cleanBundle}_${durationSec}_(${resolution}).${format}`,
                    resolution, durationSec, format, screens: []
                }
            }
            groups[key].screens.push({ name: s.screen_name || `Screen ${s.screen_id}`, slots: s.slots || [] })
        })
        return Object.values(groups)
    }

    // Build full brief HTML string (extracted so it can be cached and re-opened)
    const buildBriefHtml = (data, bundle) => {
        const suggestions = data.suggestions || []
        const bundleName = data.bundle_name || bundle.name || 'Bundle'
        const fileGroups = computeRequiredFiles(suggestions, bundleName)

        // ── Files You Need to Create section ──
        const fileRows = fileGroups.map((g, i) => {
            const screenList = g.screens.map(s =>
                `<span class="fs-screen"><strong>${s.name}</strong> &mdash; Slots ${s.slots.join(', ')}</span>`
            ).join('')
            return `
            <div class="file-row">
              <div class="file-num">${i + 1}</div>
              <div class="file-info">
                <div class="file-name">${g.filename}</div>
                <div class="file-specs">
                  <span class="spec-pill">${g.resolution}</span>
                  <span class="spec-pill">${g.durationSec}</span>
                  <span class="spec-pill fmt-pill">${g.format}</span>
                </div>
                <div class="file-screens">${screenList}</div>
              </div>
            </div>`
        }).join('')

        const filesSection = `
        <div class="files-box">
          <div class="files-box-header">
            <div class="files-icon">&#128194;</div>
            <div>
              <div class="files-title">Files You Need to Create &mdash; ${bundleName}</div>
              <div class="files-sub">
                You need <strong>${fileGroups.length} unique ad file${fileGroups.length !== 1 ? 's' : ''}</strong> for this bundle.
                Screens sharing the same resolution &amp; duration can use one file.
                <strong>Name your files exactly as shown</strong> &mdash; the upload page will auto-assign them to the correct screens and slots.
              </div>
            </div>
          </div>
          <div class="file-list">${fileRows}</div>
          ${fileGroups.length > 1
                ? `<div class="files-warn">&#9888;&#65039; Different filenames = different specs. Do NOT upload the same file for all screens — each must match its resolution and duration.</div>`
                : `<div class="files-ok">&#9989; All screens share the same specs — you only need to produce one version of your ad and name it as shown above.</div>`
            }
        </div>`

        const allSections = suggestions.map(s => renderBriefSection(s)).join('<hr class="screen-divider">')

        return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Creative Briefs — ${bundleName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; color:#1e293b; background:#fff; }
  .page { max-width:860px; margin:auto; padding:36px 40px; }
  .cover { background:linear-gradient(135deg,#1e3a8a,#3b82f6); color:#fff; padding:28px 32px; border-radius:12px; margin-bottom:24px; }
  .cover h1 { font-size:22px; font-weight:800; margin-bottom:4px; }
  .cover .sub { font-size:12px; opacity:.85; }

  .files-box { background:linear-gradient(135deg,#fffbeb,#fefce8); border:2px solid #f59e0b; border-radius:14px; padding:20px 22px; margin-bottom:32px; }
  .files-box-header { display:flex; align-items:flex-start; gap:14px; margin-bottom:16px; }
  .files-icon { font-size:26px; flex-shrink:0; }
  .files-title { font-size:14px; font-weight:800; color:#78350f; margin-bottom:4px; }
  .files-sub { font-size:12px; color:#92400e; line-height:1.65; }
  .file-list { display:flex; flex-direction:column; gap:10px; }
  .file-row { display:flex; align-items:flex-start; gap:12px; background:#fff; border:1px solid #fde68a; border-radius:10px; padding:12px 14px; }
  .file-num { background:#f59e0b; color:#fff; font-size:11px; font-weight:800; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
  .file-name { font-family:monospace; font-size:13px; font-weight:700; color:#0f172a; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:6px; padding:4px 10px; display:inline-block; margin-bottom:7px; letter-spacing:.4px; }
  .file-specs { display:flex; gap:6px; margin-bottom:6px; flex-wrap:wrap; }
  .spec-pill { background:#1e3a8a; color:#fff; font-size:10px; font-weight:700; border-radius:20px; padding:2px 9px; }
  .fmt-pill { background:#0891b2; }
  .file-screens { font-size:11px; color:#475569; }
  .fs-screen { display:inline-block; margin-right:12px; margin-top:2px; }
  .files-warn { margin-top:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:9px 12px; font-size:11px; color:#991b1b; font-weight:500; }
  .files-ok { margin-top:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:9px 12px; font-size:11px; color:#166534; font-weight:500; }

  .screen-section { margin-bottom:32px; }
  .screen-header { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 18px; margin-bottom:16px; }
  .screen-header h2 { font-size:16px; font-weight:700; color:#0f172a; }
  .screen-meta { font-size:11px; color:#64748b; margin-top:2px; }
  .brief-headline { font-size:15px; font-weight:700; color:#1e40af; margin-bottom:14px; }
  .error-card { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; color:#991b1b; font-size:13px; }
  .screen-divider { border:none; border-top:2px dashed #e2e8f0; margin:32px 0; }
  .section { margin-bottom:16px; }
  .section-title { font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; display:flex; align-items:center; gap:8px; }
  .section-title::after { content:''; flex:1; height:1px; background:#e2e8f0; }
  .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; }
  .card-label { font-size:9px; color:#94a3b8; text-transform:uppercase; font-weight:600; margin-bottom:3px; }
  .card-value { font-size:13px; font-weight:600; color:#0f172a; }
  .vis-card { background:linear-gradient(135deg,#fefce8,#fff7ed); border:1px solid #fde68a; border-radius:10px; padding:14px; }
  .vis-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px; }
  .vis-label { font-size:10px; color:#92400e; text-transform:uppercase; font-weight:700; margin-bottom:2px; }
  .vis-value { font-size:12px; font-weight:500; color:#451a03; }
  .color-pill { display:inline-block; font-size:11px; font-weight:600; padding:2px 8px; border-radius:20px; margin:2px 3px; background:#fff; border:1px solid #e2e8f0; color:#334155; }
  .strat-card { background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px; }
  .strat-label { font-size:10px; color:#0369a1; text-transform:uppercase; font-weight:700; margin-bottom:3px; }
  .strat-value { font-size:12px; color:#0c4a6e; font-weight:500; }
  .strat-cols { display:grid; grid-template-columns:1.2fr 1fr; gap:12px; margin-top:10px; }
  .do-list { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px; }
  .avoid-list { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:10px; }
  .do-list h4 { font-size:10px; color:#16a34a; text-transform:uppercase; font-weight:700; margin-bottom:5px; }
  .avoid-list h4 { font-size:10px; color:#dc2626; text-transform:uppercase; font-weight:700; margin-bottom:5px; }
  ul { padding-left:14px; font-size:11px; line-height:1.9; }
  .checklist { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 14px; }
  .check-item { font-size:12px; font-weight:500; color:#166534; padding:3px 0; border-bottom:1px solid #dcfce7; }
  .check-item:last-child { border-bottom:none; }
  .footer { margin-top:28px; text-align:center; color:#94a3b8; font-size:10px; border-top:1px solid #e2e8f0; padding-top:10px; }
  @media print { .page { padding:20px 28px; } }
</style></head><body>
<div class="page">
  <div class="cover">
    <h1>&#10022; Creative Briefs — ${bundleName}</h1>
    <div class="sub">${suggestions.length} screen${suggestions.length !== 1 ? 's' : ''} &bull; ${fileGroups.length} unique file${fileGroups.length !== 1 ? 's' : ''} required &bull; Generated by XIA &bull; XIGI Platform</div>
  </div>
  ${filesSection}
  ${allSections}
  <div class="footer">Generated by XIA &middot; XIGI Platform &middot; ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
</div></body></html>`
    }

    // Open a creative brief: if value is a server URL (/media/...), open as a tab directly.
    // If it's raw HTML, write it into a new window.
    const openHtmlInTab = (htmlOrUrl) => {
        if (htmlOrUrl && htmlOrUrl.startsWith('/media/')) {
            window.open(htmlOrUrl, '_blank')
            return
        }
        // Raw HTML fallback (in-session only)
        const w = window.open('', '_blank', 'width=940,height=1060')
        if (!w) {
            const blob = new Blob([htmlOrUrl], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'creative_brief.html'
            a.click()
            URL.revokeObjectURL(url)
            return
        }
        w.document.write(htmlOrUrl)
        w.document.close()
        setTimeout(() => w.print(), 600)
    }

    const handleCreativeSuggestion = async (bundle) => {
        setSuggestionLoading(bundle.id)
        try {
            const token = localStorage.getItem('token')
            let userId = localStorage.getItem('userId') || ''
            if (token) {
                try {
                    const verifyRes = await axios.get('/api/studio/verify-token/', { headers: { Authorization: `Bearer ${token}` } })
                    userId = String(verifyRes.data.user_id)
                } catch { /* fallback to stored */ }
            }

            const screenSlotsPayload = bundle.screens.map(s => ({
                screen_id: Number(s.screenId),
                slots: s.slots
            }))

            const payload = {
                user_id: userId,
                campaign_id: campaignId,
                bundle_id: Number(bundle.id),
                bundle_name: bundle.name,
                screen_slots: screenSlotsPayload,
            }

            // Call XIA — timeout 60s (about 3s per screen)
            const response = await axios.post('/xia/creative-suggestion/', payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000,
            })

            // Build the HTML brief
            const htmlStr = buildBriefHtml(response.data, bundle)

            // Compute the file groups for the upload page (same source of truth as PDF)
            const fileGroups = computeRequiredFiles(response.data.suggestions || [], response.data.bundle_name || bundle.name || 'Bundle')

            // Persist to Studio backend: saves to media/creative_briefs/ and updates DB
            const saveRes = await axios.post(
                `/api/studio/campaign/${campaignId}/bundles/${bundle.id}/creative-file/`,
                { html: htmlStr },
                authHeaders
            )
            const serverUrl = saveRes.data?.url || ''

            // Cache the server URL — survives refresh
            setCachedBriefHtml(prev => ({ ...prev, [bundle.id]: serverUrl }))

            // Update local bundle state
            setBundles(prev => prev.map(b =>
                b.id === bundle.id
                    ? { ...b, status: 'Suggestion Ready', creative_suggestion_url: serverUrl, fileGroups }
                    : b
            ))

        } catch (err) {
            console.error('[Creative Suggestion] Error:', err)
            alert(`Creative Suggestion failed: ${err.response?.data?.error || err.message}`)
        } finally {
            setSuggestionLoading(null)
        }
    }

    const getAssignedSlots = (screenId) => {
        const assigned = []
        bundles.forEach(b => b.screens.forEach(s => { if (s.screenId === screenId) assigned.push(...s.slots) }))
        return assigned
    }

    const [savingManifest, setSavingManifest] = useState(false)

    const handleSaveManifest = async () => {
        if (!campaignId) return
        setSavingManifest(true)
        try {
            // Creates CampaignAsset rows from SlotBookings on the Console backend
            await axios.post(`/api/console/campaign/${campaignId}/manifest/`, {})
        } catch (err) {
            // Non-blocking: manifest rows might already exist — still navigate
            console.warn('[Manifest] POST failed (may already exist):', err.response?.data || err.message)
        } finally {
            setSavingManifest(false)
        }
        navigate(`/creative-manifest-builder?campaignId=${encodeURIComponent(campaignId)}`, {
            state: { selectedScreens: screenData, slotCount, campaignId, bundles, fromBundle: true }
        })
    }

    if (loading) {
        return (
            <div className="sb-page"><Header />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                    <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
                </div>
            </div>
        )
    }

    return (
        <div className="sb-page">
            <Header />

            {/* ── Page Header ── */}
            <div className="sb-topbar">
                <button className="sb-topbar-back" onClick={() => navigate(-1)}>
                    <i className="bi bi-arrow-left"></i>
                </button>
                <div>
                    <div className="sb-topbar-title">Creative Preparation <span className="sb-topbar-info">ⓘ</span></div>
                    <div className="sb-topbar-sub">Prepare, upload, and validate creatives before scheduling.</div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="sb-content">
                {/* Left: Screen Cards */}
                <div className="sb-screens">
                    {screenData.map(screen => {
                        const sel = screenSelections[screen.id] || { selectedSlots: [], selectedBundle: '' }
                        const totalSlots = screen.slot_count || 1
                        const allSlots = Array.from({ length: totalSlots }, (_, i) => i + 1)
                        const assignedSlots = getAssignedSlots(screen.id)
                        const availableSlots = allSlots.filter(s => !assignedSlots.includes(s))
                        const allSelected = availableSlots.length > 0 && availableSlots.every(s => sel.selectedSlots.includes(s))

                        return (
                            <div key={screen.id} className="sb-card">
                                <div className="sb-card-top">
                                    <div className="sb-card-info">
                                        <div className="sb-card-name">{screen.name}</div>
                                        <div className="sb-card-meta">{screen.screen_id_display || `S-${String(screen.id).padStart(3, '0')}`} · {screen.location}</div>
                                    </div>
                                </div>
                                <div className="sb-slots">
                                    <button className={`sb-slot ${allSelected ? 'active' : ''}`} onClick={() => toggleAllSlots(screen.id, totalSlots)} disabled={availableSlots.length === 0 || bundles.length === 0}>All Slot</button>
                                    {allSlots.map(n => {
                                        const isAssigned = assignedSlots.includes(n)
                                        return (
                                            <button
                                                key={n}
                                                className={`sb-slot ${sel.selectedSlots.includes(n) ? 'active' : ''} ${isAssigned ? 'assigned' : ''}`}
                                                onClick={() => toggleSlot(screen.id, n)}
                                                disabled={isAssigned || bundles.length === 0}
                                            >
                                                Slot {n}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}

                    {/* Bundle Selection placed at the end of the screen list */}
                    {screenData.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                            <select
                                className="sb-select"
                                value={globalSelectedBundle}
                                onChange={(e) => setGlobalSelectedBundle(e.target.value)}
                                disabled={Object.values(screenSelections).every(sel => !sel || sel.selectedSlots.length === 0)}
                            >
                                <option value="">Select Bundle</option>
                                {bundles.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                            <button
                                className="sb-btn-submit"
                                disabled={!globalSelectedBundle || Object.values(screenSelections).every(sel => !sel || sel.selectedSlots.length === 0)}
                                onClick={handleGlobalSubmit}
                            >
                                Submit
                            </button>
                        </div>
                    )}
                </div>

                {/* Right: Bundle Sidebar */}
                <div className="sb-sidebar">
                    <div className="sb-sidebar-top">
                        <div className="sb-sidebar-heading">Screen Bundle</div>
                        {bundles.length > 0 && (
                            <button className="sb-btn-create" onClick={() => setShowCreateModal(true)}>Create Bundle</button>
                        )}
                    </div>
                    <div className="sb-sidebar-count">No of bundle: {bundles.length}</div>

                    {bundles.length === 0 ? (
                        <div className="sb-sidebar-empty">
                            <div className="sb-sidebar-empty-title">Screen Bundle</div>
                            <div className="sb-sidebar-empty-desc">bundle Your Creatives based on Slot</div>
                            <button className="sb-btn-create-large" onClick={() => setShowCreateModal(true)}>Create bundle</button>
                        </div>
                    ) : (
                        <div className="sb-bundle-list">
                            {bundles.map(bundle => (
                                <div key={bundle.id} className="sb-bundle">
                                    <div className="sb-bundle-head">
                                        <span className="sb-bundle-title">{bundle.name}</span>
                                        <button className="sb-bundle-del" onClick={() => handleDeleteBundle(bundle.id)}><i className="bi bi-trash-fill"></i></button>
                                    </div>
                                    {bundle.screens.length === 0 ? (
                                        <div className="sb-bundle-placeholder"><span>+</span>Add Your slots</div>
                                    ) : (
                                        <>
                                            {bundle.screens.map(s => (
                                                <div key={s.screenId} className="sb-bundle-row">
                                                    <span className="sb-bundle-sname">{s.screenName}</span>
                                                    {s.slots.map(slot => (
                                                        <span key={slot} className="sb-tag">Slot {slot} <span className="sb-tag-x" onClick={() => removeSlotFromBundle(bundle.id, s.screenId, slot)}>×</span></span>
                                                    ))}
                                                    <button className="sb-bundle-del" onClick={() => removeScreenFromBundle(bundle.id, s.screenId)} style={{ marginLeft: 'auto' }}><i className="bi bi-trash-fill"></i></button>
                                                </div>
                                            ))}
                                            {/* Button: 'Open Creative' if cached, else 'Creative Suggestion' */}
                                            {cachedBriefHtml[bundle.id] ? (
                                                <button
                                                    className="sb-btn-suggest sb-btn-open-creative"
                                                    onClick={() => openHtmlInTab(cachedBriefHtml[bundle.id], bundle.name)}
                                                >
                                                    <i className="bi bi-file-earmark-person"></i> Open Creative
                                                </button>
                                            ) : (
                                                <button
                                                    className="sb-btn-suggest"
                                                    onClick={() => handleCreativeSuggestion(bundle)}
                                                    disabled={suggestionLoading === bundle.id}
                                                >
                                                    {suggestionLoading === bundle.id ? (
                                                        <><i className="bi bi-arrow-repeat spin-icon"></i> Generating briefs...</>
                                                    ) : (
                                                        <><i className="bi bi-magic"></i> Creative Suggestion</>
                                                    )}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="sb-footer">
                <button className="sb-btn-back" onClick={() => navigate(-1)}>Back to Screen Spec Review</button>
                {/* Gate: all bundles with slots must have Suggestion Ready */}
                {(() => {
                    const bundlesWithSlots = bundles.filter(b => b.screens.length > 0)
                    const allReady = bundlesWithSlots.length > 0 &&
                        bundlesWithSlots.every(b => b.status === 'Suggestion Ready')
                    const notReadyCount = bundlesWithSlots.filter(b => b.status !== 'Suggestion Ready').length
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            {!allReady && bundlesWithSlots.length > 0 && (
                                <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 500 }}>
                                    ⚠ {notReadyCount} bundle{notReadyCount > 1 ? 's' : ''} need Creative Suggestion first
                                </div>
                            )}
                            <button
                                className="sb-btn-save"
                                onClick={handleSaveManifest}
                                disabled={savingManifest || !allReady}
                                title={!allReady ? 'Complete Creative Suggestion for all bundles first' : ''}
                            >
                                {savingManifest ? (
                                    <><i className="bi bi-arrow-repeat spin-icon"></i> Preparing...</>
                                ) : 'Save Manifest & Upload Assets'}
                            </button>
                        </div>
                    )
                })()}
            </div>

            {/* ── Modal ── */}
            {showCreateModal && (
                <div className="sb-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="sb-modal" onClick={e => e.stopPropagation()}>
                        <div className="sb-modal-title">Bundle Name</div>
                        <input className="sb-modal-input" type="text" placeholder="Enter bundle name" value={newBundleName} onChange={e => setNewBundleName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreateBundle()} autoFocus />
                        <button className="sb-modal-btn" onClick={handleCreateBundle} disabled={!newBundleName.trim()}>Create bundle</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ScreenBundlePage
