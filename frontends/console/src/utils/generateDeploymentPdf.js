import html2pdf from 'html2pdf.js';

/**
 * Generate and download a PDF Ad Deployment Sheet for a specific asset/slot.
 *
 * @param {Object} params
 * @param {Object} params.campaign - Campaign data from dashboard API
 * @param {Object} params.screen   - Screen spec data from screen-specs API
 * @param {Object} params.asset    - CampaignAsset data
 */
export function generateDeploymentPdf({ campaign, screen, asset }) {
    const now = new Date();
    const generatedDate = now.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'long', year: 'numeric'
    }) + ' · ' + now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true
    });

    // Format campaign dates
    const fmtDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Format file size
    const fmtSize = (bytes) => {
        if (!bytes) return '—';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1024).toFixed(0) + ' KB';
    };

    // Supported formats
    const formats = (asset.req_supported_formats || screen.supported_formats_json || []).join(' · ');
    const maxSize = asset.req_max_file_size_mb || screen.max_file_size_mb || '—';
    const maxDuration = asset.req_max_duration_sec || screen.standard_ad_duration_sec || '—';
    const resW = asset.req_resolution_width || screen.resolution_width || '—';
    const resH = asset.req_resolution_height || screen.resolution_height || '—';
    const orientation = asset.req_orientation || screen.orientation || '—';

    // Count passed checks
    const checks = [asset.is_file_format, asset.is_file_size, asset.is_video_duration, asset.is_resolution, asset.is_orientation];
    const passed = checks.filter(Boolean).length;
    const total = checks.length;
    const allPassed = passed === total;
    const summaryText = allPassed
        ? `${passed} / ${total} Checks Passed — All Clear`
        : `${passed} / ${total} Checks Passed — ${total - passed} Issue${total - passed > 1 ? 's' : ''} Found`;

    // File extension & type
    const ext = (asset.file_extension || '').toUpperCase() || 'FILE';

    // Advertiser info
    const advName = campaign.user_info?.name || '—';
    const advCompany = campaign.user_info?.company || '';
    const advertiser = advCompany ? `${advName} · ${advCompany}` : advName;

    // Screen info
    const screenName = screen.screen_name || '—';
    const screenId = screen.id || '—';
    const fullAddress = screen.full_address || screen.city || '—';
    const environment = (screen.environment || '—').toUpperCase();
    const role = (screen.role || '—').toUpperCase();
    const cmsType = screen.cms_type || '—';
    const slotNumber = asset.slot_number || '—';
    const audioSupported = screen.audio_supported;

    // File download URL
    const BACKEND_ORIGIN = 'http://localhost:8000';
    const rawFileUrl = asset.file || '';
    const fileUrl = rawFileUrl.startsWith('http') ? rawFileUrl : `${BACKEND_ORIGIN}${rawFileUrl}`;

    // Pass/fail icons
    const passIcon = '✓';
    const failIcon = '✗';
    const checkRow = (label, value, isPassed) => `
        <tr>
            <td style="padding:10px 16px;font-size:11px;color:#475569;font-weight:500;border-bottom:1px solid #f1f5f9;width:180px;">${label}</td>
            <td style="padding:10px 16px;font-size:11px;color:#0f172a;font-weight:700;font-family:'Courier New',Consolas,monospace;border-bottom:1px solid #f1f5f9;">${value}</td>
            <td style="padding:10px 16px;font-size:15px;font-weight:900;text-align:center;border-bottom:1px solid #f1f5f9;width:70px;color:${isPassed ? '#16a34a' : '#dc2626'};background:${isPassed ? '#f0fdf4' : '#fef2f2'};">${isPassed ? passIcon : failIcon}</td>
        </tr>`;

    // Badge helper
    const badge = (text, bg, color, border) =>
        `<span style="display:inline-block;padding:4px 14px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;background:${bg};color:${color};border:1px solid ${border};">${text}</span>`;

    // Section title helper — simple inline style, no table box
    const sectionTitle = (num, title) => `
        <div style="margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #ede9fe;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:#7c3aed;">
            <span style="color:#7c3aed;font-weight:900;margin-right:6px;">${num}.</span>${title}
        </div>`;

    // Info row helper — each row is a single labeled field spanning full width or sharing with another field
    const infoRow1 = (label, value, isMono = false) => `
        <tr>
            <td colspan="4" style="padding:6px 16px 2px 16px;">
                <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700;">${label}</div>
            </td>
        </tr>
        <tr>
            <td colspan="4" style="padding:0 16px 10px 16px;border-bottom:1px solid #f1f5f9;">
                <div style="font-size:13px;color:#0f172a;font-weight:600;${isMono ? "font-family:'Courier New',Consolas,monospace;" : ''}word-wrap:break-word;overflow-wrap:break-word;">${value}</div>
            </td>
        </tr>`;

    const infoRow2 = (label1, value1, label2, value2, isMono1 = false, isMono2 = false) => `
        <tr>
            <td style="padding:6px 16px 2px 16px;width:50%;">
                <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700;">${label1}</div>
            </td>
            <td style="padding:6px 16px 2px 16px;width:50%;">
                <div style="font-size:8px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700;">${label2}</div>
            </td>
        </tr>
        <tr>
            <td style="padding:0 16px 10px 16px;border-bottom:1px solid #f1f5f9;">
                <div style="font-size:13px;color:#0f172a;font-weight:600;${isMono1 ? "font-family:'Courier New',Consolas,monospace;" : ''}">${value1}</div>
            </td>
            <td style="padding:0 16px 10px 16px;border-bottom:1px solid #f1f5f9;">
                <div style="font-size:13px;color:#0f172a;font-weight:600;${isMono2 ? "font-family:'Courier New',Consolas,monospace;" : ''}">${value2}</div>
            </td>
        </tr>`;

    const html = `
    <div style="width:794px;font-family:'Segoe UI',Tahoma,Geneva,sans-serif;background:white;">
        <!-- HEADER -->
        <table style="width:100%;border-collapse:collapse;background:linear-gradient(135deg,#1e1b4b,#4c1d95);">
            <tr>
                <td style="padding:28px 36px;color:white;">
                    <div style="font-size:28px;font-weight:800;letter-spacing:4px;">XIGI</div>
                    <div style="font-size:11px;opacity:0.7;margin-top:2px;letter-spacing:1px;">Digital Screen Network</div>
                </td>
                <td style="padding:28px 36px;color:white;text-align:right;">
                    <div style="font-size:16px;font-weight:700;letter-spacing:2px;">AD DEPLOYMENT SHEET</div>
                    <div style="font-size:10px;opacity:0.6;margin-top:4px;">Generated: ${generatedDate}</div>
                </td>
            </tr>
        </table>

        <div style="padding:28px 36px 20px 36px;">
            <!-- 1. CAMPAIGN INFO -->
            <div style="margin-bottom:22px;">
                ${sectionTitle('1', 'Campaign Information')}
                <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #f1f5f9;">
                    ${infoRow2('Campaign ID', campaign.campaign_id || '—', 'Campaign Name', campaign.campaign_name || '—', true)}
                    ${infoRow2('Advertiser', advertiser, 'Campaign Period', `${fmtDate(campaign.start_date)} → ${fmtDate(campaign.end_date)}`)}
                </table>
            </div>

            <!-- 2. TARGET SCREEN -->
            <div style="margin-bottom:22px;">
                ${sectionTitle('2', 'Target Screen')}
                <table style="width:100%;border-collapse:collapse;background:#fafafa;border:1px solid #f1f5f9;">
                    ${infoRow2('Screen Name', screenName, 'Screen ID', String(screenId), false, true)}
                    ${infoRow1('Full Address', fullAddress)}
                    ${infoRow2('Environment', environment, 'Screen Role', role)}
                    ${infoRow2('CMS Type', cmsType, 'Slot Number', `<span style="font-family:'Courier New',Consolas,monospace;font-weight:800;font-size:14px;">Slot ${slotNumber}</span>`)}
                </table>
            </div>

            <!-- 3. PLAYBACK SPECS & VERIFICATION -->
            <div style="margin-bottom:22px;">
                ${sectionTitle('3', 'Playback Specifications & Verification')}
                <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;">
                    <tr style="background:#f8fafc;">
                        <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;padding:10px 16px;text-align:left;border-bottom:2px solid #e2e8f0;">Specification</th>
                        <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;padding:10px 16px;text-align:left;border-bottom:2px solid #e2e8f0;">Required Value</th>
                        <th style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#64748b;padding:10px 16px;text-align:center;width:70px;border-bottom:2px solid #e2e8f0;">Status</th>
                    </tr>
                    ${checkRow('File Format', formats || '—', asset.is_file_format)}
                    ${checkRow('File Size', `≤ ${maxSize} MB`, asset.is_file_size)}
                    ${checkRow('Video Duration', `≤ ${maxDuration} seconds`, asset.is_video_duration)}
                    ${checkRow('Resolution', `${resW} × ${resH} px`, asset.is_resolution)}
                    ${checkRow('Orientation', orientation, asset.is_orientation)}
                </table>
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding:8px 16px;text-align:right;background:${allPassed ? '#f0fdf4' : '#fef2f2'};border:1px solid ${allPassed ? '#bbf7d0' : '#fecaca'};border-top:2px solid ${allPassed ? '#22c55e' : '#dc2626'};">
                            <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:${allPassed ? '#16a34a' : '#dc2626'};">${summaryText}</span>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- 4. AD FILE DETAILS -->
            <div style="margin-bottom:22px;">
                ${sectionTitle('4', 'Ad File Details')}
                <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;">
                    <tr>
                        <td style="width:56px;padding:16px;vertical-align:middle;">
                            <div style="width:50px;height:50px;background:#1e293b;color:white;text-align:center;line-height:50px;font-size:11px;font-weight:800;letter-spacing:1px;">${ext}</div>
                        </td>
                        <td style="padding:16px 12px;vertical-align:middle;">
                            <div style="font-size:13px;font-weight:700;color:#0f172a;word-wrap:break-word;overflow-wrap:break-word;max-width:400px;">${asset.original_filename || '—'}</div>
                            <div style="font-size:10px;color:#64748b;margin-top:4px;">${asset.file_type || ''} · ${fmtSize(asset.file_size_bytes)}</div>
                        </td>
                        <td style="padding:16px;text-align:right;vertical-align:middle;width:120px;">
                            ${badge(
        (asset.status || 'pending').toUpperCase(),
        asset.status === 'approved' ? '#dcfce7' : '#fef3c7',
        asset.status === 'approved' ? '#166534' : '#92400e',
        asset.status === 'approved' ? '#bbf7d0' : '#fde68a'
    )}
                        </td>
                    </tr>
                </table>
            </div>

            <!-- DEPLOYMENT INSTRUCTIONS + DOWNLOAD — starts on new page if needed -->
            <div style="page-break-before:always;padding-top:28px;">
            <table style="width:100%;border-collapse:collapse;background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;margin-bottom:22px;">
                <tr>
                    <td style="padding:16px 20px;">
                        <div style="font-size:10px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">⚡ Deployment Instructions</div>
                        <table style="width:100%;border-collapse:collapse;">
                            <tr><td style="padding:4px 0;font-size:11px;color:#78350f;">⚠ Upload this ad to <strong>Slot ${slotNumber}</strong> on the display controller software</td></tr>
                            <tr><td style="padding:4px 0;font-size:11px;color:#78350f;">⚠ Ensure the file plays at <strong>${resW} × ${resH}</strong> resolution in <strong>${orientation}</strong> mode</td></tr>
                            <tr><td style="padding:4px 0;font-size:11px;color:#78350f;">⚠ Campaign runs from <strong>${fmtDate(campaign.start_date)}</strong> to <strong>${fmtDate(campaign.end_date)}</strong> — remove after expiry</td></tr>
                            ${audioSupported ? `<tr><td style="padding:4px 0;font-size:11px;color:#78350f;">⚠ Audio is supported on this screen — verify volume levels</td></tr>` : ''}
                        </table>
                    </td>
                </tr>
            </table>

            <!-- DOWNLOAD BUTTON -->
            <table style="width:100%;border-collapse:collapse;background:#f5f3ff;border:2px dashed #c4b5fd;">
                <tr>
                    <td style="padding:20px;text-align:center;">
                        <div style="font-size:10px;color:#6d28d9;margin-bottom:12px;font-weight:500;">Click below to download the ad creative file for upload to your display controller</div>
                        <a href="${fileUrl}" download style="display:inline-block;background:#7c3aed;color:white;padding:14px 56px;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">
                            ⬇ DOWNLOAD AD FILE
                        </a>
                    </td>
                </tr>
            </table>
            </div><!-- end page-break-inside:avoid -->
        </div>

        <!-- FOOTER -->
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;">
            <tr>
                <td style="padding:16px 36px;font-size:9px;color:#94a3b8;">Confidential — Xigi Platform · For internal use only</td>
                <td style="padding:16px 36px;font-size:9px;color:#94a3b8;text-align:right;">Asset ID: #${asset.id || '—'} · Page 1 of 1</td>
            </tr>
        </table>
    </div>`;

    // Create a temporary container
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const filename = `Deployment_Sheet_${campaign.campaign_id || 'CAMP'}_Screen${screenId}_Slot${slotNumber}.pdf`;

    html2pdf()
        .set({
            margin: 0,
            filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container.firstElementChild)
        .save()
        .then(() => {
            document.body.removeChild(container);
        })
        .catch(() => {
            document.body.removeChild(container);
        });
}
