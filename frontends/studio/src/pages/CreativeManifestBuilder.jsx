import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Header from '../components/Header';
import AlertModal from '../components/Common/AlertModal';
import '../styles/creativeManifestBuilder.css';
import { useXiaContext } from '../context/XiaContext';

// const API_BASE_URL = 'http://127.0.0.1:8000';





const SlotRow = ({ slotNumber, mappedFile, slotDuration }) => (
    <div className="slot-item">
        <div className="slot-col-id">Slot {slotNumber}</div>
        <div className="slot-col-duration">
            <span className="duration-badge">{slotDuration ? `${slotDuration}s Slot Group` : 'Slot Group'}</span>
        </div>
        <div className="slot-col-assignment">
            <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%' }} title={mappedFile}>
                {mappedFile}
            </span>
        </div>
        <div className="slot-col-status">
            <span className="status-mapped">
                <i className="bi bi-check-circle-fill"></i> Ready
            </span>
        </div>
    </div>
);

const ScreenMappingGroup = ({ screen, mappings }) => {
    const slotsCount = screen.slot_count || 1;
    // Get duration from screen rules (set during ScreenSpecReview enrichment)
    const slotDuration = screen.rules?.adDuration || screen.specs?.standard_ad_duration_sec || null;
    // Get real constraints from screen data
    const aspectRatio = screen.specs?.aspect_ratio || '16:9';
    const formats = screen.specs?.supported_formats_json || ['MP4'];
    const formatTags = Array.isArray(formats) ? formats : [formats];

    const slots = Array.from({ length: slotsCount }, (_, i) => ({
        id: i + 1,
        mappedFile: mappings[screen.id]?.[i + 1] || ''
    }));

    return (
        <div className="screen-group-card">
            <div className="screen-group-header">
                <div className="group-left">
                    <div className="group-name">{screen.name}</div>
                    <div className="group-meta">S-00{screen.id} • {screen.location}</div>
                </div>
                <div className="constraints-tags">
                    <div className="constraints-label">Creative Constraints</div>
                    <div className="tag-group">
                        {slotDuration && <span className="constraint-tag">{slotDuration}s</span>}
                        <span className="constraint-tag">{aspectRatio}</span>
                        {formatTags.slice(0, 2).map(f => (
                            <span key={f} className="constraint-tag">{f}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="slots-table">
                <div className="slots-header-row">
                    <div className="col-slot">Slot</div>
                    <div className="col-group">Slot Group/Duration</div>
                    <div className="col-file">Auto-assigned File Name</div>
                    <div className="col-status">Status</div>
                </div>
                {slots.map(slot => (
                    <SlotRow
                        key={slot.id}
                        slotNumber={slot.id}
                        mappedFile={slot.mappedFile}
                        slotDuration={slotDuration}
                    />
                ))}
            </div>
        </div>
    );
};

const AssetUploadView = ({ screens, mappings, campaignId, initialUploadedFiles = {}, initialAssetStatuses = {} }) => {
    const navigate = useNavigate();
    const fileInputRefs = React.useRef({});
    const bulkFileInputRefs = React.useRef({});
    const [uploadedFiles, setUploadedFiles] = useState(initialUploadedFiles);
    const [assetStatuses, setAssetStatuses] = useState(initialAssetStatuses);
    const [uploading, setUploading] = useState(null);
    const [bulkUploading, setBulkUploading] = useState(null);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error' });
    const [bulkSlotSelections, setBulkSlotSelections] = useState({});
    const [suggestionLoading, setSuggestionLoading] = useState(null); // screenId being fetched

    // --- Creative Suggestion: POST to XIA and download PDF ---
    const downloadSuggestionPdf = (data) => {
        const brief = data.suggestion || data.creative_brief || {};
        const fmt = brief.format_recommendation || {};
        const vis = brief.visual_guidelines || {};
        const strat = brief.content_strategy || {};
        const aud = brief.audience_context || {};
        const restrict = brief.restrictions || {};
        const checklist = brief.production_checklist || [];

        const colorPills = (vis.color_palette || []).map(c =>
            `<span class="color-pill">${c}</span>`
        ).join('');
        const keyElements = (strat.key_elements || []).map(e => `<li>${e}</li>`).join('');
        const avoidItems = (strat.avoid || []).map(a => `<li>${a}</li>`).join('');
        const bannedTags = (restrict.banned_categories || []).map(c => `<span class="tag red">${c}</span>`).join('');
        const zoneTags = (restrict.sensitive_zones || []).map(z => `<span class="tag amber">${z}</span>`).join('');
        const checklistItems = checklist.map(c => `<div class="check-item">${c}</div>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Creative Brief — ${brief.headline || 'Screen'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; color:#1e293b; padding:0; background:#fff; }
  .page { max-width:820px; margin:auto; padding:36px 40px; }

  /* Header */
  .header { background:linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color:#fff; padding:28px 32px; border-radius:12px; margin-bottom:24px; }
  .header h1 { font-size:20px; font-weight:800; letter-spacing:-0.3px; margin-bottom:4px; }
  .header .sub { font-size:12px; opacity:0.85; font-weight:500; }

  /* Sections */
  .section { margin-bottom:20px; }
  .section-title { font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; display:flex; align-items:center; gap:8px; }
  .section-title::after { content:''; flex:1; height:1px; background:#e2e8f0; }

  /* Cards */
  .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; }
  .card-label { font-size:9px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:3px; }
  .card-value { font-size:13px; font-weight:600; color:#0f172a; }

  /* Visual Guidelines */
  .vis-card { background:linear-gradient(135deg, #fefce8 0%, #fff7ed 100%); border:1px solid #fde68a; border-radius:10px; padding:16px; }
  .vis-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:10px; }
  .vis-row:last-child { margin-bottom:0; }
  .vis-label { font-size:10px; color:#92400e; text-transform:uppercase; font-weight:700; margin-bottom:3px; }
  .vis-value { font-size:12px; font-weight:500; color:#451a03; line-height:1.5; }

  /* Color palette */
  .color-pill { display:inline-block; font-size:11px; font-weight:600; padding:3px 10px; border-radius:20px; margin:2px 3px; background:#fff; border:1px solid #e2e8f0; color:#334155; }

  /* Strategy */
  .strat-card { background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:16px; }
  .strat-label { font-size:10px; color:#0369a1; text-transform:uppercase; font-weight:700; margin-bottom:4px; }
  .strat-value { font-size:12px; color:#0c4a6e; line-height:1.5; font-weight:500; }
  .strat-cols { display:grid; grid-template-columns:1.2fr 1fr; gap:14px; margin-top:12px; }
  .do-list { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px; }
  .avoid-list { background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px; }
  .do-list h4 { font-size:10px; text-transform:uppercase; color:#16a34a; font-weight:700; margin-bottom:6px; }
  .avoid-list h4 { font-size:10px; text-transform:uppercase; color:#dc2626; font-weight:700; margin-bottom:6px; }
  ul { padding-left:16px; font-size:11px; line-height:1.8; }

  /* Audience */
  .aud-card { background:#faf5ff; border:1px solid #e9d5ff; border-radius:10px; padding:16px; }
  .aud-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .aud-label { font-size:10px; color:#7c3aed; text-transform:uppercase; font-weight:700; margin-bottom:3px; }
  .aud-value { font-size:12px; color:#3b0764; font-weight:500; line-height:1.5; }

  /* Tags */
  .tag { display:inline-block; font-size:10px; font-weight:600; padding:3px 10px; border-radius:4px; margin:2px 3px; }
  .tag.red { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; }
  .tag.amber { background:#fffbeb; color:#b45309; border:1px solid #fde68a; }
  .tags-row { margin-top:6px; }

  /* Checklist */
  .checklist { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 16px; }
  .check-item { font-size:12px; font-weight:500; color:#166534; padding:4px 0; border-bottom:1px solid #dcfce7; line-height:1.5; }
  .check-item:last-child { border-bottom:none; }

  /* Restrictions */
  .restrict-card { background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px 16px; }
  .restrict-note { font-size:11px; color:#991b1b; font-weight:500; font-style:italic; margin-top:8px; }

  .footer { margin-top:24px; text-align:center; color:#94a3b8; font-size:10px; border-top:1px solid #e2e8f0; padding-top:10px; }
  @media print { body { padding:0; } .page { padding:20px 28px; } .header { break-inside:avoid; } }
</style></head><body>
<div class="page">
  <div class="header">
    <h1>✦ ${brief.headline || 'Creative Brief'}</h1>
    <div class="sub">Generated by XIA · XIGI Platform</div>
  </div>

  <div class="section">
    <div class="section-title">Format Specifications</div>
    <div class="grid3">
      <div class="card"><div class="card-label">Resolution</div><div class="card-value">${fmt.resolution || '—'} ${fmt.aspect_ratio ? `(${fmt.aspect_ratio})` : ''}</div></div>
      <div class="card"><div class="card-label">Orientation</div><div class="card-value">${fmt.orientation || '—'}</div></div>
      <div class="card"><div class="card-label">Duration</div><div class="card-value">${fmt.duration_sec ? fmt.duration_sec + 's' : '—'}</div></div>
      <div class="card"><div class="card-label">Primary Format</div><div class="card-value">${fmt.primary_format || '—'}</div></div>
      <div class="card"><div class="card-label">Fallback</div><div class="card-value">${fmt.fallback_format || '—'}</div></div>
      <div class="card"><div class="card-label">Max File Size</div><div class="card-value">${fmt.max_file_size || '—'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Visual Guidelines</div>
    <div class="vis-card">
      <div class="vis-row">
        <div><div class="vis-label">Style</div><div class="vis-value">${vis.style || '—'}</div></div>
        <div><div class="vis-label">Text Size</div><div class="vis-value">${vis.text_size || '—'}</div></div>
      </div>
      <div class="vis-row">
        <div><div class="vis-label">Brightness Note</div><div class="vis-value">${vis.brightness_note || '—'}</div></div>
        <div><div class="vis-label">Motion</div><div class="vis-value">${vis.motion || '—'}</div></div>
      </div>
      ${colorPills ? `<div><div class="vis-label">Color Palette</div><div style="margin-top:4px;">${colorPills}</div></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Content Strategy</div>
    <div class="strat-card">
      <div style="margin-bottom:10px;">
        <div class="strat-label">Primary Message</div>
        <div class="strat-value" style="font-size:14px;font-weight:700;">${strat.primary_message || '—'}</div>
      </div>
      <div class="vis-row">
        <div><div class="strat-label">Tone</div><div class="strat-value">${strat.tone || '—'}</div></div>
        <div><div class="strat-label">Call to Action</div><div class="strat-value">${strat.call_to_action || '—'}</div></div>
      </div>
      <div class="strat-cols">
        <div class="do-list"><h4>✓ Key Elements</h4><ul>${keyElements || '<li>—</li>'}</ul></div>
        <div class="avoid-list"><h4>✗ Avoid</h4><ul>${avoidItems || '<li>—</li>'}</ul></div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Audience Context</div>
    <div class="aud-card">
      <div class="aud-grid">
        <div><div class="aud-label">Who Sees This</div><div class="aud-value">${aud.who_sees_this || '—'}</div></div>
        <div><div class="aud-label">Viewing Behavior</div><div class="aud-value">${aud.viewing_behavior || '—'}</div></div>
        <div><div class="aud-label">Attention Span</div><div class="aud-value">${aud.attention_span || '—'}</div></div>
        <div><div class="aud-label">Best Time Context</div><div class="aud-value">${aud.best_time_context || '—'}</div></div>
      </div>
    </div>
  </div>

  ${bannedTags || zoneTags || restrict.compliance_notes ? `<div class="section">
    <div class="section-title">Content Restrictions</div>
    <div class="restrict-card">
      ${bannedTags ? `<div><strong style="font-size:10px;color:#991b1b;text-transform:uppercase;">Banned Categories:</strong><div class="tags-row">${bannedTags}</div></div>` : ''}
      ${zoneTags ? `<div style="margin-top:8px;"><strong style="font-size:10px;color:#92400e;text-transform:uppercase;">Sensitive Zones:</strong><div class="tags-row">${zoneTags}</div></div>` : ''}
      ${restrict.compliance_notes ? `<div class="restrict-note">${restrict.compliance_notes}</div>` : ''}
    </div>
  </div>` : ''}

  ${checklist.length > 0 ? `<div class="section">
    <div class="section-title">Production Checklist</div>
    <div class="checklist">${checklistItems}</div>
  </div>` : ''}

  <div class="footer">Generated by XIA · XIGI Platform · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
</div>
</body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) {
            // Popup blocked — fall back to current-window approach
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `creative_brief_${brief.headline ? brief.headline.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40) : 'screen'}.html`;
            a.click();
            URL.revokeObjectURL(url);
            return;
        }
        w.document.write(html);
        w.document.close();
        setTimeout(() => { w.print(); }, 500);
    };

    const handleCreativeSuggestion = async (screenId) => {
        setSuggestionLoading(screenId);
        try {
            const token = localStorage.getItem('token');
            let userId = localStorage.getItem('userId') || '';
            if (token) {
                try {
                    const verifyRes = await axios.get('/api/studio/verify-token/', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    userId = String(verifyRes.data.user_id);
                } catch { /* fallback to stored */ }
            }

            const response = await axios.post('/xia/creative-suggestion/', {
                user_id: userId,
                campaign_id: campaignId,
                screen_id: String(screenId),
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            downloadSuggestionPdf(response.data);
        } catch (err) {
            console.error('[Creative Suggestion] Error:', err);
            setAlert({
                show: true,
                title: 'Creative Suggestion Failed',
                message: err.response?.data?.error || err.response?.data?.detail || 'Could not generate creative suggestion. Please try again.',
                type: 'error'
            });
        } finally {
            setSuggestionLoading(null);
        }
    };

    // Sync if parent re-fetches (e.g., after later prop update)
    useEffect(() => {
        if (Object.keys(initialUploadedFiles).length > 0) {
            setUploadedFiles(prev => ({ ...prev, ...initialUploadedFiles }));
        }
    }, [initialUploadedFiles]);

    useEffect(() => {
        if (Object.keys(initialAssetStatuses).length > 0) {
            setAssetStatuses(prev => ({ ...prev, ...initialAssetStatuses }));
        }
    }, [initialAssetStatuses]);

    // Get all mapped slots across all screens
    const allMappedSlots = [];
    screens.forEach(screen => {
        const screenMappings = mappings[screen.id] || {};
        Object.entries(screenMappings).forEach(([slotId, fileName]) => {
            if (fileName && fileName.trim() !== '') {
                allMappedSlots.push({ screen, slotId, fileName });
            }
        });
    });

    // Group slots by screen for bulk upload
    const slotsByScreen = useMemo(() => {
        const grouped = {};
        allMappedSlots.forEach(item => {
            if (!grouped[item.screen.id]) {
                grouped[item.screen.id] = { screen: item.screen, slots: [] };
            }
            grouped[item.screen.id].slots.push(item);
        });
        return grouped;
    }, [allMappedSlots.length]);

    // Initialize bulk slot selections (all checked by default)
    useEffect(() => {
        const initial = {};
        Object.entries(slotsByScreen).forEach(([screenId, { slots }]) => {
            if (!bulkSlotSelections[screenId]) {
                const sel = {};
                slots.forEach(s => { sel[s.slotId] = true; });
                initial[screenId] = sel;
            }
        });
        if (Object.keys(initial).length > 0) {
            setBulkSlotSelections(prev => ({ ...initial, ...prev }));
        }
    }, [Object.keys(slotsByScreen).join(',')]);

    // Count approved slots (validation_status can be 'approved' or 'passed')
    const approvedCount = allMappedSlots.filter(item => {
        const key = `${item.screen.id}-${item.slotId}`;
        const vs = assetStatuses[key]?.validation_status;
        return vs === 'approved' || vs === 'passed';
    }).length;
    const allApproved = approvedCount === allMappedSlots.length && allMappedSlots.length > 0;

    const handleBrowseClick = (id) => {
        if (fileInputRefs.current[id]) fileInputRefs.current[id].click();
    };

    // Helper: get media metadata (duration + dimensions) from a file
    const getMediaMeta = (file) => {
        return new Promise((resolve) => {
            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');

            if (isVideo) {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                    URL.revokeObjectURL(video.src);
                    resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
                };
                video.onerror = () => { URL.revokeObjectURL(video.src); resolve({}); };
                video.src = URL.createObjectURL(file);
            } else if (isImage) {
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(img.src); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
                img.onerror = () => { URL.revokeObjectURL(img.src); resolve({}); };
                img.src = URL.createObjectURL(file);
            } else {
                resolve({});
            }
        });
    };

    const handleFileChange = async (uniqueId, item, event) => {
        const file = event.target.files[0];
        if (!file) return;

        const screen = item.screen;
        const errors = [];

        // --- 1. Format check ---
        const rawFormats = screen.specs?.format || '';
        const allowedFormats = rawFormats ? rawFormats.split(' / ').map(f => f.trim().toUpperCase()) : [];
        const ext = file.name.split('.').pop().toUpperCase();
        // Normalize JPEG ↔ JPG
        const normalizedExt = ext === 'JPEG' ? 'JPG' : ext;
        if (allowedFormats.length > 0 && !allowedFormats.includes(normalizedExt) && !allowedFormats.includes(ext)) {
            errors.push(`Format not allowed: .${ext.toLowerCase()}. Accepted: ${allowedFormats.join(', ')}`);
        }

        // --- 2. File size check ---
        const maxMb = parseFloat(screen.specs?.maxSize) || 50;
        const fileMb = file.size / (1024 * 1024);
        if (fileMb > maxMb) {
            errors.push(`File is ${fileMb.toFixed(1)} MB — max allowed is ${maxMb} MB`);
        }

        // If format or size fails, reject immediately (no need to load media)
        if (errors.length > 0) {
            setAlert({ show: true, title: 'Upload Rejected', message: errors.join('\n'), type: 'error' });
            event.target.value = ''; // Reset file input
            return;
        }

        // --- 3, 4, 5. Duration + Resolution + Audio (need to load media) ---
        setUploading(uniqueId);
        const meta = await getMediaMeta(file);

        // Duration check (video only)
        const maxDuration = screen.rules?.adDuration;
        if (meta.duration && maxDuration && meta.duration > maxDuration + 0.5) {
            errors.push(`Video is ${meta.duration.toFixed(1)}s — max allowed is ${maxDuration}s`);
        }

        // Resolution check — file dimensions must match screen resolution
        if (meta.width && meta.height) {
            const screenRes = screen.specs?.resolution || '';
            if (screenRes && screenRes !== '—') {
                const [reqW, reqH] = screenRes.split('x').map(Number);
                if (reqW && reqH && (meta.width !== reqW || meta.height !== reqH)) {
                    errors.push(`Resolution mismatch: file is ${meta.width}×${meta.height}, screen requires ${reqW}×${reqH}`);
                }
            }

            // Orientation check
            const reqOrientation = screen.specs?.orientation || '';
            if (reqOrientation) {
                const isFileLandscape = meta.width >= meta.height;
                const isScreenLandscape = reqOrientation.toLowerCase() === 'landscape';
                if (isFileLandscape !== isScreenLandscape) {
                    const fileOrientation = isFileLandscape ? 'Landscape' : 'Portrait';
                    errors.push(`File is ${fileOrientation} (${meta.width}×${meta.height}) but screen requires ${reqOrientation}`);
                }
            }
        }

        // Audio notice — inform user if screen doesn't support audio (non-blocking)
        let audioWarning = false;
        if (file.type.startsWith('video/') && screen.specs?.audioRule === 'Not Allowed') {
            audioWarning = true;
        }

        if (errors.length > 0) {
            setUploading(null);
            setAlert({ show: true, title: 'Upload Rejected', message: errors.join('\n'), type: 'error' });
            event.target.value = '';
            return;
        }

        // Show audio warning immediately (non-blocking — upload still proceeds)
        if (audioWarning) {
            setAlert({ show: true, title: 'Audio Not Supported', message: `Note: "${item.screen.name}" does not support audio. Your video's audio will be muted during playback.`, type: 'warning' });
        }

        // --- All checks passed — proceed to upload ---
        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_name', file.name);
        formData.append('file_size', file.size);
        formData.append('file_type', file.type);
        formData.append('slot_number', item.slotId);
        formData.append('screen_id', item.screen.id);

        try {
            const res = await axios.post(`/api/console/campaign/${campaignId}/assets/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const assetData = res.data?.data || res.data;
            // Clear this asset from the deleted list (re-upload to same slot should work)
            clearDeletedIds([assetData.id]);
            setUploadedFiles(prev => ({
                ...prev,
                [uniqueId]: { name: file.name, id: assetData.id, url: assetData.file?.url || assetData.file_url || '' }
            }));
            // Track validation status (starts as pending after upload)
            setAssetStatuses(prev => ({
                ...prev,
                [uniqueId]: {
                    id: assetData.id,
                    status: assetData.status || 'uploaded',
                    validation_status: assetData.validation_status || 'pending',
                    validation_errors: assetData.validation_errors || null,
                    file_url: assetData.file?.url || assetData.file_url || ''
                }
            }));
        } catch (error) {
            const backendData = error.response?.data;
            let displayMsg = backendData?.error || backendData?.message || error.message;
            if (backendData?.errors) {
                displayMsg += '\n\n' + Object.entries(backendData.errors)
                    .map(([f, msgs]) => `${f}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`).join('\n');
            }
            setAlert({ show: true, title: 'Upload Failed', message: `Upload failed: ${displayMsg}`, type: 'error' });
        } finally {
            setUploading(null);
        }
    };

    // Validate a file against screen specs (reusable for both individual and bulk)
    const validateFile = async (file, screen) => {
        const errors = [];
        const rawFormats = screen.specs?.format || '';
        const allowedFormats = rawFormats ? rawFormats.split(' / ').map(f => f.trim().toUpperCase()) : [];
        const ext = file.name.split('.').pop().toUpperCase();
        const normalizedExt = ext === 'JPEG' ? 'JPG' : ext;
        if (allowedFormats.length > 0 && !allowedFormats.includes(normalizedExt) && !allowedFormats.includes(ext)) {
            errors.push(`Format not allowed: .${ext.toLowerCase()}. Accepted: ${allowedFormats.join(', ')}`);
        }
        const maxMb = parseFloat(screen.specs?.maxSize) || 50;
        if (file.size / (1024 * 1024) > maxMb) {
            errors.push(`File is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max allowed is ${maxMb} MB`);
        }
        if (errors.length > 0) return { errors, audioWarning: false };

        const meta = await getMediaMeta(file);
        const maxDuration = screen.rules?.adDuration;
        if (meta.duration && maxDuration && meta.duration > maxDuration + 0.5) {
            errors.push(`Video is ${meta.duration.toFixed(1)}s — max allowed is ${maxDuration}s`);
        }
        if (meta.width && meta.height) {
            const screenRes = screen.specs?.resolution || '';
            if (screenRes && screenRes !== '—') {
                const [reqW, reqH] = screenRes.split('x').map(Number);
                if (reqW && reqH && (meta.width !== reqW || meta.height !== reqH)) {
                    errors.push(`Resolution mismatch: file is ${meta.width}×${meta.height}, screen requires ${reqW}×${reqH}`);
                }
            }
            const reqOrientation = screen.specs?.orientation || '';
            if (reqOrientation) {
                const isFileLandscape = meta.width >= meta.height;
                if (isFileLandscape !== (reqOrientation.toLowerCase() === 'landscape')) {
                    errors.push(`File is ${isFileLandscape ? 'Landscape' : 'Portrait'} but screen requires ${reqOrientation}`);
                }
            }
        }
        const audioWarning = file.type.startsWith('video/') && screen.specs?.audioRule === 'Not Allowed';
        return { errors, audioWarning };
    };

    // Upload a file for a single slot (reusable)
    const uploadFileForSlot = async (file, screen, slotId) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_name', file.name);
        formData.append('file_size', file.size);
        formData.append('file_type', file.type);
        formData.append('slot_number', slotId);
        formData.append('screen_id', screen.id);
        const res = await axios.post(`/api/console/campaign/${campaignId}/assets/`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        const assetData = res.data?.data || res.data;
        return assetData;
    };

    // Delete an asset from the database — uses screen_id + slot_number query params
    const deleteAssetFromDB = async (assetId, screenId, slotNumber) => {
        if (!screenId || !slotNumber) return;
        try {
            await axios.delete(`/api/console/campaign/${campaignId}/assets/`, {
                params: { screen_id: screenId, slot_number: slotNumber }
            });
            console.log(`[Asset Delete] ✅ Deleted screen=${screenId} slot=${slotNumber}`);
        } catch (err) {
            console.warn('[Asset Delete] API failed:', err.response?.data || err.message);
        }
    };

    // Bulk upload — same file to all selected slots for a screen
    const handleBulkUpload = async (screenId, screen, slots, event) => {
        const file = event.target.files[0];
        if (!file) return;

        const selectedSlots = slots.filter(s => bulkSlotSelections[screenId]?.[s.slotId]);
        if (selectedSlots.length === 0) {
            setAlert({ show: true, title: 'No Slots Selected', message: 'Please select at least one slot to upload to.', type: 'error' });
            event.target.value = '';
            return;
        }

        setBulkUploading(screenId);
        const { errors, audioWarning } = await validateFile(file, screen);

        if (errors.length > 0) {
            setBulkUploading(null);
            setAlert({ show: true, title: 'Upload Rejected', message: errors.join('\n'), type: 'error' });
            event.target.value = '';
            return;
        }
        if (audioWarning) {
            setAlert({ show: true, title: 'Audio Not Supported', message: `Note: "${screen.name}" does not support audio. Video audio will be muted.`, type: 'warning' });
        }

        let successCount = 0;
        let failedSlots = [];
        for (const slot of selectedSlots) {
            const uniqueId = `${screen.id}-${slot.slotId}`;
            try {
                const assetData = await uploadFileForSlot(file, screen, slot.slotId);
                setUploadedFiles(prev => ({
                    ...prev,
                    [uniqueId]: { name: file.name, id: assetData.id, url: assetData.file?.url || assetData.file_url || '' }
                }));
                setAssetStatuses(prev => ({
                    ...prev,
                    [uniqueId]: {
                        id: assetData.id,
                        status: assetData.status || 'uploaded',
                        validation_status: assetData.validation_status || 'pending',
                        validation_errors: assetData.validation_errors || null,
                        file_url: assetData.file?.url || assetData.file_url || ''
                    }
                }));
                successCount++;
            } catch (error) {
                failedSlots.push(slot.slotId);
            }
        }

        setBulkUploading(null);
        event.target.value = '';
        if (failedSlots.length > 0) {
            setAlert({ show: true, title: 'Partial Upload', message: `Uploaded to ${successCount} slots. Failed for slot(s): ${failedSlots.join(', ')}`, type: 'warning' });
        }
    };

    const toggleBulkSlot = (screenId, slotId) => {
        setBulkSlotSelections(prev => {
            const current = prev[screenId] || {};
            const isCurrentlyActive = !!current[slotId];
            // Count how many are currently selected
            const selectedCount = Object.values(current).filter(Boolean).length;
            // Don't deselect if it's the only one selected
            if (isCurrentlyActive && selectedCount === 1) return prev;
            return {
                ...prev,
                [screenId]: {
                    ...current,
                    [slotId]: !isCurrentlyActive
                }
            };
        });
    };

    const toggleAllSlots = (screenId, slots) => {
        const sel = {};
        slots.forEach(s => { sel[s.slotId] = true; });
        setBulkSlotSelections(prev => ({
            ...prev,
            [screenId]: sel
        }));
    };

    // Build a flat list of all slot items with expected filename + current status
    const allSlotItems = allMappedSlots.map(item => {
        const key = `${item.screen.id}-${item.slotId}`
        const uploaded = uploadedFiles[key]
        const st = assetStatuses[key]
        const vs = st?.validation_status
        let status = 'needed'
        if (uploaded) {
            if (vs === 'approved' || vs === 'passed') status = 'approved'
            else if (vs === 'failed' || vs === 'rejected') status = 'rejected'
            else status = 'pending'
        }
        return { ...item, key, uploaded, st, status }
    })

    // Global file input handler — matches uploaded file to slots by filename
    const globalFileInputRef = React.useRef(null)
    const [globalUploading, setGlobalUploading] = React.useState(false)
    const [uploadQueue, setUploadQueue] = React.useState([]) // { file, status:'uploading'|'done'|'error', error, progress }
    const [isDragOver, setIsDragOver] = React.useState(false)

    const processFiles = async (files) => {
        if (!files || files.length === 0) return
        const fileArr = Array.from(files)

        // Add files to queue immediately as 'queued'
        const newEntries = fileArr.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: 'queued', error: null, progress: 0 }))
        setUploadQueue(prev => [...prev, ...newEntries])

        setGlobalUploading(true)
        for (const entry of newEntries) {
            const { file, id } = entry
            // Find all slot items whose expected filename matches this file's name
            const matchingSlots = allSlotItems.filter(item => item.fileName.toLowerCase() === file.name.toLowerCase())

            if (matchingSlots.length === 0) {
                setUploadQueue(prev => prev.map(e => e.id === id
                    ? { ...e, status: 'error', error: `No slot expects file "${file.name}". Check the filenames in your Creative Brief.` }
                    : e))
                continue
            }

            setUploadQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'uploading', progress: 10 } : e))

            // Validate against EACH matching screen's specs individually
            let allErrors = []
            let anyAudioWarning = false
            for (const item of matchingSlots) {
                const { errors, audioWarning } = await validateFile(file, item.screen)
                if (errors.length > 0) {
                    allErrors.push(...errors.map(e => `${item.screen.name}: ${e}`))
                }
                if (audioWarning) anyAudioWarning = true
            }
            if (allErrors.length > 0) {
                setUploadQueue(prev => prev.map(e => e.id === id
                    ? { ...e, status: 'error', error: allErrors.join(' | ') }
                    : e))
                continue
            }
            if (anyAudioWarning) {
                setAlert({ show: true, title: 'Audio Not Supported', message: `Some screens do not support audio — video audio will be muted during playback.`, type: 'warning' })
            }

            // Upload to all matching slots
            let failed = false
            for (let i = 0; i < matchingSlots.length; i++) {
                const item = matchingSlots[i]
                const uniqueId = item.key
                try {
                    const assetData = await uploadFileForSlot(file, item.screen, item.slotId)
                    setUploadedFiles(prev => ({ ...prev, [uniqueId]: { name: file.name, size: file.size, id: assetData.id, url: assetData.file?.url || assetData.file_url || '' } }))
                    setAssetStatuses(prev => ({ ...prev, [uniqueId]: { id: assetData.id, status: assetData.status || 'uploaded', validation_status: assetData.validation_status || 'pending', validation_errors: assetData.validation_errors || null, file_url: assetData.file?.url || '' } }))
                    setUploadQueue(prev => prev.map(e => e.id === id ? { ...e, progress: Math.round(((i + 1) / matchingSlots.length) * 90) + 10 } : e))
                } catch (err) {
                    failed = true
                    setUploadQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'error', error: `Upload failed for ${item.screen.name} slot ${item.slotId}: ${err.response?.data?.error || err.message}` } : e))
                    break
                }
            }
            if (!failed) {
                setUploadQueue(prev => prev.map(e => e.id === id ? { ...e, status: 'done', progress: 100 } : e))
            }
        }
        setGlobalUploading(false)
        if (globalFileInputRef.current) globalFileInputRef.current.value = ''
    }

    const totalSlotCount = allSlotItems.length
    const uploadedCount = allSlotItems.filter(i => i.status !== 'needed').length
    const approvedSlots = allSlotItems.filter(i => i.status === 'approved').length

    return (
        <div className="au-page">
            {/* Page header */}
            <div className="au-header">
                <div className="au-header-title">Asset Upload</div>
                <div className="au-header-sub">Upload creative files and attach them to the mapped screens and slot groups.</div>
            </div>

            {/* Two-column body */}
            <div className="au-body">
                {/* ── Left: Global Drop Zone + Upload List ── */}
                <div className="au-left">
                    <input
                        type="file"
                        multiple
                        accept="video/mp4,video/quicktime,video/avi,image/jpeg,image/png,image/gif"
                        ref={globalFileInputRef}
                        style={{ display: 'none' }}
                        onChange={e => processFiles(e.target.files)}
                    />

                    {/* Drop zone */}
                    <div
                        className={`au-dropzone ${isDragOver ? 'drag-over' : ''}`}
                        onClick={() => globalFileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={e => { e.preventDefault(); setIsDragOver(false); processFiles(e.dataTransfer.files) }}
                    >
                        <div className="au-dz-icon">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" />
                                <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                        </div>
                        <div className="au-dz-text">Drop Your File Or</div>
                        <div className="au-dz-browse">Browse files</div>
                    </div>

                    {/* Upload queue list */}
                    {uploadQueue.length > 0 && (
                        <div className="au-upload-list">
                            {uploadQueue.map(entry => (
                                <div key={entry.id} className={`au-upload-item ${entry.status}`}>
                                    <div className="au-upload-thumb">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                            <rect x="2" y="2" width="20" height="20" rx="4" />
                                            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none" />
                                        </svg>
                                    </div>
                                    <div className="au-upload-info">
                                        <div className="au-upload-name">{entry.file.name}</div>
                                        <div className="au-upload-size">{(entry.file.size / (1024 * 1024)).toFixed(0)} MB</div>
                                        {entry.status === 'uploading' && (
                                            <div className="au-progress-bar">
                                                <div className="au-progress-fill" style={{ width: `${entry.progress}%` }} />
                                            </div>
                                        )}
                                        {entry.status === 'error' && (
                                            <div className="au-upload-error">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="#dc2626"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" stroke="white" strokeWidth="2" /><line x1="12" y1="16" x2="12.01" y2="16" stroke="white" strokeWidth="2" /></svg>
                                                {entry.error}
                                            </div>
                                        )}
                                    </div>
                                    <div className="au-upload-status-badge">
                                        {entry.status === 'done' && <span className="au-badge success">Uploaded</span>}
                                        {entry.status === 'error' && <span className="au-badge error">Error</span>}
                                        {entry.status === 'uploading' && <span className="au-badge uploading">{entry.progress}%</span>}
                                        {entry.status === 'queued' && <span className="au-badge queued">Queued</span>}
                                    </div>
                                    {(entry.status === 'done' || entry.status === 'error') && (
                                        <button className="au-upload-remove" onClick={async () => {
                                            // Find all slots that were uploaded with this file
                                            const matchingKeys = allSlotItems
                                                .filter(item => item.fileName.toLowerCase() === entry.file.name.toLowerCase())
                                                .map(item => item.key)
                                            // Delete from backend + clear local state
                                            for (const k of matchingKeys) {
                                                const st = assetStatuses[k]
                                                const lastDash = k.lastIndexOf('-')
                                                const screenId = k.substring(0, lastDash)
                                                const slotNum = k.substring(lastDash + 1)
                                                await deleteAssetFromDB(st?.id, screenId, slotNum)
                                            }
                                            setUploadedFiles(prev => {
                                                const n = { ...prev }
                                                matchingKeys.forEach(k => delete n[k])
                                                return n
                                            })
                                            setAssetStatuses(prev => {
                                                const n = { ...prev }
                                                matchingKeys.forEach(k => delete n[k])
                                                return n
                                            })
                                            // Remove from queue
                                            setUploadQueue(prev => prev.filter(e => e.id !== entry.id))
                                        }}>×</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Right: Screen Cards ── */}
                <div className="au-right">
                    {Object.entries(slotsByScreen).map(([screenId, { screen, slots }]) => {
                        const adDuration = screen.rules?.adDuration
                        const resolution = screen.specs?.resolution || '—'
                        return (
                            <div key={screenId} className="au-screen-card">
                                {/* Card header */}
                                <div className="au-card-header">
                                    <div>
                                        <div className="au-screen-name">{screen.name}</div>
                                        <div className="au-screen-loc">{screen.location}</div>
                                    </div>
                                    <div className="au-constraints">
                                        <span className="au-constraints-label">Creative Constraints</span>
                                        <div className="au-constraint-pills">
                                            {adDuration && <span className="au-pill dur">{adDuration}s</span>}
                                            {resolution && resolution !== '—' && <span className="au-pill res">{resolution}</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Slot file rows */}
                                <div className="au-slot-list">
                                    {slots.map(item => {
                                        const key = item.key || `${screenId}-${item.slotId}`
                                        const uploaded = uploadedFiles[key]
                                        const st = assetStatuses[key]
                                        const vs = st?.validation_status
                                        let rowStatus = 'needed'
                                        if (uploaded) {
                                            if (vs === 'failed' || vs === 'rejected') rowStatus = 'rejected'
                                            else rowStatus = 'uploaded'
                                        }
                                        const fileSizeMb = uploaded?.size ? `${(uploaded.size / (1024 * 1024)).toFixed(0)} MB` : '—'
                                        return (
                                            <div key={key} className="au-slot-row">
                                                <div className="au-slot-thumb" />
                                                <div className="au-slot-info">
                                                    <div className="au-slot-filename">{item.fileName}</div>
                                                    <div className="au-slot-meta">
                                                        {uploaded && uploaded.size ? `${(uploaded.size / (1024 * 1024)).toFixed(0)} MB · ` : ''}
                                                        <span className="au-slot-tag">Slot {item.slotId}</span>
                                                    </div>
                                                    {rowStatus === 'rejected' && st?.validation_errors && (
                                                        <div className="au-slot-error">
                                                            {Array.isArray(st.validation_errors)
                                                                ? st.validation_errors.join(' • ')
                                                                : typeof st.validation_errors === 'object'
                                                                    ? [st.validation_errors.note, ...(Array.isArray(st.validation_errors.policy_failures) ? st.validation_errors.policy_failures : [])].filter(Boolean).join(' • ')
                                                                    : st.validation_errors}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`au-slot-status ${rowStatus}`}>
                                                    {rowStatus === 'needed' && 'File Needed'}
                                                    {rowStatus === 'uploaded' && 'Uploaded'}
                                                    {rowStatus === 'rejected' && 'Rejected'}
                                                </div>
                                                {rowStatus !== 'needed' && (
                                                    <button className="au-slot-remove" title="Remove this upload" onClick={async () => {
                                                        const lastDash = key.lastIndexOf('-')
                                                        const sId = key.substring(0, lastDash)
                                                        const slotNum = key.substring(lastDash + 1)
                                                        await deleteAssetFromDB(st?.id, sId, slotNum)
                                                        setUploadedFiles(prev => { const n = { ...prev }; delete n[key]; return n })
                                                        setAssetStatuses(prev => { const n = { ...prev }; delete n[key]; return n })
                                                        // Also remove from upload queue if present
                                                        setUploadQueue(prev => prev.filter(e => e.file?.name?.toLowerCase() !== item.fileName.toLowerCase()))
                                                    }}>×</button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="au-footer">
                <button className="au-btn-back" onClick={() => navigate(-1)}>Back to Screen Spec Review</button>
                <button
                    className="au-btn-save"
                    onClick={() => navigate('/active-dashboard-demo')}
                    disabled={uploadedCount === 0}
                >
                    Go to Dashboard
                </button>
            </div>

            <AlertModal
                isOpen={alert.show}
                onClose={() => setAlert({ ...alert, show: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />
        </div>
    );
};

function CreativeManifestBuilder() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const [searchParams] = useSearchParams();

    // campaignId from URL query param (survives refresh), fallback to Router state
    const campaignId = searchParams.get('campaignId') || state?.campaignId || '';

    const [view, setView] = useState('upload');
    const [screens, setScreens] = useState(state?.selectedScreens || []);
    const [mappings, setMappings] = useState({});
    const [loading, setLoading] = useState(true);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error' });
    const [initialUploadedFiles, setInitialUploadedFiles] = useState({});
    const [initialAssetStatuses, setInitialAssetStatuses] = useState({});
    const { setPageContext } = useXiaContext();

    // Publish live page data for XIA — include full screen specs + mappings
    useEffect(() => {
        const mappedCount = Object.values(mappings).reduce((sum, m) => sum + Object.keys(m).length, 0);
        const totalSlots = screens.reduce((sum, s) => sum + (s.slot_count || 1), 0);
        setPageContext({
            page: 'creative_builder',
            page_label: 'Creative Manifest Builder',
            summary: `Building creative manifest for campaign ${campaignId}. ${screens.length} screens, ${totalSlots} total slots. ${mappedCount}/${totalSlots} mapped. View: ${view}.`,
            data: {
                campaign_id: campaignId,
                screens_count: screens.length,
                current_view: view,
                total_slots: totalSlots,
                mapped_count: mappedCount,
                screens: screens.map(s => ({
                    name: s.name,
                    location: s.location,
                    slot_count: s.slot_count || 1,
                    resolution: s.specs?.resolution,
                    format: s.specs?.format,
                    orientation: s.specs?.orientation,
                    max_file_size: s.specs?.maxSize,
                    ad_duration_sec: s.rules?.adDuration,
                    audio_rule: s.specs?.audioRule,
                })),
            }
        })
        return () => setPageContext(null)
    }, [screens, view, campaignId, mappings])

    // Build auto-generated mappings: screen_id -> { slotId -> filename }
    // Uses XIA-derived fileGroups (stored on bundles) when available for accurate filenames.
    // Falls back to screen specs when fileGroups aren't available.
    const buildAutoMappings = (screenList, bundleList) => {
        const auto = {};

        // First: try to build from bundle fileGroups (XIA source of truth)
        // fileGroups = [{ filename, resolution, durationSec, format, screens: [{ name, slots }] }]
        if (bundleList?.length > 0) {
            const fgMappings = {}; // screenName -> { slotId -> filename }
            bundleList.forEach(bundle => {
                if (!bundle.fileGroups) return;
                bundle.fileGroups.forEach(fg => {
                    fg.screens.forEach(s => {
                        if (!fgMappings[s.name]) fgMappings[s.name] = {};
                        (s.slots || []).forEach(slotId => {
                            fgMappings[s.name][slotId] = fg.filename;
                        });
                    });
                });
            });

            // Map by screen name -> screen id
            if (Object.keys(fgMappings).length > 0) {
                screenList.forEach(screen => {
                    const count = screen.slot_count || 1;
                    auto[screen.id] = {};
                    const nameMatch = fgMappings[screen.name];
                    if (nameMatch) {
                        for (let i = 1; i <= count; i++) {
                            auto[screen.id][i] = nameMatch[i] || nameMatch[Object.keys(nameMatch)[0]] || `file_slot${i}.mp4`;
                        }
                    } else {
                        // Fallback for this screen
                        const bundle = bundleList.find(b => b.screens?.some(s => s.screenId === screen.id));
                        const bundleName = bundle?.name?.replace(/\s+/g, '_') || 'bundle';
                        const duration = screen.rules?.adDuration ? `${screen.rules.adDuration}sec` : '15sec';
                        const resolution = screen.specs?.resolution ? `(${screen.specs.resolution})` : '(1920x1080)';
                        const ext = (screen.specs?.format || 'MOV').split(' / ')[0] || 'MOV';
                        for (let i = 1; i <= count; i++) {
                            auto[screen.id][i] = `${bundleName}_${duration}_${resolution}.${ext}`;
                        }
                    }
                });
                return auto;
            }
        }

        // Fallback: generate from screen specs (no XIA data)
        screenList.forEach(screen => {
            const count = screen.slot_count || 1;
            auto[screen.id] = {};
            const bundle = bundleList?.find(b => b.screens?.some(s => s.screenId === screen.id));
            const bundleName = bundle?.name?.replace(/\s+/g, '_') || 'bundle';
            const duration = screen.rules?.adDuration ? `${screen.rules.adDuration}sec` : '15sec';
            const resolution = screen.specs?.resolution ? `(${screen.specs.resolution})` : '(1920x1080)';
            const ext = (screen.specs?.format || 'MOV').split(' / ')[0] || 'MOV';
            for (let i = 1; i <= count; i++) {
                auto[screen.id][i] = `${bundleName}_${duration}_${resolution}.${ext}`;
            }
        });
        return auto;
    };

    useEffect(() => {
        const fetchManifestAndAssets = async () => {
            // ── Fast-path when coming from ScreenBundlePage ──
            // We already have enriched screens with specs via state; no need to hit Console API
            if (state?.fromBundle && state?.selectedScreens?.length > 0) {
                const passedScreens = state.selectedScreens;
                setScreens(passedScreens);
                setMappings(buildAutoMappings(passedScreens, state.bundles || []));

                // Still fetch assets to restore upload state from previous uploads
                try {
                    const assetsRes = await axios.get(`/api/console/campaign/${campaignId}/assets/`);
                    const assetRows = assetsRes.data?.assets || assetsRes.data?.data || [];
                    const files = {};
                    const statuses = {};
                    assetRows.forEach(row => {
                        const key = `${row.screen_id}-${row.slot_number}`;
                        if (row.file || row.original_filename || row.status === 'uploaded' || row.status === 'validated' || row.status === 'approved') {
                            files[key] = { name: row.original_filename || 'Uploaded file', id: row.id, size: row.file_size_bytes || 0, url: row.file || '' };
                        }
                        statuses[key] = { id: row.id, status: row.status, validation_status: row.validation_status || 'pending', validation_errors: row.validation_errors || null, file_url: row.file || '' };
                    });
                    if (Object.keys(files).length > 0) setInitialUploadedFiles(files);
                    if (Object.keys(statuses).length > 0) setInitialAssetStatuses(statuses);
                    console.log('[Fast-path] Restored', Object.keys(files).length, 'uploaded files');
                } catch (e) { console.warn('[Fast-path] Assets fetch optional fail:', e.message); }

                setLoading(false);
                return;
            }

            if (!campaignId) {
                setMappings(buildAutoMappings(screens, []));
                setLoading(false);
                return;
            }
            try {
                // 1. Fetch manifest (screen structure + slot definitions)
                const manifestRes = await axios.get(`/api/console/campaign/${campaignId}/manifest/`);
                const manifestRows = manifestRes.data?.assets || manifestRes.data?.data || [];
                console.log('[Manifest] Raw response rows:', manifestRows.length, manifestRows.length > 0 ? Object.keys(manifestRows[0]) : 'empty');

                // Also fetch bundles for correct filename generation
                let bundlesData = [];
                try {
                    const bundlesRes = await axios.get(`/api/studio/campaign/${campaignId}/bundles/`);
                    bundlesData = (bundlesRes.data?.data || bundlesRes.data || []).map(b => ({
                        id: String(b.id), name: b.name, status: b.status,
                        creative_suggestion_url: b.creative_suggestion_url,
                        screens: (b.screens || []).map(s => ({ screenId: s.screen_id || s.screenId, slots: s.slots || [] }))
                    }));
                } catch (e) { console.warn('[Reload] Bundles fetch failed:', e.message); }

                if (Array.isArray(manifestRows) && manifestRows.length > 0) {
                    // Reconstruct screens from manifest if not passed via Router state
                    if (!state?.selectedScreens?.length) {
                        const screenMap = {};
                        manifestRows.forEach(row => {
                            if (!screenMap[row.screen_id]) {
                                screenMap[row.screen_id] = {
                                    id: row.screen_id,
                                    name: row.screen_name || `Screen ${row.screen_id}`,
                                    location: row.screen_location || '',
                                    slot_count: 0,
                                    specs: {
                                        resolution: row.req_resolution_width && row.req_resolution_height
                                            ? `${row.req_resolution_width}x${row.req_resolution_height}` : '—',
                                        orientation: row.req_orientation || '',
                                        maxSize: row.req_max_file_size_mb || '—',
                                        format: Array.isArray(row.req_supported_formats)
                                            ? row.req_supported_formats.join(' / ') : '',
                                        audioRule: row.req_audio_supported ? 'Allowed' : 'Not Allowed'
                                    },
                                    rules: {
                                        adDuration: row.req_max_duration_sec || null
                                    }
                                };
                            }
                            screenMap[row.screen_id].slot_count++;
                        });
                        const reconstructedScreens = Object.values(screenMap);
                        setScreens(reconstructedScreens);
                        setMappings(buildAutoMappings(reconstructedScreens, bundlesData));
                    } else {
                        setMappings(buildAutoMappings(screens, bundlesData));
                    }

                    // 2. Fetch latest asset statuses from the assets API
                    try {
                        const assetsRes = await axios.get(`/api/console/campaign/${campaignId}/assets/`);
                        const assetRows = assetsRes.data?.assets || assetsRes.data?.data || [];
                        console.log('[Assets] Raw response rows:', assetRows.length);

                        const files = {};
                        const statuses = {};

                        if (Array.isArray(assetRows) && assetRows.length > 0) {
                            assetRows.forEach(row => {
                                const key = `${row.screen_id}-${row.slot_number}`;
                                // Populate uploaded file info
                                if (row.file || row.original_filename || row.status === 'uploaded' || row.status === 'validated' || row.status === 'approved') {
                                    files[key] = {
                                        name: row.original_filename || 'Uploaded file',
                                        id: row.id,
                                        size: row.file_size_bytes || 0,
                                        url: row.file || ''
                                    };
                                }
                                // Always populate status for badges
                                statuses[key] = {
                                    id: row.id,
                                    status: row.status,
                                    validation_status: row.validation_status || 'pending',
                                    validation_errors: row.validation_errors || null,
                                    file_url: row.file || ''
                                };
                            });
                        }

                        console.log('[Assets] Restored files:', Object.keys(files).length);
                        console.log('[Assets] Restored statuses:', Object.keys(statuses).length);

                        if (Object.keys(files).length > 0) {
                            setInitialUploadedFiles(files);
                        }
                        setInitialAssetStatuses(statuses);

                    } catch (assetErr) {
                        console.warn('[Assets] Fetch error (falling back to manifest data):', assetErr.message);
                        // Fallback: extract from manifest rows if assets API fails
                        const files = {};
                        const statuses = {};
                        manifestRows.forEach(row => {
                            const key = `${row.screen_id}-${row.slot_number}`;
                            if (row.file || row.original_filename || row.status === 'uploaded' || row.status === 'validated' || row.status === 'approved') {
                                files[key] = {
                                    name: row.original_filename || 'Uploaded file',
                                    id: row.id,
                                    size: row.file_size_bytes || 0,
                                    url: row.file || ''
                                };
                            }
                            statuses[key] = {
                                id: row.id,
                                status: row.status,
                                validation_status: row.validation_status || 'pending',
                                validation_errors: row.validation_errors || null,
                                file_url: row.file || ''
                            };
                        });
                        if (Object.keys(files).length > 0) {
                            setInitialUploadedFiles(files);
                        }
                        setInitialAssetStatuses(statuses);
                    }

                } else {
                    setMappings(buildAutoMappings(screens, []));
                }
            } catch (err) {
                console.warn('Manifest fetch error:', err.message);
                setMappings(buildAutoMappings(screens, []));
            } finally {
                setLoading(false);
            }
        };
        fetchManifestAndAssets();
    }, [campaignId]);

    const handleSaveManifest = async () => {
        if (!campaignId) {
            setAlert({
                show: true,
                title: 'Error',
                message: "Campaign ID missing. Please try navigating back and proceeding again.",
                type: 'error'
            });
            return;
        }
        try {
            // Create manifest rows on Console Backend (auto-creates CampaignAsset rows from SlotBookings)
            await axios.post(`/api/console/campaign/${campaignId}/manifest/`, {});
            setView('upload');
        } catch (err) {
            console.error("Manifest save error:", err.response?.data || err.message);
            setAlert({
                show: true,
                title: 'Error',
                message: `Error creating manifest: ${err.response?.data?.error || err.message}`,
                type: 'error'
            });
        }
    };

    const handleSlotChange = (screenId, slotId, fileName) => {
        setMappings(prev => ({
            ...prev,
            [screenId]: {
                ...prev[screenId],
                [slotId]: fileName
            }
        }));
    };

    const allMappedSlots = useMemo(() => {
        const slots = [];
        screens.forEach(screen => {
            const screenMappings = mappings[screen.id] || {};
            Object.entries(screenMappings).forEach(([slotId, fileName]) => {
                if (fileName && fileName.trim() !== '') {
                    slots.push({ screen, slotId, fileName });
                }
            });
        });
        return slots;
    }, [screens, mappings]);

    // Metrics Calculation
    const totalSlots = screens.reduce((acc, s) => acc + (s.slot_count || 1), 0);
    const mappedCount = Object.values(mappings).reduce((acc, map) => {
        return acc + Object.values(map).filter(val => val && val.trim() !== '').length;
    }, 0);
    const pendingCount = totalSlots - mappedCount;
    const readiness = totalSlots > 0 ? Math.round((mappedCount / totalSlots) * 100) : 0;

    if (loading) return <div className="loading-container">Loading Manifest...</div>;

    return (
        <div className="manifest-builder-page">
            <Header />

            <div style={{ display: 'flex', marginRight: '10px', flexDirection: 'row', padding: '12px 24px 12px' }}>
                <div className="me-3 justify-content-center align-items-center">    <button
                    onClick={() => navigate(-1)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'none',
                        border: '1px solid #ddd',
                        color: '#4f46e5',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        padding: '3px 4px',
                        marginTop: "10px"
                    }}
                >
                    ←
                </button></div>

                <div className="builder-header">
                    <div className="builder-header-inner flex-header">
                        <div className="header-text">
                            <h1 className="builder-title">
                                Creative Preparation
                            </h1>
                            <p className="builder-subtitle">
                                Prepare, upload, and validate creatives before scheduling.
                            </p>
                        </div>
                    </div>
                </div>

            </div>

            <div className="manifest-builder-layout">

                {/* Main Section */}
                <div className="builder-main">
                    <div className="builder-content-area">
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '80px 0', color: '#64748B' }}>
                                <i className="bi bi-arrow-repeat" style={{ fontSize: '24px', animation: 'spin 1s linear infinite', marginRight: '12px' }}></i>
                                Loading campaign data...
                            </div>
                        ) : view === 'mapping' ? (
                            <>
                                <h2 className="mapping-section-title">Slot Mapping Grid</h2>

                                {screens.map((screen) => (
                                    <ScreenMappingGroup
                                        key={screen.id}
                                        screen={screen}
                                        mappings={mappings}
                                    />
                                ))}

                                {/* Summary Section */}
                                <div className="integrity-container">
                                    <h3 className="integrity-title">Manifest Integrity Summary</h3>
                                    <p className="integrity-desc">{totalSlots} slot assignments required before validation agent can start.</p>

                                    <div className="metrics-summary-grid">
                                        <div className="summary-card">
                                            <div className="summary-label">Total Slots</div>
                                            <div className="summary-value">{totalSlots}</div>
                                        </div>
                                        <div className="summary-card">
                                            <div className="summary-label">Mapped</div>
                                            <div className="summary-value">{mappedCount}</div>
                                        </div>
                                        <div className="summary-card">
                                            <div className="summary-label">Pending</div>
                                            <div className="summary-value">{pendingCount}</div>
                                        </div>
                                        <div className="summary-card">
                                            <div className="summary-label">Readiness</div>
                                            <div className="summary-value">{readiness}%</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="builder-bottom-bar">
                                    <div className="bottom-hint">
                                        <i className="bi bi-info-circle"></i>
                                        Complete all required slot mappings to continue.
                                    </div>
                                    <button
                                        className={`upload-assets-btn ${mappedCount < totalSlots ? 'disabled' : ''}`}
                                        disabled={mappedCount < totalSlots}
                                        onClick={handleSaveManifest}
                                    >
                                        Upload Assets
                                    </button>
                                </div>
                            </>
                        ) : (
                            <AssetUploadView
                                screens={screens}
                                mappings={mappings}
                                campaignId={campaignId}
                                initialUploadedFiles={initialUploadedFiles}
                                initialAssetStatuses={initialAssetStatuses}
                            />
                        )}
                    </div>
                </div>
            </div>
            <AlertModal
                isOpen={alert.show}
                onClose={() => setAlert({ ...alert, show: false })}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />
        </div>
    );
}

export default CreativeManifestBuilder;
