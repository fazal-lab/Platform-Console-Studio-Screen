import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/auth/login.css';
import axios from 'axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    try {
      console.log('Attempting login with:', { email });
      const res = await axios.post('/api/studio/login/', { email, password }, {
        headers: { 'Content-Type': 'application/json' }
      });

      console.log('Login response:', res.data);
      if (res.data && res.data.data && res.data.data.tokens && res.data.data.tokens.access) {
        // Clear stale session data from any previous user
        localStorage.removeItem('xigi_campaign_draft')
        Object.keys(localStorage)
          .filter(k => k.startsWith('deletedAssets_'))
          .forEach(k => localStorage.removeItem(k))
        sessionStorage.clear()

        localStorage.setItem('token', res.data.data.tokens.access);

        // Store user details if available
        if (res.data.data.user) {
          const user = res.data.data.user;
          if (user.name) localStorage.setItem('userName', user.name);
          if (user.email) localStorage.setItem('userEmail', user.email);
          if (user.phone) localStorage.setItem('userPhone', user.phone);
          if (user.company) localStorage.setItem('orgType', user.company);
          if (user.id) localStorage.setItem('userId', String(user.id));
        }

        localStorage.setItem('isLoggedIn', 'true');

        // Check if user has any active (paid) campaigns → route accordingly
        try {
          const token = res.data.data.tokens.access;
          const campaignsRes = await axios.get('/api/studio/campaign/', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const campaigns = campaignsRes.data?.data || [];
          const hasActive = campaigns.some(c => c.status === 'active');
          console.log('User campaigns:', campaigns.length, '| Has active:', hasActive);
          navigate(hasActive ? '/active-dashboard-demo' : '/dashboard');
        } catch {
          navigate('/dashboard');
        }
      } else {
        setErrorMsg('Invalid response from server');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      if (error.response && error.response.data && error.response.data.message) {
        setErrorMsg(error.response.data.message);
      } else {
        setErrorMsg('Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="login-container">
      {isLoading && (
        <div className="login-overlay">
          <div className="overlay-content">
            <div className="login-spinner large"></div>
            <p>Signing in...</p>
          </div>
        </div>
      )}
      <div className="login-box">
        {/* Left Side: Image */}
        <div className="login-left">
          <img
            src="/assets/Login-img.png"
            alt="Xigi Billboard"
          />
        </div>

        {/* Right Side: Form */}
        <div className="login-right">
          <div className="brand-container">
            <img src="/assets/logo1.png" alt="Xigi" className="brand-logo-img" style={{ maxHeight: '60px' }} />
            <p className="brand-subtext">Welcome back to XIGI</p>
          </div>

          {errorMsg && (
            <div style={{ color: 'red', textAlign: 'center', marginBottom: '15px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email address</label>
              <div className="input-wrapper">
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter your Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  placeholder="Enter your Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="forgot-block">
              <span className="forgot-password-link" onClick={() => navigate('/forgot-password')}>
                Forgot your password?
              </span>
            </div>

            <button type="submit" className="btn-submit" disabled={isLoading}>
              {isLoading ? (
                <div className="btn-loading-content">
                  <span className="login-spinner"></span>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>

            <div className="create-account">
              Don't Have an account? <span className="create-new-link" onClick={() => navigate('/register')}>Create new</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
