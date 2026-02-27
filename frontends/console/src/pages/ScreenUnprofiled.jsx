import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import api from '../utils/api';
import '../styles/screenunprofiled.css';

const ScreenUnprofiled = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [screenData, setScreenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profiling, setProfiling] = useState(false);
  const [profileResult, setProfileResult] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Fixed Verify handler - using correct API endpoint
  const handleVerify = async () => {
    try {
      // Token check பண்ணு
      const token = localStorage.getItem('access_token');
      console.log('Token from localStorage:', token ? 'Token exists' : 'No token found');

      if (!token) {
        alert('No authentication token found. Please login again.');
        navigate('/login');
        return;
      }

      const verifyData = {
        screen_id: parseInt(id),
        status: "APPROVED",
        remarks: "all details are verified",
        reviewed_by: "Console Admin"
      };

      console.log('Sending verify data:', verifyData);
      console.log('Using token:', token.substring(0, 20) + '...');

      // Headers-ல token add பண்ணு
      const response = await api.post('http://192.168.31.226:8000/api/console/screens/verify/', verifyData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Verify response:', response.data);
      setScreenData(prev => ({ ...prev, status: "VERIFIED" }));
      alert('Screen verified successfully!');
    } catch (err) {
      console.error('Error verifying screen:', err);

      // Error details பாரு
      if (err.response) {
        console.error('Error status:', err.response.status);
        console.error('Error data:', err.response.data);
        console.error('Error headers:', err.response.headers);

        if (err.response.status === 401) {
          alert('Session expired or invalid token. Please login again.');
          // Clear invalid token
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          navigate('/login');
        } else {
          alert(`Failed to verify screen: ${err.response.data?.message || 'Please try again.'}`);
        }
      } else if (err.request) {
        console.error('No response received:', err.request);
        alert('Network error. Please check your connection.');
      } else {
        console.error('Error message:', err.message);
        alert('Failed to verify screen. Please try again.');
      }
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this screen? This action cannot be undone.')) return;
    try {
      await api.delete(`screen-specs/${id}/`);
      navigate('/console/screens');
    } catch (err) {
      console.error('Error deleting screen:', err);
      alert('Failed to delete screen.');
    }
  };

  // Fixed Reject handler - using correct API endpoint
  const handleReject = async () => {
    if (!rejectReason || !rejectRemarks) {
      alert('Please fill in both reason and remarks for rejection');
      return;
    }

    setIsSubmittingReject(true);
    try {
      const token = localStorage.getItem('access_token');

      const combinedRemarks = rejectRemarks
        ? `${rejectReason}: ${rejectRemarks}`
        : rejectReason;

      const rejectData = {
        screen_id: parseInt(id),
        status: "REJECTED",
        remarks: combinedRemarks,
        reviewed_by: "Console Admin"
      };

      console.log('Sending reject data:', rejectData);

      const response = await api.post('http://192.168.31.226:8000/api/console/screens/verify/', rejectData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Reject response:', response.data);

      setScreenData(prev => ({ ...prev, status: "REJECTED" }));
      setShowRejectModal(false);
      setRejectReason('');
      setRejectRemarks('');

      alert('Screen rejected successfully.');
    } catch (err) {
      console.error('Error rejecting screen:', err);
      if (err.response?.status === 401) {
        alert('Session expired. Please login again.');
        navigate('/login');
      } else {
        alert('Failed to reject screen. Please try again.');
      }
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const handleAIProfile = async () => {
    if (!screenData || !screenData.latitude || !screenData.longitude) {
      alert("Screen coordinates are missing!");
      return;
    }

    try {
      setProfiling(true);
      const payload = {
        latitude: parseFloat(screenData.latitude),
        longitude: parseFloat(screenData.longitude),
        mode: "hybrid"
      };

      const response = await api.post(`screen-profile/${id}/`, payload, { timeout: 120000 });
      navigate(`/console/screens/profiled/${id}`);
    } catch (err) {
      console.error('Error profiling screen:', err);
      alert('Failed to generate AI Profile. Check console for details.');
    } finally {
      setProfiling(false);
    }
  };

  useEffect(() => {
    const fetchScreenData = async () => {
      try {
        setLoading(true);
        const res = await api.get(`screen-specs/${id}/`);
        setScreenData(res.data);
      } catch (err) {
        console.error('Error fetching screen details:', err);
        setError('Failed to load screen details.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchScreenData();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="sdp-admin-layout flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !screenData) {
    return (
      <div className="sdp-admin-layout flex items-center justify-center min-h-screen">
        <div className="text-red-500 font-bold">{error || 'Screen not found'}</div>
      </div>
    );
  }

  // Dominance Ratio Data
  const dominanceData = [
    { name: 'Dominant', value: 72 },
    { name: 'Other', value: 28 },
  ];
  const DOMINANCE_COLORS = ['#0000FF', '#E2E8F0'];

  // Place Mix Data
  const placeMixData = [
    { category: 'Finance & Banking', count: 8, share: '53%', color: '#4F46E5' },
    { category: 'Offices & Tech Parks', count: 4, share: '13%', color: '#2563EB' },
    { category: 'Food & Beverage', count: 2, share: '13%', color: '#10B981' },
    { category: 'Healthcare', count: 1, share: '7%', color: '#F59E0B' },
    { category: 'Hotels & Lodging', count: 1, share: '7%', color: '#EF4444' },
    { category: 'Retail & Shopping', count: 1, share: '7%', color: '#8B5CF6' },
  ];

  return (
    <div className="sdp-admin-layout">
      {/* Main Content */}
      <main className="sdp-main-content">
        <header className="sdp-content-header">
          <div className="sdp-header-top">
            <h1 className="sdp-page-title">{screenData.screen_name || 'Unnamed Screen'}</h1>
            <span className={`sdp-badge ${screenData.status === 'VERIFIED' ? 'sdp-badge-verified' : screenData.status === 'RESUBMITTED' ? 'sdp-badge-pending' : 'sdp-badge-pending'}`}>
              {screenData.status === 'VERIFIED' ? 'Verified'
                : screenData.status === 'SUBMITTED' ? 'Review Pending'
                  : screenData.status === 'RESUBMITTED' ? 'Resubmitted'
                    : screenData.status === 'PENDING' ? 'Pending'
                      : screenData.status === 'REJECTED' ? 'Rejected'
                        : 'Draft'}
            </span>
            {screenData.is_profiled && <span className="sdp-badge sdp-badge-ai">AI-Enhanced</span>}
          </div>
          <div className="sdp-header-subtitle">
            {screenData.city || 'Bangalore'} {screenData.nearest_landmark ? `(${screenData.nearest_landmark})` : ''} · ID: {screenData.screen_id || `SCR-${screenData.id}`} · {screenData.company_name || 'PartnerX'}
          </div>
        </header>

        <div className="sdp-content-body">
          {/* Hardware & Playback Sections - your existing code */}
          <div className="sdp-intelligence-grid">
            <div className="sdp-card">
              <div className="sdp-card-title">Hardware & Specs</div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 20 }}>Physical dimensions, display technology, and installation details</div>
              <div className="sdp-specs-grid">
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Environment</div>
                  <div className="sdp-info-value">{screenData.environment || 'Indoor'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Screen Type</div>
                  <div className="sdp-info-value">{screenData.screen_type || 'Video Wall'}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Mounting</div>
                  <div className="sdp-info-value">{screenData.installation_type || 'N/A'} {screenData.mounting_height_ft ? `· ${screenData.mounting_height_ft}ft` : ''}</div>
                </div>
                <div className="sdp-specs-item">
                  <div className="sdp-info-label">Technology</div>
                  <div className="sdp-info-value">{screenData.technology || 'LED'}</div>
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
                  <div className="sdp-info-label">Dimensions</div>
                  <div className="sdp-info-value">{screenData.screen_width} X {screenData.screen_height} m</div>
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
                  <div className="sdp-info-label">Created_at</div>
                  <div className="sdp-info-value">{screenData.created_at ? new Date(screenData.created_at).toLocaleDateString() : 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Fields */}
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
                    <div className="sdp-info-label">Internet type</div>
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
                    <div className="sdp-info-label">Backup_Internet</div>
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
                    <div className="sdp-info-label">Ai Camera</div>
                    <div className="sdp-info-value">{screenData.ai_camera_installed ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">Playback Logs</div>
                    <div className="sdp-info-value">{screenData.playback_logs ? 'Yes' : 'No'}</div>
                  </div>
                  <div className="sdp-specs-item">
                    <div className="sdp-info-label">screen Health Ping</div>
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
        </div>

        {/* REJECT MODAL */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <i className="bi bi-x-circle text-red-500"></i>
                  Reject Screen
                </h3>
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectRemarks('');
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <i className="bi bi-x-lg text-xl"></i>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-600 mb-2">
                  Please provide a reason for rejecting this screen. This will be sent to the partner for corrections.
                </p>

                {/* Reason Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-sm"
                  >
                    <option value="">Select a reason...</option>
                    <option value="Incomplete Information">Incomplete Information</option>
                    <option value="Incorrect Location Data">Incorrect Location Data</option>
                    <option value="Invalid Documents">Invalid Documents</option>
                    <option value="Missing Compliance Documents">Missing Compliance Documents</option>
                    <option value="Technical Specifications Missing">Technical Specifications Missing</option>
                    <option value="Image Quality Poor">Image Quality Poor</option>
                    <option value="Duplicate Entry">Duplicate Entry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Remarks <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectRemarks}
                    onChange={(e) => setRejectRemarks(e.target.value)}
                    placeholder="Provide specific details about what needs to be fixed..."
                    rows="4"
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 text-sm resize-none"
                  />
                </div>


              </div>

              <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectRemarks('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-5 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleReject}
                  disabled={!rejectReason || !rejectRemarks || isSubmittingReject}
                >
                  {isSubmittingReject ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2"></i>
                      Confirm Reject
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Bar - hidden when reject modal is open */}
        {!showRejectModal && <div className="sdp-action-bar">
          <button
            className="sdp-btn"
            style={{
              background: '#FEE2E2',
              color: '#DC2626',
              marginRight: 'auto'
            }}
            onClick={() => setShowRejectModal(true)}
            title="Reject and move to draft"
          >
            <i className="bi bi-x-circle me-2"></i>
            Reject
          </button>
          <button className="sdp-btn sdp-btn-ghost" onClick={() => navigate(`/screen-profile/${screenData.id}`)}>
            <i className="bi bi-pencil-square me-2"></i>
            Edit Profile
          </button>
          <button className="sdp-btn" style={{ background: '#FEE2E2', color: '#DC2626' }} onClick={handleDelete}>
            Delete Screen <i className="bi bi-trash ms-2"></i>
          </button>
          {(screenData.status === 'SUBMITTED' || screenData.status === 'PENDING' || screenData.status === 'RESUBMITTED') ? (
            <button
              className="sdp-btn sdp-btn-primary"
              style={{ marginLeft: '12px', backgroundColor: '#0D9488', borderColor: '#0D9488' }}
              onClick={handleVerify}
            >
              Verify <i className="bi bi-check2-all ms-2"></i>
            </button>
          ) : screenData.status === 'VERIFIED' && !screenData.is_profiled ? (
            <button
              className="sdp-btn sdp-btn-primary"
              style={{ marginLeft: '12px' }}
              onClick={handleAIProfile}
              disabled={profiling}
            >
              {profiling ? 'Processing...' : (
                <>AI Profile <i className="bi bi-stars ms-2"></i></>
              )}
            </button>
          ) : screenData.is_profiled ? (
            <button
              className="sdp-btn sdp-btn-primary"
              style={{ marginLeft: '12px' }}
              onClick={() => navigate(`/console/screens/profiled/${id}`)}
            >
              View Profile <i className="bi bi-arrow-right ms-2"></i>
            </button>
          ) : (
            <span style={{ marginLeft: '12px', color: '#94A3B8', fontSize: '13px', fontWeight: 600 }}>
              Screen must be verified before profiling
            </span>
          )}
        </div>}
      </main>

      {/* AI Profile Result Modal */}
      {profileResult && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <i className="bi bi-robot text-blue-600"></i> AI Area Context Profile
              </h3>
              <button
                onClick={() => setProfileResult(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-50 font-mono text-xs">
              <pre className="whitespace-pre-wrap text-slate-700 bg-white p-4 rounded-lg border border-slate-200 shadow-inner">
                {JSON.stringify(profileResult, null, 2)}
              </pre>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
              <button
                className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-50 rounded-lg transition-colors"
                onClick={() => setProfileResult(null)}
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors flex items-center gap-2"
                onClick={() => {
                  setProfileResult(null);
                  navigate('/console/profiling');
                }}
              >
                Proceed to Profiling <i className="bi bi-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {profiling && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mb-4"></div>
          <h3 className="text-xl font-bold text-slate-800">Generating AI Profile...</h3>
          <p className="text-slate-500 mt-2">Analyzing area context with Gemini & Google Maps</p>
        </div>
      )}
    </div>
  );
};

export default ScreenUnprofiled;