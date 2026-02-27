import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import '../styles/ScreenProfiled.css';

const ScreenProfiled = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [screenData, setScreenData] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [hoveredRing, setHoveredRing] = useState(null);
  const [reprofileLoading, setReprofileLoading] = useState(false);
  const [reprofileSuccess, setReprofileSuccess] = useState(false);

  const fetchData = async () => {
    try {
      const [screenRes, profileRes] = await Promise.all([
        api.get(`screen-specs/${id}/`),
        api.get(`screen-profile/${id}/`)
      ]);
      let fetchedScreen = screenRes.data;

      // Auto-flip SCHEDULED_BLOCK → BLOCKED if the scheduled date has passed
      if (fetchedScreen.status === 'SCHEDULED_BLOCK' && fetchedScreen.scheduled_block_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const blockDate = new Date(fetchedScreen.scheduled_block_date);
        if (blockDate <= today) {
          try {
            // Trigger the backend flip
            const blockRes = await api.post(`screens/${id}/block/`);
            fetchedScreen = { ...fetchedScreen, status: blockRes.data.status, scheduled_block_date: blockRes.data.scheduled_block_date || null };
          } catch (e) {
            // If block fails (e.g. auth), use local computed status
            fetchedScreen = { ...fetchedScreen, status: 'BLOCKED', scheduled_block_date: null };
          }
        }
      }

      setScreenData(fetchedScreen);
      setProfileData(profileRes.data.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleReprofile = async () => {
    if (!screenData?.latitude || !screenData?.longitude) {
      alert('Screen coordinates are missing!');
      return;
    }
    if (!window.confirm('Re-run AI profiling for this screen?')) return;
    try {
      setReprofileLoading(true);
      setActionLoading(true);
      await api.post(`screen-profile/${id}/`, {
        latitude: parseFloat(screenData.latitude),
        longitude: parseFloat(screenData.longitude),
        mode: 'hybrid'
      }, { timeout: 120000 });
      await fetchData();
      setReprofileLoading(false);
      setReprofileSuccess(true);
      setTimeout(() => setReprofileSuccess(false), 3000);
    } catch (err) {
      console.error('Error re-profiling:', err);
      setReprofileLoading(false);
      alert('Failed to re-profile. Check console for details.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    try {
      setActionLoading(true);
      await api.patch(`screen-specs/${id}/`, { status: 'VERIFIED' });
      setScreenData(prev => ({ ...prev, status: 'VERIFIED' }));
    } catch (err) {
      console.error('Error verifying screen:', err);
      alert('Failed to verify screen.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this screen? This action cannot be undone.')) return;
    try {
      setActionLoading(true);
      await api.delete(`screen-specs/${id}/`);
      navigate('/console/screens');
    } catch (err) {
      console.error('Error deleting screen:', err);
      alert('Failed to delete screen.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    const isScheduled = screenData.status === 'SCHEDULED_BLOCK';
    const confirmMsg = isScheduled
      ? 'This screen is already scheduled to block. Click OK to force-check if the date has passed.'
      : 'Block this screen?\n\n• If active campaigns exist: it will be scheduled to block after all campaigns end.\n• If no active campaigns: it will be blocked immediately.';

    if (!window.confirm(confirmMsg)) return;
    try {
      setActionLoading(true);
      const res = await api.post(`screens/${id}/block/`);
      const { status: newStatus, scheduled_block_date } = res.data;
      setScreenData(prev => ({
        ...prev,
        status: newStatus,
        scheduled_block_date: scheduled_block_date || null
      }));
      if (newStatus === 'SCHEDULED_BLOCK') {
        alert(`Screen will be blocked after ${scheduled_block_date}. All active campaigns will run uninterrupted.`);
      } else {
        alert('Screen has been blocked immediately.');
      }
    } catch (err) {
      console.error('Error blocking screen:', err);
      alert(err.response?.data?.error || 'Failed to block screen.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="sdp-admin-layout flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!screenData || !profileData) {
    return (
      <div className="sdp-admin-layout flex items-center justify-center min-h-screen">
        <div className="text-red-500 font-bold">Data not found or error loading profile.</div>
      </div>
    );
  }

  // ── profileData fields (from screen_ai_profiles table via to_response_dict) ──
  // profileData.coordinates.latitude / .longitude
  // profileData.geoContext.city / .state / .country / .cityTier / .formattedAddress
  // profileData.area.primaryType / .context / .confidence / .classificationDetail / .dominantGroup
  // profileData.movement.type / .context
  // profileData.dwellCategory / .dwellConfidence / .dwellScore
  // profileData.dominanceRatio
  // profileData.ringAnalysis.ring1 / .ring2 / .ring3  (JSON blobs)
  // profileData.reasoning  (array of strings)
  // profileData.metadata.computedAt / .apiCallsMade / .cached / .processingTimeMs / .apiKeyConfigured / .warnings / .version
  // profileData.primaryType / .areaContext / .movementType  (top-level shortcuts)
  // profileData.llmEnhancement.used / .reason / .mode

  // ── Dominance Ratio Donut ──
  const dominanceRatio = profileData.dominanceRatio || 0;
  const dominanceData = [
    { name: 'Dominant', value: Math.round(dominanceRatio * 100) },
    { name: 'Other', value: 100 - Math.round(dominanceRatio * 100) },
  ];
  const DOMINANCE_COLORS = ['#0000FF', '#E2E8F0'];

  // ── Place Mix Data (from ring2 analysis JSON → placeGroups) ──
  const CATEGORY_COLORS = {
    RELIGIOUS: '#3B82F6',
    RETAIL: '#8B5CF6',
    FOOD_BEVERAGE: '#F59E0B',
    HEALTHCARE: '#10B981',
    FINANCE: '#4F46E5',
    OFFICE: '#6366F1',
    TRANSIT: '#EC4899',
    EDUCATION: '#06B6D4',
    ENTERTAINMENT: '#EF4444',
    SPORTS: '#14B8A6',
    HOSPITALITY: '#A855F7',
    TOURISM: '#F97316',
    INDUSTRIAL: '#64748B',
    RESIDENTIAL: '#84CC16',
    GOVERNMENT: '#0EA5E9',
  };
  const FALLBACK_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444', '#14B8A6'];
  const ring2pm = profileData.ringAnalysis?.ring2 || {};
  const placeGroups = ring2pm.placeGroups || ring2pm.group_counts || ring2pm.groupCounts || {};
  const ring2Radius = ring2pm.radius || ring2pm.baseRadius || 450;
  const totalPlaces = Object.values(placeGroups).reduce((sum, c) => sum + (typeof c === 'number' ? c : 0), 0);
  const placeMixData = Object.entries(placeGroups)
    .map(([key, val], idx) => {
      const count = typeof val === 'number' ? val : (val?.count || 0);
      return {
        category: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
        count,
        share: totalPlaces > 0 ? `${Math.round((count / totalPlaces) * 100)}%` : '0%',
        color: CATEGORY_COLORS[key] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
      };
    })
    .filter(d => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <div className="sdp-admin-layout">
      {/* Reprofile Loading Overlay */}
      {reprofileLoading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px'
        }}>
          <div style={{
            width: 56, height: 56,
            border: '4px solid #E5E7EB', borderTopColor: '#F59E0B',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ fontSize: 18, fontWeight: 700, color: '#D97706', letterSpacing: '0.5px' }}>Reprofiling...</p>
          <p style={{ fontSize: 13, color: '#9CA3AF' }}>AI is analyzing the location. This may take a moment.</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Reprofile Success Toast */}
      {reprofileSuccess && (
        <div style={{
          position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
          background: '#059669', color: '#fff',
          padding: '12px 28px', borderRadius: 8, fontWeight: 700, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          ✓ Reprofiled successfully!
          <style>{`@keyframes slideDown { from { opacity:0; transform:translateX(-50%) translateY(-20px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
        </div>
      )}

      <main className="sdp-main-content">
        <header className="sdp-content-header">
          <div className="sdp-header-top">
            <h1 className="sdp-page-title">{screenData.screen_name || 'Unnamed Screen'}</h1>
            <span className={`sdp-badge ${screenData.status === 'VERIFIED' ? 'sdp-badge-verified' : screenData.status === 'BLOCKED' ? 'sdp-badge-blocked' : 'sdp-badge-pending'}`}>
              {screenData.status === 'VERIFIED' ? 'Verified' : screenData.status === 'BLOCKED' ? 'Blocked' : (screenData.status === 'SUBMITTED' ? 'Review Pending' : 'Draft')}
            </span>
            {screenData.profile_status === 'REPROFILE' ? (
              <span className="sdp-badge" style={{ background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>⟳ Reprofile Needed</span>
            ) : (
              <span className="sdp-badge sdp-badge-ai">AI-Enhanced</span>
            )}
          </div>
          <div className="sdp-header-subtitle">
            {screenData.city || profileData.geoContext?.city} {screenData.nearest_landmark ? `(${screenData.nearest_landmark})` : ''} · ID: {screenData.screen_id || `SCR-${screenData.id}`} · {screenData.company_name || 'PartnerX'}
          </div>
        </header>

        <div className="sdp-content-body">
          {/* Intelligence & Metrics Section */}
          <div className="sdp-intelligence-grid">
            <div className="sdp-card">
              <div className="sdp-card-title">Area Intelligence</div>
              <div className="sdp-area-stats-container">
                <div className="sdp-area-info">
                  <div className="sdp-main-stat-title">
                    {profileData.area?.primaryType?.replace(/_/g, ' ') || 'N/A'}
                    {' '}<span className="sdp-stat-badge">{profileData.area?.confidence} confidence</span>
                  </div>
                  <div className="sdp-stat-details">
                    <div className="sdp-stat-group">
                      <div className="sdp-stat-label">Dominant:</div>
                      <div className="sdp-stat-value">{profileData.area?.dominantGroup?.charAt(0) + profileData.area?.dominantGroup?.slice(1).toLowerCase().replace(/_/g, ' ')}</div>
                    </div>
                    <div className="sdp-stat-group">
                      <div className="sdp-stat-label">Classification:</div>
                      <div className="sdp-stat-value">{profileData.area?.classificationDetail?.replace(/_/g, ' ')}</div>
                    </div>
                  </div>
                </div>

                <div style={{ width: 140, height: 140, position: 'relative' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={dominanceData}
                        innerRadius={55}
                        outerRadius={68}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                      >
                        {dominanceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={DOMINANCE_COLORS[index]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)', textAlign: 'center', lineHeight: 1
                  }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{Math.round(dominanceRatio * 100)}%</div>
                    <div style={{ fontSize: '0.45rem', fontWeight: 700, color: '#9CA3AF', marginTop: 2 }}>DOMINANCE RATIO</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sdp-metrics-grid">
              <div className="sdp-metric-card">
                <div className="sdp-metric-label">Dwell Time</div>
                <div className="sdp-metric-value sdp-metric-highlight">{profileData.dwellCategory?.replace(/_/g, ' ') || 'N/A'}</div>
                <div className="sdp-metric-sub">Score: {profileData.dwellScore ?? 'N/A'}</div>
              </div>
              <div className="sdp-metric-card">
                <div className="sdp-metric-label">Movement</div>
                <div className="sdp-metric-value sdp-metric-red">{profileData.movement?.type?.replace(/_/g, ' ') || 'N/A'}</div>
                <div className="sdp-metric-sub">{profileData.movement?.context || 'N/A'}</div>
              </div>
              <div className="sdp-metric-card">
                <div className="sdp-metric-label">City Tier</div>
                <div className="sdp-metric-value sdp-metric-green">{profileData.geoContext?.cityTier || 'N/A'}</div>
                <div className="sdp-metric-sub">{profileData.geoContext?.city || screenData.city || 'N/A'}</div>
              </div>
              <div className="sdp-metric-card">
                <div className="sdp-metric-label">Processing</div>
                <div className="sdp-metric-value sdp-metric-pink">{profileData.metadata?.processingTimeMs ? `~${Math.round(profileData.metadata.processingTimeMs / 1000)}s` : 'N/A'}</div>
                {profileData.metadata?.apiCallsMade && <div className="sdp-metric-sub">{profileData.metadata.apiCallsMade} API Calls</div>}
              </div>
              <div className="sdp-metric-card">
                <div className="sdp-metric-label">Environment</div>
                <div className="sdp-metric-value" style={{ color: screenData.environment === 'Outdoor' ? '#D97706' : '#6366F1' }}>{screenData.environment || 'N/A'}</div>
                <div className="sdp-metric-sub">{screenData.screen_width && screenData.screen_height ? `${(parseFloat(screenData.screen_width) * parseFloat(screenData.screen_height)).toFixed(1)} sq.m` : 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Where Is It & Place Mix Section */}
          <div className="sdp-intelligence-grid">
            <div className="sdp-card">
              <div className="sdp-card-title">Where Is It?</div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 20 }}>Spatial analysis of the location</div>
              <div className="sdp-intelligence-grid" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {(() => {
                    // ── Read ring radii from actual data ──
                    const ring1 = profileData.ringAnalysis?.ring1 || {};
                    const ring2 = profileData.ringAnalysis?.ring2 || {};
                    const ring3 = profileData.ringAnalysis?.ring3 || {};

                    const r1m = ring1.radius || 75;
                    const r2m = ring2.radius || ring2.baseRadius || 450;
                    const r3m = ring3.radius || 200;

                    // ── Sort by actual radius (largest → outermost) ──
                    const ringsData = [
                      { id: 'ring2', label: 'Classification Zone', radiusM: r2m, detail: totalPlaces ? `${totalPlaces} places found` : null },
                      { id: 'ring3', label: 'Movement Zone', radiusM: r3m, detail: ring3.roadType ? `${ring3.roadType} road` : null },
                      { id: 'ring1', label: 'Authority Zone', radiusM: r1m, detail: ring1.uniquePlaces ? `${ring1.uniquePlaces} places found` : (ring1.keyVenues?.length ? `${ring1.keyVenues.length} venues` : null) },
                    ].sort((a, b) => b.radiusM - a.radiusM);

                    // ── Fixed visual radii — even spacing regardless of actual meters ──
                    const FIXED_RADII = [75, 55, 35];
                    // Label Y positions just above each ring's top edge
                    const LABEL_Y = [30, 50, 70];

                    // Ring colors (outer → inner: lighter → deeper)
                    const ringColors = [
                      { fill: 'rgba(67, 56, 202, 0.05)', stroke: 'rgba(67, 56, 202, 0.10)', activeFill: 'rgba(67, 56, 202, 0.14)', activeStroke: '#4338CA' },
                      { fill: 'rgba(67, 56, 202, 0.10)', stroke: 'rgba(67, 56, 202, 0.20)', activeFill: 'rgba(67, 56, 202, 0.22)', activeStroke: '#4338CA' },
                      { fill: 'rgba(67, 56, 202, 0.15)', stroke: 'rgba(67, 56, 202, 0.30)', activeFill: 'rgba(67, 56, 202, 0.32)', activeStroke: '#4338CA' },
                    ];

                    return (
                      <>
                        <svg width="320" height="280" viewBox="0 0 240 200" style={{ overflow: 'visible' }}>
                          <defs>
                            <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
                              <feGaussianBlur stdDeviation="3" result="blur" />
                              <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                              </feMerge>
                            </filter>
                          </defs>

                          {/* Render circles centered to the left */}
                          {ringsData.map((ring, idx) => {
                            const svgR = FIXED_RADII[idx];
                            const colors = ringColors[idx];
                            const isActive = hoveredRing === ring.id;
                            return (
                              <circle
                                key={ring.id}
                                cx="80"
                                cy="100"
                                r={svgR}
                                fill={isActive ? colors.activeFill : colors.fill}
                                stroke={isActive ? colors.activeStroke : colors.stroke}
                                strokeWidth={isActive ? 2.5 : 1}
                                filter={isActive ? 'url(#ring-glow)' : 'none'}
                                style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                                onMouseEnter={() => setHoveredRing(ring.id)}
                                onMouseLeave={() => setHoveredRing(null)}
                              />
                            );
                          })}

                          {/* Center dot */}
                          <circle cx="80" cy="100" r="4" fill="#4338CA" />
                          <circle cx="80" cy="100" r="7" fill="none" stroke="#4338CA" strokeWidth="1.5" />

                          {/* Leader lines + labels on the right */}
                          {ringsData.map((ring, idx) => {
                            const svgR = FIXED_RADII[idx];
                            const isActive = hoveredRing === ring.id;
                            // Label Y positions — evenly spaced on the right
                            const labelYPositions = [60, 100, 140];
                            const labelY = labelYPositions[idx];
                            // Leader line starts at ring edge (going upper-right from center)
                            const angle = -Math.PI / 4 + (idx * Math.PI / 8);
                            const edgeX = 80 + svgR * Math.cos(angle);
                            const edgeY = 100 + svgR * Math.sin(angle);
                            const labelX = 175;

                            return (
                              <g
                                key={`lbl-${ring.id}`}
                                onMouseEnter={() => setHoveredRing(ring.id)}
                                onMouseLeave={() => setHoveredRing(null)}
                                style={{ cursor: 'pointer' }}
                              >
                                {/* Leader line: ring edge → label */}
                                <line
                                  x1={edgeX}
                                  y1={edgeY}
                                  x2={labelX - 2}
                                  y2={labelY}
                                  stroke={isActive ? '#4338CA' : '#C7D2FE'}
                                  strokeWidth={isActive ? 1.2 : 0.7}
                                  style={{ transition: 'all 0.3s ease' }}
                                />
                                {/* Small dot at ring edge */}
                                <circle
                                  cx={edgeX}
                                  cy={edgeY}
                                  r={isActive ? 2.5 : 1.5}
                                  fill={isActive ? '#4338CA' : '#A5B4FC'}
                                  style={{ transition: 'all 0.3s ease' }}
                                />
                                {/* Label text */}
                                <text
                                  x={labelX}
                                  y={labelY + 1}
                                  fontSize="7"
                                  fontWeight={isActive ? '800' : '600'}
                                  fill={isActive ? '#312E81' : '#4338CA'}
                                  style={{ transition: 'all 0.3s ease', userSelect: 'none' }}
                                >
                                  {ring.label} ({ring.radiusM}m)
                                </text>
                                {isActive && ring.detail && (
                                  <text x={labelX} y={labelY + 12} fontSize="5.5" fontWeight="500" fill="#9CA3AF">
                                    {ring.detail}
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>

                        <div style={{ color: '#4338CA', fontSize: '0.75rem', fontWeight: 600, marginTop: 8, fontFamily: 'monospace' }}>
                          {profileData.coordinates?.latitude?.toFixed(6)}, {profileData.coordinates?.longitude?.toFixed(6)}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="sdp-info-list">
                  <div className="sdp-info-item">
                    <div className="sdp-info-label">Near Landmark</div>
                    <div className="sdp-info-value">{screenData.nearest_landmark || 'None specified'}</div>
                  </div>
                  <div className="sdp-info-item">
                    <div className="sdp-info-label">Facing</div>
                    <div className="sdp-info-value">{screenData.facing_direction || 'N/A'}</div>
                  </div>
                  <div className="sdp-info-item">
                    <div className="sdp-info-label">Road Type</div>
                    <div className="sdp-info-value">{screenData.road_type || 'N/A'} {screenData.traffic_direction ? `(${screenData.traffic_direction})` : ''}</div>
                  </div>
                  <div className="sdp-info-item">
                    <div className="sdp-info-label">Address</div>
                    <div className="sdp-info-value">{profileData.geoContext?.formattedAddress || 'N/A'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sdp-card">
              <div className="sdp-card-title">Place Mix</div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 20 }}>{totalPlaces} unique places within {ring2Radius}m</div>
              {placeMixData.length > 0 ? (
                <div className="sdp-intelligence-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'center' }}>
                  <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={placeMixData}
                          innerRadius={70}
                          outerRadius={95}
                          paddingAngle={3}
                          dataKey="count"
                          stroke="none"
                        >
                          {placeMixData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <table className="sdp-place-mix-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="sdp-td-count">Count</th>
                        <th className="sdp-td-share">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {placeMixData.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <span className="sdp-dot" style={{ backgroundColor: item.color }}></span>
                            {item.category}
                          </td>
                          <td className="sdp-td-count">{item.count}</td>
                          <td className="sdp-td-share">{item.share}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ color: '#94A3B8', fontSize: '0.8rem', padding: '32px 0', textAlign: 'center' }}>No place mix data available</div>
              )}
            </div>
          </div>

          {/* Hardware & Specs / Ad Policy & Pricing */}
          <div className="sdp-intelligence-grid">
            <div className="sdp-card">
              <div className="sdp-card-title">Hardware & Specs</div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 20 }}>Physical dimensions, display technology, and installation details</div>
              <div className="sdp-specs-grid">
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Environment</div>
                  <div className="sdp-info-value">{screenData.environment || 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Screen Type</div>
                  <div className="sdp-info-value">{screenData.screen_type || 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Mounting</div>
                  <div className="sdp-info-value">{screenData.installation_type || 'N/A'} {screenData.mounting_height_ft ? `· ${screenData.mounting_height_ft}ft` : ''}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Technology</div>
                  <div className="sdp-info-value">{screenData.technology || 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Resolution</div>
                  <div className="sdp-info-value">{screenData.resolution_width} × {screenData.resolution_height} ({screenData.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'})</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Pixel Pitch</div>
                  <div className="sdp-info-value">{screenData.pixel_pitch_mm || 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Dimensions (W × H)</div>
                  <div className="sdp-info-value">{screenData.screen_width || 'N/A'} × {screenData.screen_height || 'N/A'} m</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Total Area</div>
                  <div className="sdp-info-value">{screenData.screen_width && screenData.screen_height ? `${(parseFloat(screenData.screen_width) * parseFloat(screenData.screen_height)).toFixed(2)} sq.m` : 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Brightness</div>
                  <div className="sdp-info-value">{screenData.brightness_nits ? `${screenData.brightness_nits.toLocaleString()} nit` : 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Facing</div>
                  <div className="sdp-info-value">{screenData.facing_direction || 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Road Type</div>
                  <div className="sdp-info-value">{screenData.road_type || 'N/A'} {screenData.traffic_direction ? `(${screenData.traffic_direction})` : ''}</div>
                </div>
              </div>
            </div>

            <div className="sdp-card">
              <div className="sdp-card-title">Ad Policy & Pricing</div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 20 }}>Configuration for slot pricing, loop timing, and booking rules</div>
              <div className="sdp-specs-grid">
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Ad Duration</div>
                  <div className="sdp-info-value">{screenData.standard_ad_duration_sec}s</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Slots per Loop</div>
                  <div className="sdp-info-value">{screenData.total_slots_per_loop}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Loop Length</div>
                  <div className="sdp-info-value">{screenData.loop_length_sec || 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Slot Price</div>
                  <div className="sdp-info-value">₹{screenData.base_price_per_slot_inr}/day</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Min. Booking & Surcharge</div>
                  <div className="sdp-info-value">
                    {screenData.minimum_booking_days || 'N/A'}
                    {screenData.surcharge_percent && parseFloat(screenData.surcharge_percent) > 0 ? ` & ${Math.round(screenData.surcharge_percent)}%` : ''}
                  </div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Reserved Slots</div>
                  <div className="sdp-info-value">{screenData.reserved_slots}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Supported Formats</div>
                  <div className="sdp-info-value">{screenData.supported_formats_json?.join(', ') || 'N/A'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Created</div>
                  <div className="sdp-info-value">{screenData.created_at ? new Date(screenData.created_at).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Connectivity & Operations */}
          <div className="sdp-card">
            <div className="sdp-intelligence-grid" style={{ gridTemplateColumns: '2.5fr 1fr' }}>
              <div>
                <div className="sdp-card-title">Connectivity & Operations</div>
                <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 24 }}>Technical connectivity, power redundancy, and API endpoints</div>
                <div className="sdp-specs-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">CMS Type</div>
                    <div className="sdp-info-value">{screenData.cms_type || 'N/A'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Max File Size</div>
                    <div className="sdp-info-value">{screenData.max_file_size_mb || 'N/A'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Internet Type</div>
                    <div className="sdp-info-value">{screenData.internet_type || 'N/A'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Audio Supported</div>
                    <div className="sdp-info-value">{screenData.audio_supported ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Seasonal Price</div>
                    <div className="sdp-info-value">{screenData.seasonal_pricing ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Power Type</div>
                    <div className="sdp-info-value">{screenData.power_backup_type || 'N/A'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Days Active/Week</div>
                    <div className="sdp-info-value">{screenData.days_active_per_week}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Backup Internet</div>
                    <div className="sdp-info-value">{screenData.backup_internet ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Minimum Booking Price</div>
                    <div className="sdp-info-value">{screenData.enable_min_booking ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Downtime Window</div>
                    <div className="sdp-info-value">{screenData.downtime_windows || 'N/A'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">AI Camera</div>
                    <div className="sdp-info-value">{screenData.ai_camera_installed ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Playback Logs</div>
                    <div className="sdp-info-value">{screenData.playback_logs ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Screen Health Ping</div>
                    <div className="sdp-info-value">{screenData.screen_health_ping ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">CMS API</div>
                    <div className="sdp-info-value">{screenData.cms_api || 'N/A'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Camera API</div>
                    <div className="sdp-info-value">{screenData.ai_camera_api || 'N/A'}</div>
                  </div>
                </div>

                <div className="sdp-seasonal-table-container">
                  <div className="sdp-seasonal-title">Seasonal Charges</div>
                  <table className="sdp-seasonal-table">
                    <thead>
                      <tr>
                        <th>Season</th>
                        <th className="sdp-text-center">Type</th>
                        <th className="sdp-text-right">Charges(%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {screenData.seasons_json && screenData.seasons_json.length > 0 ? (
                        screenData.seasons_json.map((season, idx) => {
                          const type = season.adjustment_type || season.type;
                          const isSurcharge = type === 'Surcharge';
                          const color = isSurcharge ? '#EF4444' : '#10B981';
                          return (
                            <tr key={idx}>
                              <td>{season.season || season.name}</td>
                              <td className="sdp-text-center" style={{ color, fontWeight: 600 }}>
                                {type}
                              </td>
                              <td className="sdp-text-right" style={{ color, fontWeight: 600 }}>
                                {season.adjustment_pct || season.percentage}%
                              </td>
                            </tr>);
                        })
                      ) : (
                        <tr>
                          <td colSpan="3" className="text-center p-4 text-slate-400">No seasonal charges defined</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ borderLeft: '1px solid #F1F5F9', paddingLeft: 32 }}>
                <div className="sdp-info-label" style={{ marginBottom: 12 }}>Restricted Categories</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {screenData.restricted_categories_json && screenData.restricted_categories_json.length > 0 ? (
                    screenData.restricted_categories_json.map((cat, idx) => (
                      <span key={idx} className="sdp-tag-item">{cat}</span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </div>
                <div className="sdp-info-label" style={{ margin: '24px 0 12px 0' }}>Sensitive Zone</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {screenData.sensitive_zone_flags_json && screenData.sensitive_zone_flags_json.length > 0 ? (
                    screenData.sensitive_zone_flags_json.map((flag, idx) => (
                      <span key={idx} className="sdp-tag-item sdp-sensitive" style={{ color: '#C2410C', background: '#FFF7ED', border: '1px solid #FFEDD5' }}>{flag}</span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">None</span>
                  )}
                </div>

                <div className="sdp-info-label" style={{ margin: '24px 0 12px 0' }}>Compliance Documents</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {screenData.ownership_proof_uploaded ? (
                    <a
                      href={screenData.ownership_proof_uploaded}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sdp-doc-link"
                      style={{ color: '#2563EB', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span style={{ transform: 'rotate(45deg)', display: 'inline-block' }}>📎</span> Ownership Proof
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Ownership Proof: Not Uploaded</span>
                  )}
                  {screenData.permission_noc_available ? (
                    <a
                      href={screenData.permission_noc_available}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sdp-doc-link"
                      style={{ color: '#2563EB', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <span style={{ transform: 'rotate(45deg)', display: 'inline-block' }}>📎</span> Permission NOC
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Permission NOC: Not Uploaded</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* AI Reasoning Trail */}
          <div className="sdp-card">
            <div className="sdp-card-title">AI Reasoning Trail</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 24 }}>Transparent logic breakdown for the profiling result</div>
            <div className="sdp-reasoning-trail">
              {(() => {
                const raw = profileData.reasoning || [];
                if (!raw.length) return <div style={{ color: '#94A3B8', fontSize: '0.8rem', textAlign: 'center', padding: 24 }}>No reasoning data available</div>;

                // ── Negative patterns (match → entire line is negative, or partial) ──
                const NEG_FULL = [/^No /i, /rejected/i, /failed/i, /skipped/i, /^0 places/i];
                const NEG_PARTIAL = [
                  /(yielded only \d+ unique places.*)/i,
                  /(No major anchor found.*)/i,
                  /(No high-priority authority.*)/i,
                  /(0 places \(0 unique\))/i,
                  /(Found 0 places.*)/i,
                ];

                const isFullNeg = (text) => NEG_FULL.some(p => p.test(text.trim()));

                const renderText = (text) => {
                  // Check partial negative patterns first
                  for (const pat of NEG_PARTIAL) {
                    const m = text.match(pat);
                    if (m) {
                      const idx = text.indexOf(m[1]);
                      return (
                        <span>
                          {text.slice(0, idx)}
                          <span className="sdp-tree-neg">{m[1]}</span>
                          {text.slice(idx + m[1].length)}
                        </span>
                      );
                    }
                  }
                  // Full negative
                  if (isFullNeg(text)) return <span className="sdp-tree-neg">{text}</span>;
                  return <span>{text}</span>;
                };

                const tree = [];
                let currentRoot = null;

                for (const line of raw) {
                  const stepMatch = line.match(/^Step\s+[\d.]+:\s*(.+)/i);
                  if (stepMatch) {
                    // New root node — strip "Step N:" prefix
                    currentRoot = { title: stepMatch[1].replace(/\.$/, ''), children: [] };
                    tree.push(currentRoot);
                  } else if (currentRoot) {
                    // Child of current step
                    // Split on first ":"
                    const colonIdx = line.indexOf(':');
                    if (colonIdx > 0 && colonIdx < 30) {
                      const prefix = line.slice(0, colonIdx).trim();
                      const body = line.slice(colonIdx + 1).trim();
                      currentRoot.children.push({ prefix, text: body, raw: line });
                    } else {
                      currentRoot.children.push({ prefix: '', text: line, raw: line });
                    }
                  } else {
                    // Orphan line before any step — create its own root
                    tree.push({ title: line, children: [] });
                  }
                }

                // ── Dot color per step ──
                const stepColors = ['#10B981', '#6366F1', '#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4'];

                return tree.map((root, ri) => {
                  const dotColor = stepColors[ri % stepColors.length];

                  // Group children: consecutive children with same prefix become a sub-branch group
                  const groups = [];
                  let lastPrefix = null;
                  for (const child of root.children) {
                    if (child.prefix && child.prefix === lastPrefix && groups.length > 0) {
                      groups[groups.length - 1].items.push(child);
                    } else {
                      groups.push({ prefix: child.prefix, items: [child] });
                      lastPrefix = child.prefix;
                    }
                  }

                  return (
                    <div className="sdp-tree-root" key={ri}>
                      <div className="sdp-tree-root-header">
                        <div className="sdp-tree-root-dot" style={{ background: dotColor }} />
                        <div className="sdp-tree-root-title">{root.title}</div>
                      </div>

                      {groups.length > 0 && (
                        <div className="sdp-tree-children">
                          {groups.map((group, gi) => {
                            // If group has multiple items with same prefix → render as sub-branch
                            if (group.items.length > 1) {
                              return (
                                <div key={gi}>
                                  <div className="sdp-tree-branch">
                                    <span className="sdp-tree-branch-dot" style={{ background: dotColor, opacity: 0.6 }} />
                                    <span className="sdp-tree-branch-text" style={{ fontWeight: 600, color: '#334155' }}>
                                      {group.prefix}
                                    </span>
                                  </div>
                                  <div className="sdp-tree-subbranch">
                                    {group.items.map((item, ii) => (
                                      <div className="sdp-tree-branch" key={ii}>
                                        <span className="sdp-tree-branch-dot" style={{ background: isFullNeg(item.text) ? '#DC2626' : '#CBD5E1' }} />
                                        <span className="sdp-tree-branch-text">{renderText(item.text)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            // Single branch item
                            const item = group.items[0];
                            const lineText = item.prefix ? `${item.prefix}: ${item.text}` : item.text;
                            const neg = isFullNeg(item.raw);
                            return (
                              <div className="sdp-tree-branch" key={gi}>
                                <span className="sdp-tree-branch-dot" style={{ background: neg ? '#DC2626' : dotColor, opacity: neg ? 1 : 0.5 }} />
                                <span className="sdp-tree-branch-text">{renderText(lineText)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="sdp-action-bar">
          {/* Block Screen Button */}
          {screenData.status === 'BLOCKED' ? (
            <button
              className="sdp-btn"
              style={{ background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', marginRight: 'auto', cursor: 'not-allowed', opacity: 0.7 }}
              disabled
            >
              <i className="bi bi-slash-circle ms-2"></i> Blocked
            </button>
          ) : screenData.status === 'SCHEDULED_BLOCK' ? (
            <button
              className="sdp-btn"
              style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', marginRight: 'auto', cursor: 'default' }}
              onClick={handleBlock}
              disabled={actionLoading}
              title={`Screen will block after ${screenData.scheduled_block_date}`}
            >
              <i className="bi bi-clock-history me-2"></i>
              Scheduled Block · {screenData.scheduled_block_date}
            </button>
          ) : (
            <button
              className="sdp-btn"
              style={{ background: '#FFF3E0', color: '#E65100', border: '1px solid #FFE0B2', marginRight: 'auto' }}
              onClick={handleBlock}
              disabled={actionLoading}
            >
              Block Screen <i className="bi bi-slash-circle ms-2"></i>
            </button>
          )}
          <button className="sdp-btn" style={{ background: '#FEE2E2', color: '#DC2626' }} onClick={handleDelete} disabled={actionLoading}>Delete Screen <i className="bi bi-trash ms-2"></i></button>
          <button
            className="sdp-btn"
            style={{ background: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}
            onClick={() => navigate('/console/screens/onboard', {
              state: { draftData: { id: screenData.id }, editMode: true, screenStatus: screenData.status }
            })}
            disabled={actionLoading}
          >
            Edit Screen <i className="bi bi-pencil-square ms-2"></i>
          </button>
          <button className="sdp-btn sdp-btn-reprofile" onClick={handleReprofile} disabled={actionLoading}>
            {actionLoading ? 'Processing...' : 'Re-profile'}
          </button>
          {screenData.status !== 'VERIFIED' && (
            <button className="sdp-btn sdp-btn-primary" onClick={handleVerify} disabled={actionLoading}>
              Mark as Verified <i className="bi bi-check2 ms-2"></i>
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ScreenProfiled;