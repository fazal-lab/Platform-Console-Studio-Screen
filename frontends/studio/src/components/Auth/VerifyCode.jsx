import React, { useState } from 'react';
import '../../styles/auth/forgetpwd.css';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import AlertModal from '../Common/AlertModal';

const VerifyCode = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const [code, setCode] = useState('');
  const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error' });

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/studio/verify-code/', { email, code });
      if (response.status === 200) {
        navigate('/reset-password', { state: { email, code } });
      }
    } catch (error) {
      setAlert({
        show: true,
        title: 'Verification Failed',
        message: error.response?.data?.error || 'Invalid code. Please check and try again.',
        type: 'error'
      });
    }
  };

  return (
    <div className="forget-container">
      <div className="forget-box">
        {/* Left Side - Image */}
        <div className="forget-left">
          <img src="/assets/Login-img.png" alt="Login Banner" className="auth-banner-img" />
        </div>

        {/* Right Side - Form */}
        <div className="forget-right">
          <div className="brand-logo-container">
            <img src="/assets/Xigi.png" alt="Xigi" className="brand-logo-img" />
          </div>

          <h2 className="title">Verify code</h2>
          <p className="desc">
            We've sent a 6-digit verification code to <br />
            <strong>{email || 'your email'}</strong>
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Verification Code</label>
              <input
                type="text"
                value={code}
                placeholder="Enter 6-digit code"
                onChange={e => setCode(e.target.value)}
                className="form-input"
                maxLength="6"
                required
              />
            </div>

            <button type="submit" className="start-campaign-btn btn-primary" style={{ width: '100%', borderRadius: '8px' }}>Verify</button>

            <div className="back-link-container">
              <span className="back-link" onClick={() => navigate('/forgot-password')}>
                <i className="bi bi-arrow-left me-2"></i> Back to previous
              </span>
            </div>
          </form>
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
};

export default VerifyCode;


