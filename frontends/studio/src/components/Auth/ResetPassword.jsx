import React, { useState } from 'react';
import '../../styles/auth/forgetpwd.css';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import AlertModal from '../Common/AlertModal';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error', onConfirm: null });

  const closeAlert = () => {
    if (alert.onConfirm) alert.onConfirm();
    setAlert({ ...alert, show: false });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setAlert({
        show: true,
        title: 'Error',
        message: 'Passwords do not match',
        type: 'error'
      });
      return;
    }

    try {
      await axios.post('/api/studio/reset-password/', {
        email,
        new_password: password
      });
      setAlert({
        show: true,
        title: 'Success!',
        message: 'Password reset successful! Please login with your new password.',
        type: 'success',
        onConfirm: () => navigate('/login')
      });
    } catch (error) {
      setAlert({
        show: true,
        title: 'Reset Failed',
        message: error.response?.data?.error || 'Failed to reset password',
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

          <h2 className="title">Reset Password</h2>
          <p className="desc">
            Set a new secure password for your account <br />
            <strong>{email}</strong>
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                value={password}
                placeholder="Enter new password"
                onChange={e => setPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                placeholder="Confirm your password"
                onChange={e => setConfirmPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <button type="submit" className="start-campaign-btn btn-primary" style={{ width: '100%', borderRadius: '8px' }}>Reset Password</button>

            <div className="back-link-container">
              <span className="back-link" onClick={() => navigate('/login')}>
                <i className="bi bi-arrow-left me-2"></i> Back to login
              </span>
            </div>
          </form>
        </div>
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

export default ResetPassword;


