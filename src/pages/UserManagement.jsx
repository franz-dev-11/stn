import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  ShieldCheck,
  Search,
  Power,
} from "lucide-react";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = useCallback(async () => {
    // Fetches profile data from your existing profiles table
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setUsers(data);
    } else {
      console.error("Error fetching users:", error.message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  const updateStatus = async (userId, newStatus) => {
    const { error } = await supabase
      .from("profiles")
      .update({ approval_status: newStatus })
      .eq("id", userId);

    if (!error) {
      // Local state update for immediate feedback
      setUsers(
        users.map((u) =>
          u.id === userId ? { ...u, approval_status: newStatus } : u,
        ),
      );
    } else {
      alert("Failed to update status: " + error.message);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen font-sans overflow-x-hidden'>
      <div className='max-w-6xl mx-auto'>
        {/* Header Section */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
              <ShieldCheck className='text-teal-600' size={32} /> MANAGE USERS
            </h1>
            <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
              Access Review | Account Approval Controls
            </p>
          </div>

          <div className='relative w-full sm:w-64'>
            <Search
              className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400'
              size={18}
            />
            <input
              type='text'
              placeholder='Search by email...'
              className='w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white text-sm'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className='bg-white rounded-2xl shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left min-w-max'>
              <thead>
                <tr className='bg-black text-white text-[10px] font-black uppercase'>
                  <th className='px-6 py-4'>User Details</th>
                  <th className='px-6 py-4'>Assigned Role</th>
                  <th className='px-6 py-4'>Approval Status</th>
                  <th className='px-6 py-4 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-50 text-black'>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className='hover:bg-slate-50/50 transition-colors'
                    >
                      <td className='p-4'>
                        <div className='flex items-center gap-3'>
                          <div className='w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold'>
                            {user.email?.charAt(0).toUpperCase()}
                          </div>
                          <span className='font-medium text-slate-700'>
                            {user.email}
                          </span>
                        </div>
                      </td>
                      <td className='p-4'>
                        <span className='px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase'>
                          {user.role || "Staff"}
                        </span>
                      </td>
                      <td className='p-4 text-black'>
                        {user.approval_status === "approved" && (
                          <span className='flex items-center gap-1 text-emerald-600 text-sm font-semibold'>
                            <UserCheck size={16} /> Approved
                          </span>
                        )}
                        {user.approval_status === "pending" && (
                          <span className='flex items-center gap-1 text-amber-500 text-sm font-semibold'>
                            <Clock size={16} /> Pending Review
                          </span>
                        )}
                        {user.approval_status === "denied" && (
                          <span className='flex items-center gap-1 text-rose-500 text-sm font-semibold'>
                            <XCircle size={16} /> Access Denied
                          </span>
                        )}
                      </td>
                      <td className='p-4 text-right'>
                        <div className='flex justify-end gap-2'>
                          {user.approval_status === "approved" ? (
                            <button
                              onClick={() => updateStatus(user.id, "inactive")}
                              className='p-2 rounded-lg transition-all bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-700'
                              title='Set Inactive'
                            >
                              <Power size={20} />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  updateStatus(user.id, "approved")
                                }
                                className={`p-2 rounded-lg transition-all ${user.approval_status === "approved" ? "bg-emerald-50 text-emerald-600" : "hover:bg-emerald-50 text-gray-400 hover:text-emerald-600"}`}
                                title='Approve User'
                              >
                                <CheckCircle size={20} />
                              </button>
                              <button
                                onClick={() => updateStatus(user.id, "denied")}
                                className={`p-2 rounded-lg transition-all ${user.approval_status === "denied" ? "bg-rose-50 text-rose-600" : "hover:bg-rose-50 text-gray-400 hover:text-rose-600"}`}
                                title='Deny User'
                              >
                                <XCircle size={20} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan='4' className='p-12 text-center text-gray-400'>
                      No users found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
