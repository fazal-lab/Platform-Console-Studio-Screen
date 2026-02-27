import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import api from '../utils/api';
import './styles/ScreenOnboarding.css';

// Import Steps
import Step1_Identifiers from './steps/Step1_Identifiers';
import Step2_Display from './steps/Step2_Display';
import Step3_Visibility from './steps/Step3_Visibility';
import Step4_Playback from './steps/Step4_Playback';
import Step5_Commercials from './steps/Step5_Commercials';
import Step6_Compliance from './steps/Step6_Compliance';
import Step7_Summary from './steps/Step7_Summary';

const STEPS = [
    { id: 1, name: 'Identifiers', component: Step1_Identifiers },
    { id: 2, name: 'Display', component: Step2_Display },
    { id: 3, name: 'Visibility', component: Step3_Visibility },
    { id: 4, name: 'Playback', component: Step4_Playback },
    { id: 5, name: 'Commercials', component: Step5_Commercials },
    { id: 6, name: 'Compliance', component: Step6_Compliance },
    { id: 7, name: 'Summary', component: Step7_Summary },
];

export default function ScreenOnboardingPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [maxStepReached, setMaxStepReached] = useState(1); // Track maximum step reached

    const [formData, setFormData] = useState({
        // Step 1
        screen_name: '',
        role: '',
        city: '',
        latitude: '',
        longitude: '',
        full_address: '',
        nearest_landmark: '',

        // Step 2
        technology: '',
        environment: '',
        screen_type: '',
        screen_width: '',
        screen_height: '',
        resolution_width: '',
        resolution_height: '',
        pixel_pitch_mm: '',
        brightness_nits: '',
        refresh_rate_hz: '',

        // Step 3
        installation_type: '',
        mounting_height_ft: '',
        facing_direction: '',
        road_type: '',
        traffic_direction: '',

        // Step 4
        standard_ad_duration_sec: '',
        total_slots_per_loop: '',
        loop_length_sec: '',
        reserved_slots: '',
        supported_formats_json: [],
        max_file_size_mb: '',
        internet_type: '',
        average_bandwidth_mbps: '',
        power_backup_type: '',
        days_active_per_week: '',
        downtime_windows: '',
        audio_supported: false,
        backup_internet: false,

        // Step 5
        base_price_per_slot_inr: '',
        seasonal_pricing: false,
        seasons_json: [],
        enable_min_booking: false,
        minimum_booking_days: '',
        surcharge_percent: '',
        sensitive_zone_flags_json: [],
        restricted_categories_json: [],

        // Step 6
        cms_type: '',
        cms_api: '',
        ai_camera_installed: false,
        screen_health_ping: false,
        playback_logs: false,
        ai_camera_api: '',
        ownership_proof_uploaded: null,
        permission_noc_available: null,
        gst: '',
        content_policy_accepted: false
    });

    // Get the logged-in user's name for admin_name
    const getAdminName = () => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.username || user.name || localStorage.getItem('username') || '';
    };

    const [adminName] = useState(getAdminName());

    const [loadingDraft, setLoadingDraft] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    // 'all' = BLOCKED (edit everything), 'restricted' = VERIFIED/SCHEDULED_BLOCK (only pricing/ops)
    const [fieldAccess, setFieldAccess] = useState('all');

    const updateFormData = (updates) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    const location = useLocation();

    useEffect(() => {
        if (location.state?.editMode) {
            setIsEditMode(true);
        }
        // Determine field access based on screen status
        const st = location.state?.screenStatus;
        if (st === 'BLOCKED') {
            setFieldAccess('all');
        } else if (st === 'VERIFIED' || st === 'SCHEDULED_BLOCK') {
            setFieldAccess('restricted');
        } else {
            setFieldAccess('all'); // new screen or draft — no restrictions
        }
        if (location.state?.draftData) {
            const d = location.state.draftData;
            console.log("Resuming draft, passed data:", d);

            // If only id is passed, fetch full data from API
            if (d.id && Object.keys(d).length <= 2) {
                setLoadingDraft(true);
                api.get(`screen-specs/${d.id}/`)
                    .then(res => {
                        const fetched = res.data;
                        console.log("Fetched draft data from API:", fetched);

                        // Set the DB id so subsequent saves use PATCH
                        const restoredData = { ...fetched, dbId: fetched.id };

                        // File fields come as URL strings from API — set them to null
                        // so they don't get sent as strings (only re-upload replaces them)
                        if (typeof restoredData.ownership_proof_uploaded === 'string') {
                            restoredData.ownership_proof_uploaded = null;
                        }
                        if (typeof restoredData.permission_noc_available === 'string') {
                            restoredData.permission_noc_available = null;
                        }

                        setFormData(prev => ({ ...prev, ...restoredData }));



                        // Restore the step position
                        if (location.state?.editMode) {
                            // Edit mode: unlock all tabs, start at step 1
                            setCurrentStep(1);
                            setMaxStepReached(7);
                        } else if (fetched.current_step) {
                            setCurrentStep(fetched.current_step);
                            setMaxStepReached(fetched.current_step);
                        }
                    })
                    .catch(err => {
                        console.error("Failed to fetch draft data:", err);
                        alert("Failed to load draft data. Starting fresh.");
                    })
                    .finally(() => {
                        setLoadingDraft(false);
                    });
            } else {
                // Full data was passed directly (legacy/future usage)
                const restoredData = { ...d, dbId: d.id };
                setFormData(prev => ({ ...prev, ...restoredData }));

                if (d.current_step) {
                    setCurrentStep(d.current_step);
                    setMaxStepReached(d.current_step);
                }
            }
        }
    }, [location.state]);

    const validateStep = (step) => {
        switch (step) {
            case 1:
                if (!formData.screen_name || !formData.role || !formData.city || !formData.latitude || !formData.longitude || !formData.full_address || !formData.nearest_landmark) {
                    return "Required fields missing in Identifiers";
                }
                if (formData._screenNameError) {
                    return "This screen name already exists. Please use a unique name.";
                }
                break;
            case 2:
                if (!formData.technology || !formData.environment || !formData.screen_type || !formData.screen_width || !formData.screen_height || !formData.resolution_width || !formData.resolution_height) {
                    return "Required fields missing in Display";
                }
                break;
            case 3:
                // Road Type and Traffic Direction are optional for Indoor
                if (formData.environment === 'Indoor') {
                    if (!formData.installation_type || !formData.mounting_height_ft || !formData.facing_direction) {
                        return "Required fields missing in Visibility";
                    }
                } else {
                    if (!formData.installation_type || !formData.mounting_height_ft || !formData.facing_direction || !formData.road_type || !formData.traffic_direction) {
                        return "Required fields missing in Visibility";
                    }
                }
                break;
            case 4:
                if (!formData.standard_ad_duration_sec || !formData.total_slots_per_loop || !formData.reserved_slots || !formData.internet_type || !formData.average_bandwidth_mbps || !formData.power_backup_type || !formData.days_active_per_week) {
                    return "Required fields missing in Playback";
                }
                // Downtime mandatory only if enabled
                if (formData.enable_downtime && !formData.downtime_windows) {
                    return "Please set Downtime Windows since Enable Downtime is checked.";
                }
                break;
            case 5:
                if (!formData.base_price_per_slot_inr || formData.sensitive_zone_flags_json.length === 0 || formData.restricted_categories_json.length === 0) {
                    return "Required fields missing in Commercials";
                }
                // If seasonal pricing is on, require at least one row
                if (formData.seasonal_pricing && (!formData.seasons_json || formData.seasons_json.length === 0)) {
                    return "Please add at least one Seasonal Pricing row since it is enabled.";
                }
                // If min booking is on, require surcharge percent and minimum booking days
                if (formData.enable_min_booking && (!formData.minimum_booking_days || !formData.surcharge_percent)) {
                    return "Please fill Minimum Booking Days and Extra Charge % since Minimum Booking is enabled.";
                }
                break;
            case 6:
                // FIX: Use cms_api and gst (not partner_cms_api and partner_gst)
                if (!formData.cms_type || !formData.cms_api || !formData.gst || !formData.content_policy_accepted || !formData.ownership_proof_uploaded || !formData.permission_noc_available) {
                    return "Required fields missing in Compliance";
                }
                break;
            default:
                return null;
        }
        return null;
    };

    const handleNext = () => {
        const error = validateStep(currentStep);
        if (error) {
            alert(error);
            return;
        }
        if (currentStep < STEPS.length) {
            const nextStep = currentStep + 1;
            setCurrentStep(nextStep);

            // Update max reached step based on progression
            if (nextStep > maxStepReached) {
                setMaxStepReached(nextStep);
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (isEditMode && (formData.dbId || formData.id)) {
            navigate(`/console/screens/profiled/${formData.dbId || formData.id}`);
        } else {
            navigate('/console/screens');
        }
    };

    const handleSaveDraft = async () => {
        setIsSubmitting(true);
        try {
            const submitData = new FormData();

            // Append all form data
            Object.keys(formData).forEach(key => {
                const value = formData[key];

                if (key === 'ownership_proof_uploaded' || key === 'permission_noc_available') {
                    if (value && value instanceof File) submitData.append(key, value);
                } else if (key === 'screen_name' && (!value || value.trim() === '')) {
                    // Skip empty screen_name for drafts to avoid unique constraint mismatch with ""
                    // In DB it will stay NULL which allows duplicates
                    return;
                } else if (Array.isArray(value)) {
                    submitData.append(key, JSON.stringify(value));
                } else if (typeof value === 'boolean') {
                    submitData.append(key, value ? 'true' : 'false');
                } else if (value !== null && value !== undefined && value !== '') {
                    submitData.append(key, value);
                }
            });

            // Append admin_name
            if (adminName) submitData.append('admin_name', adminName);
            submitData.append('status', 'DRAFT');
            submitData.append('current_step', currentStep);

            let response;
            const recordId = formData.dbId || formData.id;
            if (recordId && !isNaN(recordId)) {
                response = await api.patch(`screen-specs/${recordId}/`, submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                response = await api.post('screen-specs/', submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (response.data.id) {
                    setFormData(prev => ({ ...prev, id: response.data.id, dbId: response.data.id }));
                }
            }

            setDraftMessage({ text: '✅ Draft saved successfully! Redirecting...', type: 'success' });
            setTimeout(() => {
                navigate('/console/screens', { state: { activeTab: 'draft' } });
            }, 1500);
        } catch (err) {
            console.error('Draft save error:', err);
            let msg = err.message;
            if (err.response?.data) {
                if (typeof err.response.data === 'object') {
                    msg = Object.entries(err.response.data)
                        .map(([k, v]) => `${k}: ${v}`).join(', ');
                } else {
                    msg = JSON.stringify(err.response.data);
                }
            }
            setDraftMessage({ text: `❌ Draft save failed: ${msg}`, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [draftMessage, setDraftMessage] = useState({ text: '', type: '' });

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const submitData = new FormData();

            // Normalize role to lowercase for both status logic and API submission
            if (formData.role) {
                formData.role = formData.role.toLowerCase();
            }

            // Append all form data
            const skipFields = ['dbId', 'id', '_screenNameError', 'company_name', 'partner_name', 'created_at', 'updated_at'];
            Object.keys(formData).forEach(key => {
                if (skipFields.includes(key)) return;
                const value = formData[key];

                if (key === 'ownership_proof_uploaded' || key === 'permission_noc_available' ||
                    key === 'screen_image_front' || key === 'screen_image_back' || key === 'screen_image_long') {
                    if (value && value instanceof File) submitData.append(key, value);
                } else if (Array.isArray(value)) {
                    submitData.append(key, JSON.stringify(value));
                } else if (typeof value === 'boolean') {
                    submitData.append(key, value ? 'true' : 'false');
                } else if (value !== null && value !== undefined && value !== '') {
                    submitData.append(key, value);
                }
            });

            // Append admin_name
            if (adminName) submitData.append('admin_name', adminName);

            // Logic: Xigi & Franchise are auto-verified. Partners need manual verification.
            const autoVerifyRoles = ['xigi', 'franchise'];
            const finalStatus = autoVerifyRoles.includes(formData.role) ? 'VERIFIED' : 'SUBMITTED';
            submitData.append('status', finalStatus);
            submitData.append('current_step', 7);

            // Internal screens: auto-mark remarks and reviewer
            submitData.append('source', 'INTERNAL');
            submitData.append('remarks', 'all details are verified');
            if (adminName) submitData.append('reviewed_by', adminName);

            const recordId = formData.dbId || formData.id;
            if (recordId && !isNaN(recordId)) {
                await api.put(`screen-specs/${recordId}/`, submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('screen-specs/', submitData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            alert(isEditMode ? 'Screen updated successfully! Redirecting...' : 'Screen onboarded successfully! Redirecting to list...');
            navigate(isEditMode ? `/console/screens/profiled/${formData.dbId || formData.id}` : '/console/screens');
        } catch (err) {
            console.error('Submission error:', err);
            const msg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
            setError(msg);
            alert(`Submission failed: ${msg}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleTabClick = (stepId) => {
        // Only allow navigation to steps already reached
        if (stepId <= maxStepReached) {
            setCurrentStep(stepId);
        }
    };

    const CurrentStepComponent = STEPS[currentStep - 1].component;
    const isCurrentStepValid = !validateStep(currentStep);

    return (
        <div className="ssp-container">
            <button className="ssp-back-link" onClick={handleBack}>
                <ChevronLeft size={16} />
                Back to {isEditMode ? 'Screen Profile' : (currentStep === 1 ? 'Screens' : 'previous')}
            </button>
            <div className="ssp-form-card">
                {/* Loading state while fetching draft data */}
                {loadingDraft && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '80px 20px',
                        gap: '16px'
                    }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            border: '4px solid #e2e8f0',
                            borderTop: '4px solid #3b82f6',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>Loading draft data...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {!loadingDraft && <>
                    {/* Field access info banner for restricted mode */}
                    {fieldAccess === 'restricted' && (
                        <div style={{
                            margin: '0 0 16px 0', padding: '12px 16px',
                            background: '#FFFBEB', border: '1px solid #FCD34D',
                            borderRadius: '8px', fontSize: '13px', color: '#92400E',
                            display: 'flex', alignItems: 'flex-start', gap: '10px'
                        }}>
                            <span style={{ fontSize: '16px', marginTop: '1px' }}>🔒</span>
                            <div>
                                <strong>Restricted Edit Mode</strong> — This screen is <strong>Verified / Scheduled to Block</strong>.
                                Physical specs, location, and identity fields are locked.
                                You can freely edit <strong>pricing, commercial settings, connectivity, and compliance documents</strong>.
                            </div>
                        </div>
                    )}
                    {/* Horizontal Progress Tabs */}
                    <div className="ssp-progress">
                        {STEPS.map(step => {
                            // Locked if step is beyond the furthest reached step
                            const isLocked = step.id > maxStepReached;

                            return (
                                <div
                                    key={step.id}
                                    className={`ssp-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''} ${isLocked ? 'locked' : ''}`}
                                    onClick={() => !isLocked && handleTabClick(step.id)}
                                >
                                    {step.id}. {step.name}
                                </div>
                            );
                        })}
                    </div>

                    {/* Current Step Component */}
                    {currentStep === 7 ? (
                        <Step7_Summary
                            data={formData}
                            adminName={adminName}
                            onGoBack={() => setCurrentStep(6)}
                            onConfirmSubmit={handleSubmit}
                            isSubmitting={isSubmitting}
                        />
                    ) : (
                        <CurrentStepComponent
                            data={formData}
                            update={updateFormData}
                            isEditMode={isEditMode}
                            screenId={formData.dbId || formData.id}
                            fieldAccess={fieldAccess}
                        />
                    )}

                    {/* Actions Footer - Hidden on Summary page */}
                    {currentStep !== 7 && (
                        <div>
                            {/* Inline Draft Message */}
                            {draftMessage.text && (
                                <div style={{
                                    padding: '10px 16px',
                                    marginBottom: '12px',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    background: draftMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                    color: draftMessage.type === 'success' ? '#166534' : '#991b1b',
                                    border: `1px solid ${draftMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`
                                }}>
                                    {draftMessage.text}
                                </div>
                            )}
                            <div className="ssp-actions">
                                {isEditMode ? (
                                    <button
                                        className="ssp-btn ssp-btn-primary"
                                        onClick={() => { setCurrentStep(7); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                    >
                                        Move to Summary →
                                    </button>
                                ) : (
                                    <>
                                        <button className="ssp-btn ssp-btn-secondary" onClick={handleSaveDraft} disabled={isSubmitting}>
                                            {isSubmitting ? 'Saving...' : 'Save Draft'}
                                        </button>
                                        <button
                                            className="ssp-btn ssp-btn-primary"
                                            onClick={handleNext}
                                            disabled={!isCurrentStepValid}
                                            title={!isCurrentStepValid ? "Please fill all required fields" : ""}
                                        >
                                            {currentStep === 6 ? 'Review & Submit' : 'Next'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </>}
            </div>
        </div>
    );
}
