import React, { useState } from 'react';
import '../../styles/auth/forgetpwd.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AlertModal from '../Common/AlertModal';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error' });

  const handleSubmit = async e => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    try {
      await axios.post('/api/studio/send-reset-code/', { email: trimmedEmail });
      navigate('/verify-code', { state: { email: trimmedEmail } });
    } catch (error) {
      setAlert({
        show: true,
        title: 'Email Not Found',
        message: 'The email address you entered is not recognized. Please check and try again.',
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

          <h2 className="title">Forgot password</h2>
          <p className="desc">
            Enter your email address to receive a verification code
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                value={email}
                placeholder="Enter your Email"
                onChange={e => setEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <button type="submit" className="start-campaign-btn btn-primary" style={{ width: '100%', borderRadius: '8px' }}>Send verification code</button>

            <div className="back-link-container">
              <span className="back-link" onClick={() => navigate('/login')}>
                <i className="bi bi-arrow-left me-2"></i> Back to sign in
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

export default ForgotPassword;
