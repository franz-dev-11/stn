import React, { useState } from "react";
import { UserPlus, Mail, Shield, Camera, Check } from "lucide-react";

const AddUser = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    role: "Administrator",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("User Data:", formData);
    alert("User added successfully!");
  };

  return (
    <div className="p-8 w-full bg-slate-50 min-h-screen flex justify-center items-start">
      <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
        {/* Header Section */}
        <div className="bg-[#a8d1cd] p-8 text-white flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <UserPlus size={28} /> Add New Account
            </h1>
            <p className="text-teal-50 text-sm mt-1">
              Create a new user profile for the STN system.
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <UserPlus size={32} />
            </div>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Avatar Upload Placeholder */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 bg-slate-100 rounded-full border-4 border-white shadow-md flex items-center justify-center text-slate-400 relative group cursor-pointer overflow-hidden">
              <Camera size={30} />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white text-[10px] font-bold">UPLOAD</span>
              </div>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-3 tracking-widest uppercase">
              Profile Photo
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 tracking-widest ml-1">
                FULL NAME
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserPlus size={18} className="text-teal-600" />
                </div>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-50 pl-11 pr-4 py-3 border-2 border-transparent rounded-xl focus:outline-none focus:border-teal-500/50 focus:bg-white transition-all text-slate-700 font-medium"
                  placeholder="e.g. Robert Simmons"
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 tracking-widest ml-1">
                EMAIL ADDRESS
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={18} className="text-teal-600" />
                </div>
                <input
                  type="email"
                  required
                  className="w-full bg-slate-50 pl-11 pr-4 py-3 border-2 border-transparent rounded-xl focus:outline-none focus:border-teal-500/50 focus:bg-white transition-all text-slate-700 font-medium"
                  placeholder="robert@stn.com"
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-slate-400 tracking-widest ml-1">
                ACCOUNT ROLE
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Shield size={18} className="text-teal-600" />
                </div>
                <select
                  className="w-full bg-slate-50 pl-11 pr-4 py-3 border-2 border-transparent rounded-xl focus:outline-none focus:border-teal-500/50 focus:bg-white transition-all text-slate-700 font-bold appearance-none cursor-pointer"
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                >
                  <option>Administrator</option>
                  <option>Inventory Manager</option>
                  <option>Sales Representative</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-8 flex flex-col sm:flex-row gap-4">
            <button
              type="submit"
              className="flex-1 bg-[#a8d1cd] hover:bg-[#8eb9b4] text-white font-bold py-4 rounded-2xl shadow-lg shadow-teal-200/50 transition-all flex items-center justify-center gap-2"
            >
              <Check size={20} /> Create Account
            </button>
            <button
              type="button"
              className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold rounded-2xl transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUser;
