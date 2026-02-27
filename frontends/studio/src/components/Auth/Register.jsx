import React, { useState } from 'react';
import '../../styles/auth/register.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AlertModal from '../Common/AlertModal';

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    orgType: 'advertiser', // Default or empty
    password: '',
    confirm_password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [alert, setAlert] = useState({ show: false, title: '', message: '', type: 'error', onConfirm: null });

  const closeAlert = () => {
    if (alert.onConfirm) alert.onConfirm();
    setAlert({ ...alert, show: false });
  };

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleOrgTypeChange = (type) => {
    setForm({ ...form, orgType: type });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    // API logic consistent with previous implementation
    if (form.orgType === 'agency') {
      // For Agency: Skip API call, redirect to setup with data
      console.log('Redirecting to Organization Setup with data:', form);
      navigate("/organization-setup", { state: { registrationData: form } });
      return;
    }

    // For Advertiser (and others): Register immediately
    try {
      const payload = {
        email: form.email,
        username: form.name,
        password: form.password,
        confirm_password: form.confirm_password,
        phone: form.phone,
        company_name: form.orgType,
        is_agency: false
      };

      console.log('Registering with:', payload);

      await axios.post('/api/studio/register/', payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      setAlert({
        show: true,
        title: 'Success!',
        message: 'Registration successful! Please login.',
        type: 'success',
        onConfirm: () => navigate("/login")
      });

    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        title: 'Registration Failed',
        message: error.response?.data?.message || 'Something went wrong. Please try again.',
        type: 'error'
      });
    }
  };

  return (
    <div className="register-container">
      <div className="register-box">
        {/* Left Side - Image */}
        <div className="register-left">
          <img
            src="/assets/Register-img.png"
            alt="Register Cover"
          />
        </div>

        {/* Right Side - Form */}
        <div className="register-right">
          <div className="brand-container">
            <img src="/assets/logo1.png" alt="Xigi" className="brand-logo-img" style={{ maxHeight: '50px' }} />
            <p className="brand-subtext">Welcome! Create your account to get started</p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Name */}
            <div className="form-group">
              <label>Name</label>
              <div className="input-wrapper">
                <input type="text" className="form-control" name="name" placeholder="Enter your Name" onChange={handleChange} required />
              </div>
            </div>

            {/* Email & Phone Row */}
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <div className="input-wrapper">
                  <input type="email" className="form-control" name="email" placeholder="Enter your Email" onChange={handleChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <div className="phone-input-group">
                  <span className="phone-prefix">+91</span>
                  <input type="tel" className="form-control phone-control" name="phone" value={form.phone} placeholder="Phone" onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Organization Type */}
            <div className="form-group">
              <label>Organization Type</label>
              <div className="org-type-container">
                <button
                  type="button"
                  className={`org-type-btn ${form.orgType === 'advertiser' ? 'active' : ''}`}
                  onClick={() => handleOrgTypeChange('advertiser')}
                >
                  Advertiser
                </button>
                <button
                  type="button"
                  className={`org-type-btn ${form.orgType === 'agency' ? 'active' : ''}`}
                  onClick={() => handleOrgTypeChange('agency')}
                >
                  Agency
                </button>
              </div>
            </div>

            {/* Password & Confirm Password Row */}
            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    name="password"
                    placeholder="Password"
                    onChange={handleChange}
                    required
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm Password</label>
                <div className="input-wrapper">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="form-control"
                    name="confirm_password"
                    placeholder="Confirm Password"
                    onChange={handleChange}
                    required
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" className="btn-submit">Sign Up</button>
            <div className="login-link-container">
              Already Have an account? <span className="login-link" onClick={() => navigate('/login')}>Login</span>
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

export default Register;
