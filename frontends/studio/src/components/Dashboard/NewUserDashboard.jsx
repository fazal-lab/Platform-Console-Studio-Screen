import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/dashboard-new-user.css';

const NewUserDashboard = ({ userName, onExploreClick }) => {
    return (
        <div className="new-user-dashboard">
            {/* Header Section */}
            <div className="nu-welcome-section">
                <h1 className="nu-welcome-title">Welcome back, {userName}.</h1>
                <div className="nu-welcome-subtitle">
                    Dashboard Intelligence
                </div>
            </div>

            {/* Hero Card */}
            <div className="nu-hero-card">
                <div className="nu-hero-content">
                    <div className="nu-hero-icon-box">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h2 className="nu-hero-title">Launch your first DOOH campaign</h2>
                    <p className="nu-hero-desc">
                        Discover available screens on an interactive map, view real-time availability, get AI-powered recommendations from XIA, and launch campaigns in minutes.
                    </p>
                    <Link
                        to="/create-campaign"
                        className="nu-create-btn"
                        onClick={() => localStorage.removeItem('xigi_campaign_draft')}
                    >
                        Start Your First Campaign
                    </Link>
                </div>

                <div className="nu-ai-card">
                    <div>
                        <p className="nu-ai-text">
                            "XIA recommends this screen for your campaign based on transit area profile and high dwell time."
                        </p>
                    </div>
                    <div className="nu-ai-footer">
                        <div className="nu-ai-icon">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span className="nu-ai-label">XIA Assistant</span>
                    </div>
                </div>
            </div>


            {/* Bottom Grid */}
            <div className="nu-bottom-grid">
                <div className="nu-info-card">
                    <h3 className="nu-info-title">Get AI-powered recommendations</h3>
                    <p className="nu-info-desc">
                        XIA analyzes each screen's location profile, audience behavior, and availability to suggest the best matches for your campaign goals.
                    </p>
                    <a
                        href="#"
                        className="nu-link-action"
                        onClick={(e) => {
                            e.preventDefault();
                            onExploreClick();
                        }}
                    >
                        Ask XIA for help →
                    </a>
                </div>

                <div className="nu-info-card">
                    <h3 className="nu-info-title">Here's what you can do right away:</h3>

                    <div className="nu-action-item">
                        <div className="nu-action-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                        </div>
                        <div className="nu-action-content">
                            <h4>Interactive Screen Discovery</h4>
                            <p>Search locations on the map, drop pins to discover nearby screens, and view detailed specs including images, availability, and pricing.</p>
                        </div>
                    </div>

                    <div className="nu-action-item">
                        <div className="nu-action-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                        </div>
                        <div className="nu-action-content">
                            <h4>Real-time Availability Info</h4>
                            <p>See which screens are available for your dates, view next availability for booked screens, and browse screen images in a carousel.</p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default NewUserDashboard;
