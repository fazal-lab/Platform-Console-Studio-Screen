import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useXiaContext, XIA_DISABLED_PAGES } from '../context/XiaContext';
import '../styles/xia-assistant.css';

const XIA_OPEN_URL = '/xia/chat-open/';
const XIA_CHAT_URL = '/xia/chat/';

// Page-aware welcome messages
const PAGE_WELCOME = {
    dashboard: { title: 'Dashboard Guide', desc: "I can explain your dashboard metrics, help you understand your campaigns, or guide you to create a new one." },
    campaigns: { title: 'Campaign Manager', desc: "I can help you find campaigns, explain their statuses, or guide you through creating a new one." },
    campaign_detail: { title: 'Campaign Insights', desc: "Ask me about this campaign's performance, budget pacing, timeline, or anything you see on screen." },
    campaign_monitor: { title: 'Live Monitor', desc: "I can explain playback signals, flag issues, and help you interpret live monitoring data." },
    campaign_report: { title: 'Report Analysis', desc: "Ask me about any metric, ROI breakdown, or how to improve your campaign performance." },
    campaign_bundle: { title: 'Bundle Review', desc: "I can explain your screen selection, slot allocation, and help you finalize your campaign bundle." },
    screen_bundle: { title: 'Screen Explorer', desc: "I can compare screens, explain pricing, and help you pick the best options for your campaign." },
    screen_spec_review: { title: 'Spec Review', desc: "I can explain screen specifications, creative requirements, and help you confirm your selections." },
    proposal_review: { title: 'Proposal Guide', desc: "I can walk you through this proposal, explain costs, and help you make decisions." },
    creative_builder: { title: 'Creative Assistant', desc: "I can guide you through creative specs, format requirements, and help build your manifest." },
    default: { title: 'XIA Assistant', desc: "I'll help you plan your campaign — tell me where, when, and how much, and I'll handle the rest." },
};

const GatewayProgress = ({ status }) => {
    if (!status) return null;
    const fields = [
        { key: 'location', label: 'Location', icon: 'bi-geo-alt-fill' },
        { key: 'start_date', label: 'Start Date', icon: 'bi-calendar-event' },
        { key: 'end_date', label: 'End Date', icon: 'bi-calendar-check' },
        { key: 'budget_range', label: 'Budget', icon: 'bi-currency-rupee' },
    ];
    const collected = fields.filter(f => status[f.key]?.collected).length;

    return (
        <div className="xia-gateway-progress">
            <div className="xia-gateway-header">
                <span className="xia-gateway-label">Campaign Setup</span>
                <span className="xia-gateway-count">{collected}/4</span>
            </div>
            <div className="xia-gateway-bar-bg">
                <div className="xia-gateway-bar-fill" style={{ width: `${(collected / 4) * 100}%` }} />
            </div>
            <div className="xia-gateway-fields">
                {fields.map(f => {
                    const field = status[f.key];
                    const done = field?.collected;
                    return (
                        <div key={f.key} className={`xia-gateway-field ${done ? 'done' : ''}`}>
                            <i className={`bi ${done ? 'bi-check-circle-fill' : f.icon}`}></i>
                            <span>{done && field.value ? (Array.isArray(field.value) ? field.value.join(', ') : field.value) : f.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const XiaAssistant = ({ onClose, title, message, chips = [], initialSessionId = null }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { pageContext } = useXiaContext();
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState([]);
    const [sessionId, setSessionId] = useState(initialSessionId || null);
    const [gatewayStatus, setGatewayStatus] = useState(null);
    const [gatewayComplete, setGatewayComplete] = useState(!!initialSessionId);
    const [loading, setLoading] = useState(false);
    const [started, setStarted] = useState(!!initialSessionId);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // ─── Live Mode ───
    const [liveMode, setLiveMode] = useState(false);
    const liveInitSent = useRef(false);

    // Determine page key from context or URL
    const pageKey = pageContext?.page || 'default';
    const welcome = PAGE_WELCOME[pageKey] || PAGE_WELCOME.default;
    const displayTitle = title || (liveMode ? welcome.title : 'XIA Assistant');
    const welcomeDesc = message || welcome.desc;

    const userId = localStorage.getItem('userId') || localStorage.getItem('userName') || 'guest';
    const [campaignId] = useState(() => {
        const existing = localStorage.getItem('current_campaign_id');
        if (existing) return existing;
        const temp = `TEMP-${userId}-${Math.floor(Date.now() / 1000)}`;
        return temp;
    });

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, loading]);

    useEffect(() => {
        if (inputRef.current && started) {
            inputRef.current.focus();
        }
    }, [started]);

    const addMessage = (role, text, quickReplies = [], redirect = null) => {
        setMessages(prev => [...prev, { role, text, quickReplies, redirect, id: Date.now() + Math.random() }]);
    };

    const sendMessage = async (text) => {
        if (!text.trim() || loading) return;
        const userText = text.trim();
        setInputValue('');
        // Don't show [LIVE_MODE_INIT] as a visible message
        if (userText !== '[LIVE_MODE_INIT]') {
            addMessage('user', userText);
        }
        setLoading(true);

        try {
            // In Live mode, always use the open endpoint and skip gateway logic
            const isOpen = liveMode ? true : !gatewayComplete;
            const url = isOpen ? XIA_OPEN_URL : XIA_CHAT_URL;

            const body = {};
            if (sessionId) {
                body.session_id = sessionId;
            } else {
                body.campaign_id = campaignId;
            }
            body.user_id = String(userId);
            body.message = userText;
            body.mode = liveMode ? 'live' : 'normal';

            // Attach live page context so XIA knows what the user is looking at
            if (pageContext) {
                body.page_context = pageContext;
            }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                addMessage('xia', `Sorry, something went wrong: ${err.error || res.statusText}`);
                setLoading(false);
                return;
            }

            const data = await res.json();

            if (!sessionId && data.session_id) {
                setSessionId(data.session_id);
            }

            if (data.gateway_status) {
                setGatewayStatus(data.gateway_status);
            }

            addMessage('xia', data.reply || data.message || '...', data.quick_replies || [], data.redirect || null);

            if (data.gateway_complete === true && !gatewayComplete) {
                setGatewayComplete(true);
                const finalSessionId = data.session_id || sessionId;
                const gw = data.gateway_status || {};

                // Pre-fill CreateCampaign draft so it boots into gateway-submitted state
                const draft = {
                    xiaSessionId: finalSessionId,
                    isGatewaySubmitted: true,
                    datesConfirmed: true,
                    startDate: gw.start_date?.value || '',
                    endDate: gw.end_date?.value || '',
                    selectedCity: gw.location?.value || [],
                    campaignBudget: gw.budget_range?.value ? String(gw.budget_range.value) : '',
                    guidedMode: 'xia',
                    selectedLocations: [],
                    slotCount: {},
                };
                localStorage.setItem('xigi_campaign_draft', JSON.stringify(draft));

                setTimeout(() => {
                    onClose?.();
                    navigate('/create-campaign');
                }, 1800);
            }
        } catch (err) {
            addMessage('xia', 'Connection error. Please try again.');
        }
        setLoading(false);
    };

    const handleSend = () => {
        if (inputValue.trim()) sendMessage(inputValue);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleQuickReply = (text) => {
        sendMessage(text);
    };

    const handleStart = (startInLive = false) => {
        setStarted(true);
        setMessages([]);
        setSessionId(null);
        setGatewayStatus(null);
        setGatewayComplete(false);
        setLiveMode(startInLive);
        liveInitSent.current = false;
    };

    // Switch between Chat and Live tabs
    const switchMode = (toLive) => {
        setLiveMode(toLive);
        setMessages([]);
        setSessionId(null);
        setGatewayStatus(null);
        setGatewayComplete(false);
        liveInitSent.current = false;
    };

    // Auto-send init message when Live mode activates
    useEffect(() => {
        if (liveMode && started && !liveInitSent.current && !loading) {
            liveInitSent.current = true;
            sendMessage('[LIVE_MODE_INIT]');
        }
    }, [liveMode, started]);

    // Handle XIA redirect
    const handleRedirect = (path) => {
        onClose?.();
        navigate(path);
    };

    return (
        <div className="xia-assistant-sidebar">
            {/* Header */}
            <div className="xia-header">
                <div className="xia-title-group">
                    <div className="xia-icon-box">
                        <i className="bi bi-stars"></i>
                    </div>
                    <div>
                        <h3 className="xia-title">{displayTitle}</h3>
                        {gatewayComplete && (
                            <span className="xia-status-badge">Campaign Ready ✓</span>
                        )}
                    </div>
                </div>
                <div className="xia-header-actions">
                    {started && (
                        <i className="bi bi-arrow-counterclockwise xia-action-icon" title="Restart" onClick={handleStart}></i>
                    )}
                    <i className="bi bi-x-lg xia-action-icon" onClick={onClose} title="Close"></i>
                </div>
            </div>

            {/* Mode Tabs — shown when chat is started */}
            {started && (
                <div className="xia-mode-tabs">
                    <button
                        className={`xia-mode-tab ${!liveMode ? 'active' : ''}`}
                        onClick={() => switchMode(false)}
                    >
                        <i className="bi bi-chat-dots"></i> Chat
                    </button>
                    <button
                        className={`xia-mode-tab xia-mode-live ${liveMode ? 'active' : ''}`}
                        onClick={() => switchMode(true)}
                    >
                        <i className="bi bi-broadcast"></i> Live
                        {liveMode && <span className="xia-live-dot"></span>}
                    </button>
                </div>
            )}

            {/* Gateway Progress — only in Chat mode */}
            {started && !liveMode && gatewayStatus && !gatewayComplete && (
                <GatewayProgress status={gatewayStatus} />
            )}

            {/* Body */}
            <div className="xia-body">
                {!started ? (
                    /* Welcome state */
                    <div className="xia-welcome">
                        <div className="xia-welcome-icon">
                            <i className="bi bi-stars"></i>
                        </div>
                        <h4 className="xia-welcome-title">Hey, I'm XIA</h4>
                        <p className="xia-welcome-desc">
                            {welcomeDesc}
                        </p>
                        {chips.length > 0 && (
                            <div className="xia-welcome-chips">
                                {chips.map((c) => (
                                    <button key={c} type="button" className="xia-chip-btn" onClick={() => { handleStart(false); }}>{c}</button>
                                ))}
                            </div>
                        )}
                        <div className="xia-welcome-actions">
                            <button className="xia-start-btn" onClick={() => handleStart(false)}>
                                <i className="bi bi-chat-dots-fill"></i>
                                Start Chat
                            </button>
                            <button className="xia-live-btn" onClick={() => handleStart(true)}>
                                <i className="bi bi-broadcast"></i>
                                Go Live
                                <span className="xia-live-pulse"></span>
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Chat messages */
                    <div className="xia-chat-messages">
                        {messages.length === 0 && !loading && !liveMode && (
                            <div className="xia-chat-intro">
                                <div className="xia-bot-bubble">
                                    <div className="xia-bot-avatar"><i className="bi bi-stars"></i></div>
                                    <div className="xia-bubble xia-bubble-bot">
                                        Hi! I'm XIA 👋 Tell me about the campaign you want to run — where, when, and your budget, and I'll set everything up for you.
                                    </div>
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div key={msg.id}>
                                {msg.role === 'user' ? (
                                    <div className="xia-user-bubble">
                                        <div className="xia-bubble xia-bubble-user">{msg.text}</div>
                                    </div>
                                ) : (
                                    <div className="xia-bot-bubble">
                                        <div className="xia-bot-avatar"><i className="bi bi-stars"></i></div>
                                        <div>
                                            <div className="xia-bubble xia-bubble-bot">{msg.text}</div>
                                            {msg.quickReplies?.length > 0 && (
                                                <div className="xia-quick-replies">
                                                    {msg.quickReplies.map((qr) => (
                                                        <button key={qr} className="xia-qr-btn" onClick={() => handleQuickReply(qr)}>
                                                            {qr}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {msg.redirect && (
                                                <button
                                                    className="xia-redirect-btn"
                                                    onClick={() => handleRedirect(msg.redirect.path)}
                                                >
                                                    <i className="bi bi-box-arrow-up-right"></i>
                                                    {msg.redirect.label || 'Go there'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="xia-bot-bubble">
                                <div className="xia-bot-avatar"><i className="bi bi-stars"></i></div>
                                <div className="xia-bubble xia-bubble-bot xia-typing">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}

                        {gatewayComplete && (
                            <div className="xia-redirect-notice">
                                <i className="bi bi-check-circle-fill"></i>
                                All details collected! Taking you to Campaign Builder...
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Footer input — only while started */}
            {
                started && (
                    <div className="xia-footer">
                        <div className="xia-input-container">
                            <input
                                ref={inputRef}
                                type="text"
                                className="xia-input"
                                placeholder={liveMode ? 'Ask about this page...' : (gatewayComplete ? 'Campaign ready!' : 'Type a message...')}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading || (!liveMode && gatewayComplete)}
                            />
                            <button
                                className="xia-send-btn"
                                onClick={handleSend}
                                disabled={loading || !inputValue.trim() || gatewayComplete}
                            >
                                <i className={`bi ${loading ? 'bi-hourglass-split' : 'bi-send-fill'}`}></i>
                            </button>
                        </div>
                        <div className="xia-footer-hint">Powered by XIA · XIGI Platform</div>
                    </div>
                )
            }
        </div >
    );
};

export default XiaAssistant;
