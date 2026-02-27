import React from 'react';
import '../../styles/alertModal.css';

const AlertModal = ({ isOpen, onClose, title, message, type = 'error' }) => {
    if (!isOpen) return null;

    return (
        <div className="alert-modal-overlay">
            <div className="alert-modal-card">
                <div className="alert-modal-icon-container">
                    {type === 'error' ? (
                        <div className="alert-icon-bg-error">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                        </div>
                    ) : type === 'warning' ? (
                        <div className="alert-icon-bg-warning">
                            <i className="bi bi-info-circle-fill"></i>
                        </div>
                    ) : (
                        <div className="alert-icon-bg-success">
                            <i className="bi bi-check-circle-fill"></i>
                        </div>
                    )}
                </div>
                <h3 className="alert-modal-title">{title}</h3>
                <p className="alert-modal-message">{message}</p>
                <button className="alert-modal-btn" onClick={onClose}>
                    OK
                </button>
            </div>
        </div>
    );
};

export default AlertModal;
