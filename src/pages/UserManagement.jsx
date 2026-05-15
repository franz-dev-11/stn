import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { ShieldCheck, Search, KeyRound, Copy, Check, X, Mail } from "lucide-react";

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [resetModal, setResetModal] = useState(null); // { tempPassword, name }
  const [copied, setCopied] = useState(false);

  const fetchUsers = useCallback(async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, employee_id, first_name, middle_name, last_name, username, role, must_change_password, email")
      .order("employee_id", { ascending: true });

    if (!error) setUsers(data || []);
    else console.error("Error fetching users:", error.message);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
    const channel = supabase
      .channel("users-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchUsers)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchUsers]);

  const handleResetPassword = async (user) => {
    const tempPassword = generatePassword();
    const hashed = await hashPassword(tempPassword);

    const { error } = await supabase
      .from("users")
      .update({ password: hashed, must_change_password: true })
      .eq("id", user.id);

    if (error) {
      alert("Reset failed: " + error.message);
      return;
    }

    setUsers((prev) =>
      prev.map((u) => u.id === user.id ? { ...u, must_change_password: true } : u)
    );
    setResetModal({
      tempPassword,
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
    });
    setCopied(false);
  };

  const handleSendEmailWithPassword = (user) => {
    const tempPassword = generatePassword();
    const subject = encodeURIComponent("Your Temporary Password");
    const body = encodeURIComponent(
      `Hi ${user.first_name},\n\nYour temporary password is: ${tempPassword}\n\nPlease log in and change your password immediately.\n\nBest regards,\nAdmin`
    );
    if (user.email) {
      // Open Gmail in a new tab with pre-filled subject and body
      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email)}&su=${subject}&body=${body}`, '_blank');
      // Also update the user's password in DB
      hashPassword(tempPassword).then((hashed) => {
        supabase
          .from("users")
          .update({ password: hashed, must_change_password: true })
          .eq("id", user.id)
          .then(() => {
            setUsers((prev) =>
              prev.map((u) => u.id === user.id ? { ...u, must_change_password: true } : u)
            );
          });
      });
    } else {
      alert("Email not configured for this user.");
    }
  };

  const handleToggleStatus = async (user) => {
    const newStatus = !user.must_change_password;
    const { error } = await supabase
      .from("users")
      .update({ must_change_password: newStatus })
      .eq("id", user.id);

    if (error) {
      alert("Update failed: " + error.message);
      return;
    }

    setUsers((prev) =>
      prev.map((u) => u.id === user.id ? { ...u, must_change_password: newStatus } : u)
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resetModal.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredUsers = users.filter((user) => {
    const term = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(term) ||
      user.first_name?.toLowerCase().includes(term) ||
      user.last_name?.toLowerCase().includes(term) ||
      user.employee_id?.toLowerCase().includes(term)
    );
  });

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans overflow-x-hidden'>
      <div className='max-w-6xl mx-auto'>
        {/* Header */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
              <ShieldCheck className='text-teal-600' size={32} /> MANAGE USERS
            </h1>
            <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
              User Accounts | Password Management
            </p>
          </div>
          <div className='relative w-full sm:w-64'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' size={18} />
            <input
              type='text'
              placeholder='Search by name, username...'
              className='w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white text-sm'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left min-w-max'>
              <thead>
                <tr className='bg-black text-white text-[10px] font-black uppercase'>
                  <th className='px-6 py-4'>Employee</th>
                  <th className='px-6 py-4'>Username</th>
                  <th className='px-6 py-4'>Email</th>
                  <th className='px-6 py-4'>Role</th>
                  <th className='px-6 py-4'>Status</th>
                  <th className='px-6 py-4 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50 text-black'>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className='hover:bg-slate-50/50 transition-colors'>
                      <td className='px-6 py-4'>
                        <div className='font-semibold text-sm text-slate-800'>
                          {user.first_name} {user.middle_name ? user.middle_name + " " : ""}{user.last_name}
                        </div>
                        <div className='text-xs text-slate-400 font-mono'>{user.employee_id}</div>
                      </td>
                      <td className='px-6 py-4'>
                        <span className='text-sm text-slate-600 font-mono'>{user.username}</span>
                      </td>
                      <td className='px-6 py-4'>
                        <span className='text-sm text-slate-600 font-mono'>{user.email || "—"}</span>
                      </td>
                      <td className='px-6 py-4'>
                        <span className='px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase'>
                          {user.role}
                        </span>
                      </td>
                      <td className='px-6 py-4'>
                        <select
                          value={user.must_change_password ? "inactive" : "active"}
                          onChange={() => handleToggleStatus(user)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition border outline-none ${
                            user.must_change_password
                              ? "text-slate-600 bg-slate-100 border-slate-200"
                              : "text-emerald-600 bg-emerald-50 border-emerald-200"
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className='px-6 py-4 text-right'>
                        <div className='flex items-center justify-end gap-2'>
                          <button
                            onClick={() => handleSendEmailWithPassword(user)}
                            disabled={!user.email}
                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                              user.email
                                ? "text-blue-600 border border-blue-200 hover:bg-blue-50 hover:border-blue-300"
                                : "text-gray-400 border border-gray-200 opacity-50 cursor-not-allowed"
                            }`}
                            title={user.email ? "Send email with temp password" : "Email not configured"}
                          >
                            <Mail size={13} />
                            Email
                          </button>
                          <button
                            onClick={() => handleResetPassword(user)}
                            className='flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 transition'
                            title='Reset Password'
                          >
                            <KeyRound size={13} />
                            Reset
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan='6' className='p-12 text-center text-gray-400'>
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetModal && (
        <div className='fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-2xl shadow-xl w-full max-w-sm p-6'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='font-bold text-slate-800 flex items-center gap-2'>
                <KeyRound size={16} className='text-teal-500' />
                Password Reset
              </h3>
              <button onClick={() => setResetModal(null)} className='text-slate-400 hover:text-slate-600'>
                <X size={18} />
              </button>
            </div>
            <p className='text-sm text-slate-500 mb-4'>
              Temporary password for{" "}
              <span className='font-semibold text-slate-700'>{resetModal.name}</span>.
              Share this with the user — it will not be shown again.
            </p>
            <div className='flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 mb-4'>
              <span className='flex-1 font-mono text-sm text-slate-800 tracking-wider'>
                {resetModal.tempPassword}
              </span>
              <button
                onClick={handleCopy}
                className='text-slate-400 hover:text-teal-600 transition'
                title='Copy'
              >
                {copied ? <Check size={15} className='text-teal-500' /> : <Copy size={15} />}
              </button>
            </div>
            <p className='text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4'>
              The user will be required to set a new password on next login.
            </p>
            <button
              onClick={() => setResetModal(null)}
              className='w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm py-2.5 rounded-lg transition'
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
