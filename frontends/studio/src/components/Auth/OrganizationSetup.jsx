import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import '../../styles/auth/organizationSetup.css';
import AlertModal from '../Common/AlertModal';

const OrganizationSetup = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [agencyName, setAgencyName] = useState('');
    const [businessLocation, setBusinessLocation] = useState(''); // Optional, not sent to backend yet
    const [isLoading, setIsLoading] = useState(false);
    const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error', onConfirm: null });

    const closeAlert = () => {
        if (alert.onConfirm) alert.onConfirm();
        setAlert({ ...alert, show: false });
    };

    // Get registration data passed from Register page
    const registrationData = location.state?.registrationData;

    useEffect(() => {
        if (!registrationData) {
            setAlert({
                show: true,
                title: 'Data Missing',
                message: 'No registration data found. Please sign up first.',
                type: 'error',
                onConfirm: () => navigate('/register')
            });
        }
    }, [registrationData, navigate]);

    const handleCreateAgency = async () => {
        if (!agencyName.trim()) {
            setAlert({
                show: true,
                title: 'Required Field',
                message: 'Please enter an Agency Name',
                type: 'error'
            });
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                email: registrationData.email,
                username: registrationData.name,
                password: registrationData.password,
                confirm_password: registrationData.confirm_password,
                phone: registrationData.phone,
                company_name: agencyName, // Use actual Agency Name
                is_agency: true
            };

            await axios.post('/api/studio/register/', payload, {
                headers: { 'Content-Type': 'application/json' }
            });

            setAlert({
                show: true,
                title: 'Success!',
                message: 'Agency Account created successfully! Please login.',
                type: 'success',
                onConfirm: () => navigate('/login')
            });

        } catch (error) {
            console.error(error);
            setAlert({
                show: true,
                title: 'Registration Failed',
                message: error.response?.data?.message || 'Something went wrong. Please try again.',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="org-setup-container">
            <div className="org-setup-card clearfix">
                <a onClick={() => navigate('/register')} className="back-link">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 8H1M1 8L8 15M1 8L8 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Back to signup
                </a>

                <h1 className="org-setup-title">Create your agency workspace</h1>
                <p className="org-setup-description">This is where you'll manage all your client campaigns and billing.</p>

                <div className="form-group">
                    <label className="form-label">Agency name</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="e.g: Acme Media Group"
                        value={agencyName}
                        onChange={(e) => setAgencyName(e.target.value)}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Business Location (Optional)</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="City, Location"
                        value={businessLocation}
                        onChange={(e) => setBusinessLocation(e.target.value)}
                    />
                    <p className="helper-text">Used for billing and reporting</p>
                </div>

                <div className="form-group">
                    <label className="form-label">Invite Team Members (Optional)</label>
                    <textarea
                        className="form-control"
                        placeholder="Enter email addresses separated by commas"
                        rows="4"
                        style={{ resize: 'none' }}
                    ></textarea>
                </div>

                <p className="helper-text" style={{ marginBottom: '24px' }}>
                    You can invite more later from Settings
                </p>

                <button
                    className="submit-btn"
                    onClick={handleCreateAgency}
                    disabled={isLoading}
                >
                    {isLoading ? 'Creating...' : 'Create agency'}
                </button>
            </div>
            <AlertModal
                isOpen={alert.show}
                onClose={closeAlert}
                title={alert.title}
                message={alert.message}
                type={alert.type}
            />
        </div>
    );
};

export default OrganizationSetup;
