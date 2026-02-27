import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserCircle, Filter, MoreVertical, Shield, CheckCircle, XCircle, AlertCircle, Edit, Eye, Trash2, Lock, Unlock, Briefcase, Users, Key, Settings, X, Save, ToggleLeft, ToggleRight, ChevronRight, Plus, Building, Globe, UserPlus, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../utils/api';





const INITIAL_ROLES = [
    {
        title: "Admin",
        type: "System",
        users: 1,
        desc: "Full system access including user management and system settings.",
        permissions: ["Screens", "Campaigns", "Insights", "Logs", "Settings", "Users"],
        color: "bg-purple-100 text-purple-700 border-purple-200"
    },
    {
        title: "Operations",
        type: "System",
        users: 1,
        desc: "Can manage screens, validate creatives, and assist campaigns.",
        permissions: ["Screens", "Validation", "Campaign Assist"],
        color: "bg-blue-100 text-blue-700 border-blue-200"
    },
    {
        title: "Partner",
        type: "External",
        users: 1,
        desc: "Access restricted to owned screens and campaigns only.",
        permissions: ["Partner CMS", "Content Push", "Screen Health"],
        color: "bg-orange-100 text-orange-700 border-orange-200"
    },
    {
        title: "Franchise Support",
        type: "System",
        users: 1,
        desc: "Support for franchise partners and operational tasks.",
        permissions: ["Franchise View", "Support Tickets", "Basic Operations"],
        color: "bg-green-100 text-green-700 border-green-200"
    }
];

const ALL_PERMISSIONS = [
    'Screens', 'Campaigns', 'Insights', 'Logs', 'Settings', 'Users',
    'Validation', 'Campaign Assist', 'Partner CMS', 'Content Push',
    'Screen Health', 'Franchise View', 'Support Tickets', 'Basic Operations'
];

const UsersRolesPage = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState(INITIAL_ROLES);
    const [partners, setPartners] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch users and partners on mount
    useEffect(() => {
        fetchPartners();
        fetchUsers();
    }, []);

    const fetchPartners = async () => {
        try {
            console.log("Fetching partners...");
            const response = await api.get('companies/');
            console.log("Partners response:", response.data);
            // Include all types for now, as users might belong to any company
            setPartners(response.data);
        } catch (err) {
            console.error('Failed to fetch partners', err);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get('users/');
            // Map backend data to frontend structure if necessary
            const mappedUsers = response.data.map(u => ({
                id: u.id,
                name: u.username || u.email.split('@')[0],
                email: u.email,
                role: u.role === 'admin' ? 'Admin' : u.role === 'ops' ? 'Operations' : 'Partner',
                roleKey: u.role,
                companyId: u.company,
                partner: u.company_name || (u.role === 'partner' ? 'Unassigned' : '-'),
                status: 'Active',
                lastLogin: 'Today, 10:12 AM',
                phone: u.phone || '-',
                organization: u.company_name || (u.role === 'partner' ? 'Partner Entity' : 'XIGI Systems'),
                systemScope: u.role === 'admin' ? 'All Modules' : 'Operations Module'
            }));
            setUsers(mappedUsers);
        } catch (err) {
            setError('Failed to fetch users');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [updateForm, setUpdateForm] = useState({
        username: '',
        email: '',
        phone: '',
        role: '',
        company: ''
    });

    const [editingRole, setEditingRole] = useState(false);
    const [roleEditData, setRoleEditData] = useState(null);
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);

    const [newUserForm, setNewUserForm] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: '',
        partner: '', // unified to 'partner'
        organization: '',
        systemScope: ''
    });

    // Permissions state
    const [permissions, setPermissions] = useState(() => {
        const initial = {};
        ALL_PERMISSIONS.forEach(p => initial[p] = false);
        return initial;
    });

    // Sync permissions when selected user or role changes
    useEffect(() => {
        if (selectedUser) {
            const roleData = roles.find(r => r.title === selectedUser.role);
            const rolePerms = {};
            ALL_PERMISSIONS.forEach(perm => {
                rolePerms[perm] = roleData ? roleData.permissions.includes(perm) : false;
            });
            setPermissions(rolePerms);
        }
    }, [selectedUser, roles]);

    const togglePermission = (permName) => {
        setPermissions(prev => ({
            ...prev,
            [permName]: !prev[permName]
        }));
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesRole = filterRole ? u.role === filterRole : true;
            const matchesStatus = filterStatus ? u.status === filterStatus : true;
            return matchesSearch && matchesRole && matchesStatus;
        });
    }, [users, searchTerm, filterRole, filterStatus]);

    const getStatusStyles = (status) => {
        switch (status) {
            case 'Active': return 'bg-green-100 text-green-700 border-green-200';
            case 'Inactive': return 'bg-slate-100 text-slate-500 border-slate-200';
            case 'Suspended': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const handleEditRole = (user) => {
        const roleData = roles.find(r => r.title === user.role);
        setRoleEditData({
            roleName: user.role,
            roleType: user.role === 'Partner' ? 'External' : 'System',
            rolePermissions: roleData ? roleData.permissions : []
        });

        // Set permissions state based on ALL_PERMISSIONS
        const rolePerms = {};
        ALL_PERMISSIONS.forEach(perm => {
            rolePerms[perm] = roleData ? roleData.permissions.includes(perm) : false;
        });
        setPermissions(rolePerms);

        setEditingRole(true);
    };

    const handleNewUserInputChange = (field, value) => {
        if (field === 'phone') {
            // Remove non-numeric characters and limit to 10 digits
            const sanitizedValue = value.replace(/\D/g, '').slice(0, 10);
            setNewUserForm(prev => ({
                ...prev,
                [field]: sanitizedValue
            }));
            return;
        }
        setNewUserForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const resetNewUserForm = () => {
        setNewUserForm({
            name: '',
            email: '',
            phone: '',
            password: '',
            role: '',
            partner: '',
            organization: '',
            systemScope: ''
        });
    };

    // Role selection change handler
    useEffect(() => {
        if (newUserForm.role) {
            // Set default organization based on role
            if (['Admin', 'Operations', 'Franchise Support'].includes(newUserForm.role)) {
                handleNewUserInputChange('organization', 'XIGI Systems');

                // Set default system scope based on role
                if (newUserForm.role === 'Admin') {
                    handleNewUserInputChange('systemScope', 'All Modules');
                } else if (newUserForm.role === 'Operations') {
                    handleNewUserInputChange('systemScope', 'Operations Module');
                } else if (newUserForm.role === 'Franchise Support') {
                    handleNewUserInputChange('systemScope', 'Franchise Module');
                }
            } else if (newUserForm.role === 'Partner') {
                handleNewUserInputChange('organization', '');
                handleNewUserInputChange('systemScope', 'Partner CMS Only');
            }
        }
    }, [newUserForm.role]);

    const clearFilters = () => {
        setSearchTerm('');
        setFilterRole('');
        setFilterStatus('');
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Xigi System Users & Roles', 14, 20);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

        const tableData = filteredUsers.map(u => [
            u.name,
            u.email,
            u.role,
            u.organization,
            u.status,
            u.lastLogin
        ]);

        autoTable(doc, {
            startY: 35,
            head: [['Name', 'Email', 'Role', 'Organization', 'Status', 'Last Login']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [37, 99, 235] },
            styles: { fontSize: 8 },
        });

        doc.save(`xigi-users-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const systemRoles = ['Admin', 'Operations', 'Franchise Support'];
    const isSystemRole = systemRoles.includes(newUserForm.role);
    const isPartnerRole = newUserForm.role === 'Partner';

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8"
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                        Users & Roles
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">Manage system users, roles, and access permissions.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportPDF}
                        className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-none text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                    >
                        <Download size={14} />
                        Export PDF
                    </button>
                    <button
                        onClick={() => setIsAddUserOpen(true)}
                        className="bg-blue-600 text-white px-3 py-2 rounded-none text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer"
                    >
                        <UserPlus size={16} />
                        Add User
                    </button>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 text-sm rounded-none border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-slate-700 shadow-sm"
                    />
                </div>

                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="flex-1 lg:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="">All Roles</option>
                        <option value="Admin">Admin</option>
                        <option value="Operations">Operations</option>
                        <option value="Partner">Partner</option>
                        <option value="Franchise Support">Franchise Support</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="flex-1 lg:flex-none px-3 py-2 pr-8 rounded-none border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer text-sm shadow-sm font-bold appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNjQ3NDhiIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iNiA5IDEyIDE1IDE4IDkiPjwvcG9seWxpbmU+PC9zdmc+')] bg-no-repeat bg-[right_0.5rem_center] bg-[length:1rem] transition-all hover:border-slate-300"
                    >
                        <option value="">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                        <option value="Suspended">Suspended</option>
                    </select>

                    {(filterRole || filterStatus || searchTerm) && (
                        <button
                            onClick={clearFilters}
                            className="px-3 py-2 bg-white border border-slate-200 rounded-none text-slate-400 hover:text-red-500 transition-colors shadow-sm cursor-pointer"
                            title="Clear Filters"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center mb-1 px-1 mt-6">
                <h3 className="text-[10px] font-bold text-slate-400 flex items-center gap-2">
                    <Users size={16} /> System Users
                </h3>
                <span className="text-[10px] font-bold text-slate-400">{filteredUsers.length} records</span>
            </div>

            <div className="overflow-x-auto pb-4">
                <table className="w-full text-left border-separate border-spacing-y-0 text-sm">
                    <thead>
                        <tr className="text-slate-400 font-bold text-[10px]">
                            <th className="px-4 py-3">User</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Role</th>
                            <th className="px-4 py-3">Associated partner</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Last login</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white rounded-2xl shadow-sm border border-slate-100">
                        {filteredUsers.map((user, idx) => (
                            <tr
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className="hover:bg-slate-50/50 transition-all group cursor-pointer"
                                style={idx !== filteredUsers.length - 1 ? { borderBottom: '1px solid #d7d7d7' } : {}}
                            >
                                <td className={`px-4 py-2 border-b border-slate-100 font-semibold text-slate-800 flex items-center gap-3 ${idx === 0 ? 'rounded-tl-2xl' : ''} ${idx === filteredUsers.length - 1 ? 'border-0 rounded-bl-2xl' : ''}`}>
                                    <div className="w-8 h-8 rounded-none bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shadow-sm">
                                        {user.name.charAt(0)}
                                    </div>
                                    <span className="font-bold text-slate-800 text-xs">{user.name}</span>
                                </td>
                                <td className="px-4 py-2 border-b border-slate-100 text-slate-600 font-medium text-xs">{user.email}</td>
                                <td className="px-4 py-2 border-b border-slate-100">
                                    <span className={`px-2 py-0.5 rounded-none text-[10px] font-bold border ${user.role === 'Admin' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        user.role === 'Partner' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                            user.role === 'Franchise Support' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                                        }`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-4 py-2 border-b border-slate-100 text-slate-500 text-[10px] font-medium">{user.partner}</td>
                                <td className="px-4 py-2 border-b border-slate-100">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-none text-[10px] font-bold border ${getStatusStyles(user.status)}`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className={`px-4 py-2 border-b border-slate-100 text-slate-500 text-[10px] font-medium`}>{user.lastLogin}</td>
                                <td className={`px-4 py-3 border-b border-slate-100 text-center ${idx === 0 ? 'rounded-tr-2xl' : ''} ${idx === filteredUsers.length - 1 ? 'border-0 rounded-br-2xl' : ''}`}>
                                    <div className="flex items-center justify-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedUser(user);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-none transition-colors cursor-pointer"
                                            title="View Details"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditRole(user);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-none transition-colors cursor-pointer"
                                            title="Edit Role"
                                        >
                                            <Shield size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <motion.div
                variants={itemVariants}
            >
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Shield size={18} className="text-slate-400" />
                    System Roles
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {roles.map((role) => (
                        <motion.div
                            key={role.title}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            viewport={{ once: true }}
                            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between group hover:border-blue-200 transition-all"
                        >
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <span className={`px-3 py-1 rounded-none text-[10px] font-bold border tracking-widest ${role.color}`}>
                                        {role.title.toLowerCase()}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-black">
                                        <Users size={12} />
                                        {role.users} users
                                    </div>
                                </div>
                                <p className="text-sm font-bold text-slate-800 mb-2">{role.title} Role</p>
                                <p className="text-xs text-slate-500 mb-6 leading-relaxed">{role.desc}</p>
                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-slate-400 tracking-widest">Active permissions</p>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {role.permissions.map(p => (
                                            <span key={p} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-bold rounded-none border border-slate-100">
                                                {p.toLowerCase()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setRoleEditData({
                                        roleName: role.title,
                                        roleType: role.type,
                                        rolePermissions: role.permissions
                                    });

                                    // Set permissions state based on ALL_PERMISSIONS
                                    const rolePerms = {};
                                    ALL_PERMISSIONS.forEach(perm => {
                                        rolePerms[perm] = role.permissions.includes(perm);
                                    });
                                    setPermissions(rolePerms);

                                    setEditingRole(true);
                                }}
                                className="mt-8 w-full py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-none text-[10px] tracking-widest hover:bg-slate-50 transition-all cursor-pointer shadow-sm group-hover:border-blue-200"
                            >
                                Configure permissions
                            </button>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            <AnimatePresence>
                {selectedUser && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedUser(null)}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
                            style={{ marginBottom: "0px" }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100 rounded-none"
                            style={{ marginTop: "0px", marginBottom: "0px" }}
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 leading-none">User details</h2>
                                    <p className="text-[10px] font-mono font-bold text-slate-400 mt-2">uuid: {selectedUser.id} • scope: system_admin</p>
                                </div>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {!isEditingUser ? (
                                    <>
                                        <div className="flex flex-row items-center gap-6">
                                            <div className="w-24 h-24 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-black text-4xl shrink-0 border border-slate-200 shadow-sm transition-transform hover:scale-105">
                                                {selectedUser.name.charAt(0)}
                                            </div>
                                            <div className="flex flex-col items-start">
                                                <h3 className="text-2xl font-black text-slate-900 leading-tight">{selectedUser.name}</h3>
                                                <p className="text-slate-500 text-sm font-medium truncate max-w-[200px]">{selectedUser.email}</p>
                                                <span className={`mt-3 px-3 py-1 rounded-none text-[10px] font-black border uppercase tracking-widest ${getStatusStyles(selectedUser.status)}`}>
                                                    {selectedUser.status}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400">Display name</label>
                                            <input
                                                type="text"
                                                value={updateForm.username}
                                                onChange={(e) => setUpdateForm({ ...updateForm, username: e.target.value })}
                                                className="w-full px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400">Email address</label>
                                            <input
                                                type="email"
                                                value={updateForm.email}
                                                onChange={(e) => setUpdateForm({ ...updateForm, email: e.target.value })}
                                                className="w-full px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400">Phone number</label>
                                            <input
                                                type="text"
                                                value={updateForm.phone}
                                                onChange={(e) => {
                                                    const sanitizedValue = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                    setUpdateForm({ ...updateForm, phone: sanitizedValue });
                                                }}
                                                className="w-full px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-bold"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400">System role</label>
                                            <select
                                                value={updateForm.role}
                                                onChange={(e) => setUpdateForm({ ...updateForm, role: e.target.value })}
                                                className="w-full px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-bold bg-white"
                                            >
                                                <option value="admin">Admin</option>
                                                <option value="ops">Operations</option>
                                                <option value="partner">Partner</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-400">Associate partner entity</label>
                                            <select
                                                value={updateForm.company}
                                                onChange={(e) => setUpdateForm({ ...updateForm, company: e.target.value })}
                                                className="w-full px-4 py-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm font-bold bg-white"
                                            >
                                                <option value="">None / unassigned</option>
                                                {partners.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400">Account information</h4>
                                    <div className="bg-slate-50 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">Role</span>
                                            <span className="text-sm font-black text-slate-800 bg-blue-50 px-2 py-0.5 border border-blue-100 rounded-none">{selectedUser.role}</span>
                                        </div>
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">Email</span>
                                            <span className="text-sm font-bold text-slate-800">{selectedUser.email}</span>
                                        </div>
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">Organization</span>
                                            <span className="text-sm font-bold text-slate-800">{selectedUser.organization}</span>
                                        </div>
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">System scope</span>
                                            <span className="text-sm font-bold text-slate-800">{selectedUser.systemScope}</span>
                                        </div>
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">Phone</span>
                                            <span className="text-sm font-bold text-slate-800 font-mono">{selectedUser.phone}</span>
                                        </div>
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">Partner</span>
                                            <span className="text-sm font-bold text-blue-600 underline decoration-blue-200 underline-offset-4">{selectedUser.partner}</span>
                                        </div>
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">Created on</span>
                                            <span className="text-sm font-bold text-slate-800 font-mono">{selectedUser.createdOn}</span>
                                        </div>
                                        <div className="px-5 py-4 flex justify-between items-center group hover:bg-white transition-colors">
                                            <span className="text-[10px] font-black text-slate-400">Last login</span>
                                            <span className="text-sm font-bold text-slate-800 font-mono">{selectedUser.lastLogin}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-xl font-bold text-slate-800 tracking-tight">Permissions summary</h4>
                                    <div className="space-y-4">
                                        {Object.entries(permissions).map(([permName, isEnabled]) => (
                                            <div key={permName} className="flex items-center justify-between text-xs">
                                                <span className="text-slate-500 font-bold tracking-wider">Can {permName}</span>
                                                {isEnabled ? (
                                                    <div className="px-2 py-0.5 rounded-none bg-green-50 text-green-600 flex items-center gap-1.5 border border-green-200 font-black text-[9px]">
                                                        <CheckCircle size={12} className="text-green-600" />
                                                        allowed
                                                    </div>
                                                ) : (
                                                    <div className="px-2 py-0.5 rounded-none bg-red-50 text-red-500 flex items-center gap-1.5 border border-red-200 font-black text-[9px]">
                                                        <XCircle size={12} className="text-red-500" />
                                                        denied
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50  space-y-3">
                                {!isEditingUser ? (
                                    <>
                                        <button
                                            onClick={async () => {
                                                if (!window.confirm(`Are you sure you want to delete user "${selectedUser.name}"? This action cannot be undone.`)) return;
                                                try {
                                                    await api.delete(`users/${selectedUser.id}/`);
                                                    fetchUsers();
                                                    setSelectedUser(null);
                                                } catch (err) {
                                                    alert('Failed to delete user');
                                                }
                                            }}
                                            className="w-full py-3.5 bg-red-50 text-red-700 mb-3 border border-red-200 rounded-none font-black text-[10px] tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                        >
                                            <Trash2 size={16} /> Delete user
                                        </button>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={async () => {
                                                    const newPwd = window.prompt(`Reset password for "${selectedUser.name}"\n\nEnter new password (min. 6 characters):`);
                                                    if (!newPwd) return;
                                                    if (newPwd.trim().length < 6) {
                                                        alert('Password must be at least 6 characters.');
                                                        return;
                                                    }
                                                    try {
                                                        await api.post(`users/${selectedUser.id}/reset-password/`, { new_password: newPwd.trim() });
                                                        alert(`✅ Password reset successfully for ${selectedUser.name}.`);
                                                    } catch (err) {
                                                        alert(err.response?.data?.error || 'Failed to reset password.');
                                                    }
                                                }}
                                                className="flex-1 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-none font-black text-[10px] tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                                                <Key size={16} /> Reset pwd
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setUpdateForm({
                                                        username: selectedUser.name,
                                                        email: selectedUser.email,
                                                        phone: selectedUser.phone === '-' ? '' : selectedUser.phone,
                                                        role: selectedUser.roleKey,
                                                        company: selectedUser.companyId || ''
                                                    });
                                                    setIsEditingUser(true);
                                                }}
                                                className="flex-1 py-3.5 bg-indigo-600 text-white rounded-none font-black text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                Edit profile
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditingUser(false)}
                                            className="flex-1 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-none font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const payload = {
                                                        username: updateForm.username,
                                                        email: updateForm.email,
                                                        phone: updateForm.phone,
                                                        role: updateForm.role,
                                                        company: updateForm.company || null
                                                    };
                                                    await api.patch(`users/${selectedUser.id}/`, payload);
                                                    fetchUsers();
                                                    setIsEditingUser(false);
                                                    setSelectedUser(null);
                                                } catch (err) {
                                                    alert('Failed to update user');
                                                }
                                            }}
                                            className="flex-1 py-3.5 bg-blue-600 text-white rounded-none font-black text-[10px] tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Save size={16} /> Save changes
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editingRole && roleEditData && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setEditingRole(false)}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
                            style={{ marginBottom: "0px" }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
                            style={{ marginTop: "0px", marginBottom: "0px" }}
                        >
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-3xl font-bold text-slate-800">Edit Permissions</h2>
                                    <p className="text-sm font-medium text-slate-400 mt-1">Configuring role: {roleEditData.roleName}</p>
                                </div>
                                <button
                                    onClick={() => setEditingRole(false)}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-slate-400">Role type</span>
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-none">{roleEditData.roleType}</span>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        Modifying permissions here will affect all <strong>{users.filter(u => u.role === roleEditData.roleName).length} users</strong> assigned to this role.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-2xl font-bold text-slate-800 tracking-tight">Access controls</h4>
                                    <div className="space-y-2">
                                        {Object.keys(permissions).map((permName) => (
                                            <div key={permName} className="flex items-center justify-between px-3 py-2 rounded-none hover:bg-slate-50 transition-colors">
                                                <span className="text-sm font-medium text-slate-700">{permName}</span>
                                                <button
                                                    onClick={() => togglePermission(permName)}
                                                    className={`relative inline-flex h-6 w-11 items-center transition-colors focus:outline-none ${permissions[permName] ? 'bg-blue-600' : 'bg-slate-200'
                                                        }`}
                                                    style={{ borderRadius: '999px' }}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${permissions[permName] ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50">
                                <button
                                    onClick={() => {
                                        // Update the role's permissions in the roles state
                                        const updatedRoles = roles.map(role => {
                                            if (role.title === roleEditData.roleName) {
                                                return {
                                                    ...role,
                                                    permissions: Object.keys(permissions).filter(key => permissions[key])
                                                };
                                            }
                                            return role;
                                        });
                                        setRoles(updatedRoles);
                                        setEditingRole(false);
                                    }}
                                    className="w-full py-3.5 bg-blue-600 text-white rounded-none font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <Save size={18} /> Save changes
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isAddUserOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setIsAddUserOpen(false);
                                resetNewUserForm();
                            }}
                            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[60]"
                            style={{ marginBottom: "0px" }}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-[450px] bg-white shadow-2xl z-[70] flex flex-col border-l border-slate-100"
                            style={{ marginTop: "0px", marginBottom: "0px" }}
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Add New User</h2>
                                    <p className="text-sm text-slate-500 mt-1">Create a new system user account.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsAddUserOpen(false);
                                        resetNewUserForm();
                                    }}
                                    className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">Full name *</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Rahul Sharma"
                                            value={newUserForm.name}
                                            onChange={(e) => handleNewUserInputChange('name', e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm transition-all hover:bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">Email address *</label>
                                        <input
                                            type="email"
                                            placeholder="e.g. rahul@xigi.in"
                                            value={newUserForm.email}
                                            onChange={(e) => handleNewUserInputChange('email', e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm transition-all hover:bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">Phone number *</label>
                                        <input
                                            type="tel"
                                            placeholder="e.g. 9876543210"
                                            value={newUserForm.phone}
                                            onChange={(e) => handleNewUserInputChange('phone', e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm transition-all hover:bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">Password *</label>
                                        <input
                                            type="password"
                                            placeholder="Set a login password"
                                            value={newUserForm.password}
                                            onChange={(e) => handleNewUserInputChange('password', e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm transition-all hover:bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500">Role *</label>
                                        <select
                                            value={newUserForm.role}
                                            onChange={(e) => handleNewUserInputChange('role', e.target.value)}
                                            className="w-full px-4 py-3.5 pr-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white transition-all hover:bg-slate-50 cursor-pointer"
                                        >
                                            <option value="">Select Role</option>
                                            <option value="Admin">Admin</option>
                                            <option value="Operations">Operations</option>
                                            <option value="Partner">Partner</option>
                                            <option value="Franchise Support">Franchise Support</option>
                                        </select>
                                    </div>

                                    {/* Organization Field - shown for system roles */}
                                    {isSystemRole && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Building size={14} className="text-slate-400" />
                                                <label className="text-xs font-bold text-slate-500">
                                                    Organization
                                                </label>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="e.g. XIGI Systems"
                                                value={newUserForm.organization}
                                                onChange={(e) => handleNewUserInputChange('organization', e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-slate-50 transition-all hover:bg-slate-100"
                                            />
                                        </div>
                                    )}

                                    {/* System Scope Field - shown for system roles */}
                                    {isSystemRole && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <Globe size={14} className="text-slate-400" />
                                                <label className="text-xs font-bold text-slate-500">
                                                    System scope
                                                </label>
                                            </div>

                                            <select
                                                value={newUserForm.systemScope}
                                                onChange={(e) => handleNewUserInputChange('systemScope', e.target.value)}
                                                className="w-full px-4 py-3.5 pr-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-slate-50 transition-all hover:bg-slate-100 cursor-pointer"
                                            >
                                                <option value="">Select Scope</option>
                                                <option value="All Modules">All Modules</option>
                                                <option value="Operations Module">Operations Module</option>
                                                <option value="Franchise Module">Franchise Module</option>
                                                <option value="Limited Access">Limited Access</option>
                                            </select>
                                        </div>
                                    )}

                                    {/* Partner Field - shown for Partner role */}
                                    {isPartnerRole && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500">Associated partner *</label>
                                            <select
                                                value={newUserForm.partner}
                                                onChange={(e) => handleNewUserInputChange('partner', e.target.value)}
                                                className="w-full px-4 py-3.5 pr-3 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm bg-white transition-all hover:bg-slate-50 cursor-pointer"
                                            >
                                                <option value="">Select Partner</option>
                                                {partners.map(partner => (
                                                    <option key={partner.id} value={partner.id}>
                                                        {partner.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Organization Field for Partner role */}
                                    {isPartnerRole && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-slate-500">Partner organization</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Ramesh Media Pvt Ltd"
                                                value={newUserForm.organization}
                                                onChange={(e) => handleNewUserInputChange('organization', e.target.value)}
                                                className="w-full px-4 py-3.5 rounded-none border border-slate-200 focus:outline-none focus:border-blue-500 text-sm transition-all hover:bg-slate-50"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-100 bg-slate-50">
                                <button
                                    onClick={async () => {
                                        // Mapping frontend role to backend role
                                        const roleMap = {
                                            'Admin': 'admin',
                                            'Operations': 'ops',
                                            'Partner': 'partner',
                                            'Franchise Support': 'ops'
                                        };

                                        const payload = {
                                            email: newUserForm.email,
                                            username: newUserForm.name,
                                            phone: newUserForm.phone,
                                            role: roleMap[newUserForm.role] || 'ops',
                                            company: newUserForm.role === 'Partner' ? newUserForm.partner : null,
                                            password: newUserForm.password || 'xigi@2026'
                                        };

                                        try {
                                            await api.post('users/', payload);
                                            fetchUsers(); // Refresh list
                                            setIsAddUserOpen(false);
                                            resetNewUserForm();
                                        } catch (err) {
                                            alert(err.response?.data?.error || 'Failed to create user');
                                        }
                                    }}
                                    className="w-full py-3.5 bg-blue-600 text-white rounded-none font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <UserPlus size={18} /> Create user
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.div >
    );
};

export default UsersRolesPage;

