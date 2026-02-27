import { useState } from 'react'

function Step3_Connectivity({ data, update }) {
  const [localData, setLocalData] = useState({
    cms_type: data.cms_type || 'XIGI_CMS',
    partner_cms_brand: data.partner_cms_brand || '',
    partner_cms_api_support: data.partner_cms_api_support || false,
    internet_type: data.internet_type || 'FIBER',
    average_bandwidth_mbps: data.average_bandwidth_mbps || '50',
    backup_internet: data.backup_internet || false,
    power_backup_type: data.power_backup_type || 'UPS',
    uptime_target_percent: data.uptime_target_percent || '99'
  })

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    setLocalData(prev => ({ ...prev, [name]: val }))
    update({ [name]: val })
  }

  return (
    <div className="ssp-step-content">
      <h3 className="ssp-section-title">3. Connectivity & Hardware</h3>

      {/* CMS Configuration */}
      <h4 className="ssp-subtitle">Content Management System (CMS)</h4>
      <div className="ssp-group">
        <label className="ssp-label">Who manages content? <span className="ssp-required">*</span></label>
        <div style={{ display: 'flex', gap: '20px', marginTop: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="radio"
              name="cms_type"
              value="XIGI_CMS"
              checked={localData.cms_type === 'XIGI_CMS'}
              onChange={handleChange}
            /> Xigi CMS (We manage)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="radio"
              name="cms_type"
              value="PARTNER_CMS"
              checked={localData.cms_type === 'PARTNER_CMS'}
              onChange={handleChange}
            /> Partner CMS (You manage)
          </label>
        </div>
      </div>

      {localData.cms_type === 'PARTNER_CMS' && (
        <div className="ssp-row token-fade-in">
          <div className="ssp-group">
            <label className="ssp-label">CMS Provider <span className="ssp-required">*</span></label>
            <select name="partner_cms_brand" className="ssp-select" value={localData.partner_cms_brand} onChange={handleChange}>
              <option value="">Select CMS</option>
              <option value="Broadsign">Broadsign</option>
              <option value="Scala">Scala</option>
              <option value="Signagelive">Signagelive</option>
              <option value="Screenly">Screenly</option>
              <option value="Vistar">Vistar Media</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="ssp-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="partner_cms_api_support"
                checked={localData.partner_cms_api_support}
                onChange={handleChange}
              /> Supports API Integration?
            </label>
          </div>
        </div>
      )}

      <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #eee' }} />

      {/* Network & Power */}
      <h4 className="ssp-subtitle">Network & Power</h4>
      <div className="ssp-row">
        <div className="ssp-group">
          <label className="ssp-label">Internet Type</label>
          <select name="internet_type" className="ssp-select" value={localData.internet_type} onChange={handleChange}>
            <option value="FIBER">Fiber Optic</option>
            <option value="4G">4G / LTE</option>
            <option value="5G">5G</option>
            <option value="BROADBAND">Broadband</option>
            <option value="WIFI">WiFi</option>
          </select>
        </div>
        <div className="ssp-group">
          <label className="ssp-label">Avg Bandwidth (Mbps)</label>
          <select name="average_bandwidth_mbps" className="ssp-select" value={localData.average_bandwidth_mbps} onChange={handleChange}>
            <option value="10">10 Mbps</option>
            <option value="25">25 Mbps</option>
            <option value="50">50 Mbps</option>
            <option value="100">100 Mbps</option>
            <option value="200">200+ Mbps</option>
          </select>
        </div>
      </div>

      <div className="ssp-row">
        <div className="ssp-group">
          <label className="ssp-label">Power Backup</label>
          <select name="power_backup_type" className="ssp-select" value={localData.power_backup_type} onChange={handleChange}>
            <option value="UPS">UPS Only</option>
            <option value="GENERATOR">Generator Only</option>
            <option value="UPS_AND_GENERATOR">UPS + Generator</option>
            <option value="NONE">None</option>
          </select>
        </div>
        <div className="ssp-group">
          <label className="ssp-label">Uptime Guarantee</label>
          <select name="uptime_target_percent" className="ssp-select" value={localData.uptime_target_percent} onChange={handleChange}>
            <option value="95">95%</option>
            <option value="99">99%</option>
            <option value="99.5">99.5%</option>
            <option value="99.9">99.9%</option>
          </select>
        </div>
      </div>

      <div className="ssp-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="backup_internet"
            checked={localData.backup_internet}
            onChange={handleChange}
          /> Has Backup Internet Connection?
        </label>
      </div>

    </div>
  )
}

export default Step3_Connectivity
