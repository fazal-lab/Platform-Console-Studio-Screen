import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Save, ArrowLeft, Info, Building2, Users, Plug,
    FileText, Upload, X, CheckCircle, AlertCircle
} from 'lucide-react';
import api from '../utils/api';

// ─── Tab configuration ───
const TABS = [
    { id: 'basic', label: 'Basic Info', icon: Building2, tooltip: 'Legal name, display name, company type, status, and contract dates. This identifies the partner entity in the system.' },
    { id: 'integration', label: 'Integration', icon: Plug, tooltip: 'API keys, webhook configuration, and proof of play mode. Powers the Partner → Screen → Proof → Console → Payment flow.' },
    { id: 'documents', label: 'Documents', icon: FileText, tooltip: 'Upload compliance documents — agreement copy, GST cert, bank proof, and insurance.' },
    { id: 'contacts', label: 'Contacts', icon: Users, tooltip: 'Primary contact details for handling screen issues, proof failures, payment disputes, and API failures.' },
];

// ─── Initial formData ───
const INITIAL_FORM = {
    // Section 1 — Basic
    name: '', display_name: '', company_type: 'partner', status: 'onboarding',
    date_joined: '', contract_start_date: '', contract_end_date: '',
    // Section 2 — Integration
    api_key: '', api_secret: '', api_version: '', api_access_mode: '',
    base_api_url: '', webhook_url: '', webhook_secret: '', proof_of_play_mode: '',
    // Section 3 — Contacts
    primary_contact_name: '', primary_contact_email: '', primary_contact_phone: '',
};

// ─── Reusable Components ───
const SectionHeader = ({ title, tooltip }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <div className="group relative cursor-help">
            <Info size={14} className="text-slate-400" />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-800 text-white text-[11px] rounded-none shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800" />
            </div>
        </div>
    </div>
);

const Field = ({ label, children, required, span = 1 }) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
        <label className="block text-xs font-bold text-slate-600 mb-1.5">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {children}
    </div>
);

const Input = ({ value, onChange, placeholder, type = 'text', readOnly = false, ...props }) => (
    <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full px-3 py-2.5 rounded-none border border-slate-200 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors ${readOnly ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-800'}`}
        {...props}
    />
);

const Select = ({ value, onChange, options, placeholder }) => (
    <select
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2.5 rounded-none border border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-blue-500 cursor-pointer transition-colors text-slate-800"
    >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
        ))}
    </select>
);

const FileUpload = ({ label, file, existingUrl, onUpload, onRemove }) => (
    <div className="border border-dashed border-slate-200 rounded-none p-4 bg-slate-50/50">
        <p className="text-xs font-bold text-slate-600 mb-2">{label}</p>
        {file || existingUrl ? (
            <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-xs text-slate-600 font-medium truncate flex-1">
                    {file ? file.name : 'File uploaded'}
                </span>
                <button onClick={onRemove} className="p-1 hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors cursor-pointer">
                    <X size={14} />
                </button>
            </div>
        ) : (
            <label className="flex items-center gap-2 cursor-pointer text-blue-600 hover:text-blue-700 transition-colors">
                <Upload size={14} />
                <span className="text-xs font-bold">Choose file</span>
                <input type="file" className="hidden" onChange={onUpload} />
            </label>
        )}
    </div>
);


// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
const AddPartnerPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = !!id;

    const [activeTab, setActiveTab] = useState('basic');
    const [formData, setFormData] = useState({ ...INITIAL_FORM });
    const [files, setFiles] = useState({
        agreement_copy: null, gst_certificate: null,
        bank_proof: null, insurance_document: null,
    });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);

    // ─── Load partner data when editing ───
    useEffect(() => {
        if (isEdit) {
            api.get(`companies/${id}/`).then(res => {
                const d = res.data;
                const mapped = {};
                Object.keys(INITIAL_FORM).forEach(key => {
                    if (typeof INITIAL_FORM[key] === 'boolean') {
                        mapped[key] = d[key] ?? INITIAL_FORM[key];
                    } else {
                        mapped[key] = d[key] ?? '';
                    }
                });
                setFormData(mapped);
            }).catch(err => {
                console.error('Error loading partner:', err);
                setToast({ type: 'error', message: 'Failed to load partner data' });
            });
        }
    }, [id]);

    const set = (key, val) => setFormData(prev => ({ ...prev, [key]: val }));

    const handleFileChange = (key, e) => {
        const file = e.target.files[0];
        if (file) setFiles(prev => ({ ...prev, [key]: file }));
    };

    const handleFileRemove = (key) => setFiles(prev => ({ ...prev, [key]: null }));

    // ─── Save ───
    const handleSave = async () => {
        if (!formData.name.trim()) {
            setToast({ type: 'error', message: 'Partner Legal Name is required' });
            setActiveTab('basic');
            return;
        }

        setSaving(true);
        try {
            const payload = new FormData();

            // Append all non-empty fields
            Object.entries(formData).forEach(([key, val]) => {
                if (val !== '' && val !== null && val !== undefined) {
                    payload.append(key, val);
                }
            });

            // Append files
            Object.entries(files).forEach(([key, file]) => {
                if (file) payload.append(key, file);
            });

            if (isEdit) {
                await api.patch(`companies/${id}/`, payload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                await api.post('companies/', payload, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }

            setToast({ type: 'success', message: `Partner ${isEdit ? 'updated' : 'created'} successfully` });
            setTimeout(() => navigate('/console/partner-records'), 1200);
        } catch (err) {
            console.error('Save error:', err);
            const msg = err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : 'Failed to save';
            setToast({ type: 'error', message: msg });
        } finally {
            setSaving(false);
        }
    };

    // ─── Render Tab Content ───
    const renderTab = () => {
        switch (activeTab) {
            case 'basic': return (
                <div className="space-y-6">
                    <SectionHeader title="Basic Partner Information" tooltip={TABS[0].tooltip} />
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Partner Legal Name" required>
                            <Input value={formData.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Acme Media Private Limited" />
                        </Field>
                        <Field label="Partner Display Name">
                            <Input value={formData.display_name} onChange={e => set('display_name', e.target.value)} placeholder="e.g. Acme Media" />
                        </Field>
                        <Field label="Company Type" required>
                            <Select value={formData.company_type} onChange={e => set('company_type', e.target.value)} options={[
                                { value: 'partner', label: 'Partner' },
                                { value: 'dooh_network', label: 'DOOH Network' },
                                { value: 'franchise', label: 'Franchise' },
                                { value: 'agency', label: 'Agency' },
                                { value: 'internal', label: 'Internal' },
                                { value: 'advertiser', label: 'Advertiser' },
                            ]} />
                        </Field>
                        <Field label="Status">
                            <Select value={formData.status} onChange={e => set('status', e.target.value)} options={[
                                { value: 'onboarding', label: 'Onboarding' },
                                { value: 'active', label: 'Active' },
                                { value: 'suspended', label: 'Suspended' },
                                { value: 'blocked', label: 'Blocked' },
                            ]} />
                        </Field>
                        <Field label="Date Joined">
                            <Input type="date" value={formData.date_joined} onChange={e => set('date_joined', e.target.value)} />
                        </Field>
                        <Field label="Contract Start Date">
                            <Input type="date" value={formData.contract_start_date} onChange={e => set('contract_start_date', e.target.value)} />
                        </Field>
                        <Field label="Contract End Date">
                            <Input type="date" value={formData.contract_end_date} onChange={e => set('contract_end_date', e.target.value)} />
                        </Field>
                    </div>
                </div>
            );

            case 'integration': return (
                <div className="space-y-6">
                    <SectionHeader title="API Configuration" tooltip={TABS[1].tooltip} />
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="API Key">
                            <Input value={formData.api_key} onChange={e => set('api_key', e.target.value)} placeholder="Auto-generated or paste key" />
                        </Field>
                        <Field label="API Secret">
                            <Input value={formData.api_secret} onChange={e => set('api_secret', e.target.value)} placeholder="Secret key" />
                        </Field>
                        <Field label="API Version">
                            <Input value={formData.api_version} onChange={e => set('api_version', e.target.value)} placeholder="v1" />
                        </Field>
                        <Field label="API Access Mode">
                            <Select value={formData.api_access_mode} onChange={e => set('api_access_mode', e.target.value)} placeholder="Select mode" options={[
                                { value: 'push', label: 'Push' },
                                { value: 'pull', label: 'Pull' },
                            ]} />
                        </Field>
                        <Field label="Base API URL" span={2}>
                            <Input value={formData.base_api_url} onChange={e => set('base_api_url', e.target.value)} placeholder="https://api.partner.com/v1" />
                        </Field>
                    </div>

                    <SectionHeader title="Webhook & Proof of Play" tooltip="Webhook receives real-time events. Proof of Play mode determines how playback data flows into the Console." />
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Webhook URL" span={2}>
                            <Input value={formData.webhook_url} onChange={e => set('webhook_url', e.target.value)} placeholder="https://api.partner.com/webhook" />
                        </Field>
                        <Field label="Webhook Secret">
                            <Input value={formData.webhook_secret} onChange={e => set('webhook_secret', e.target.value)} placeholder="Secret for signature verification" />
                        </Field>
                        <Field label="Proof of Play Mode">
                            <Select value={formData.proof_of_play_mode} onChange={e => set('proof_of_play_mode', e.target.value)} placeholder="Select mode" options={[
                                { value: 'realtime', label: 'Real-time' },
                                { value: 'batch', label: 'Batch' },
                                { value: 'manual_upload', label: 'Manual Upload' },
                            ]} />
                        </Field>
                    </div>
                </div>
            );

            case 'documents': return (
                <div className="space-y-6">
                    <SectionHeader title="Compliance & Document Upload" tooltip={TABS[2].tooltip} />
                    <div className="grid grid-cols-2 gap-4">
                        <FileUpload label="Agreement Copy" file={files.agreement_copy}
                            onUpload={e => handleFileChange('agreement_copy', e)}
                            onRemove={() => handleFileRemove('agreement_copy')} />
                        <FileUpload label="GST Certificate" file={files.gst_certificate}
                            onUpload={e => handleFileChange('gst_certificate', e)}
                            onRemove={() => handleFileRemove('gst_certificate')} />
                        <FileUpload label="Bank Proof" file={files.bank_proof}
                            onUpload={e => handleFileChange('bank_proof', e)}
                            onRemove={() => handleFileRemove('bank_proof')} />
                        <FileUpload label="Insurance (if needed)" file={files.insurance_document}
                            onUpload={e => handleFileChange('insurance_document', e)}
                            onRemove={() => handleFileRemove('insurance_document')} />
                    </div>
                </div>
            );

            case 'contacts': return (
                <div className="space-y-6">
                    <SectionHeader title="Primary Contact Details" tooltip={TABS[3].tooltip} />
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Primary Contact Name">
                            <Input value={formData.primary_contact_name} onChange={e => set('primary_contact_name', e.target.value)} placeholder="Full name" />
                        </Field>
                        <Field label="Primary Contact Email">
                            <Input type="email" value={formData.primary_contact_email} onChange={e => set('primary_contact_email', e.target.value)} placeholder="admin@partner.com" />
                        </Field>
                        <Field label="Primary Contact Phone">
                            <Input
                                value={formData.primary_contact_phone}
                                onChange={e => {
                                    const sanitized = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    set('primary_contact_phone', sanitized);
                                }}
                                placeholder="9876543210"
                            />
                        </Field>
                    </div>
                </div>
            );

            default: return null;
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-8">
            {/* ─── Toast ─── */}
            {toast && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 shadow-lg text-sm font-bold ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
                >
                    {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    <span>{toast.message}</span>
                    <button onClick={() => setToast(null)} className="ml-2 cursor-pointer opacity-70 hover:opacity-100">
                        <X size={14} />
                    </button>
                </motion.div>
            )}

            {/* ─── Header ─── */}
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/console/partner-records')}
                        className="p-2 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200">
                        <ArrowLeft size={18} className="text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">
                            {isEdit ? 'Edit Partner' : 'Add New Partner'}
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {isEdit ? `Editing partner record` : 'Create a new partner business entity master record'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save Partner'}
                </button>
            </header>

            {/* ─── Tab Bar ─── */}
            <div className="flex border-b border-slate-200 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-b-2 ${isActive
                                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ─── Tab Content ─── */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className="bg-white border border-slate-100 p-6 shadow-sm"
            >
                {renderTab()}
            </motion.div>

            {/* ─── Bottom Save Bar ─── */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button onClick={() => navigate('/console/partner-records')}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                    Cancel
                </button>
                <div className="flex items-center gap-3">
                    {TABS.findIndex(t => t.id === activeTab) < TABS.length - 1 && (
                        <button
                            onClick={() => {
                                const idx = TABS.findIndex(t => t.id === activeTab);
                                if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].id);
                            }}
                            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors cursor-pointer"
                        >
                            Next Tab →
                        </button>
                    )}
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50">
                        <Save size={16} />
                        {saving ? 'Saving...' : 'Save Partner'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default AddPartnerPage;
