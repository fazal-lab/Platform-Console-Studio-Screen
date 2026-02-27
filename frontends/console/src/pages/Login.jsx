import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import '../styles/consolelogin.css';

import logo from '../assets/logo.png';

import api from '../utils/api';

const Consolelogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const response = await api.post('login/', { email, password });
            const { access, refresh, user } = response.data;

            // Store tokens and user info
            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            localStorage.setItem('user', JSON.stringify(user));

            navigate('/console/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid credentials or connection error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="console-login-wrapper">
            <div className="login-left-panel"><div className="login-brand mb-5">

            </div>
                <div className="login-form-container">
                    <div className="login-brand">
                        <img src={logo}
                            className='mx-auto' alt="xigi" style={{ height: '60px' }} />

                    </div>
                    <p className='text-white text-center fs-2'>Admin Panel</p>


                    <form className="console-login-form" onSubmit={handleSubmit}>
                        {error && <div className="login-error-message text-danger text-center mb-3">{error}</div>}
                        <div className="form-input-group">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="Enter your Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-input-group">
                            <label>Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="signin-submit-btn" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>


                </div>
            </div>
            <div className="login-right-panel">
                <div className="dashboard-preview-image"></div>
            </div>
        </div>
    );
};

export default Consolelogin;