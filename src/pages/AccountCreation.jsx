import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { insertAuditTrail, getSessionUser, getPerformedBy } from "../utils/auditTrail";
import { Plus, Trash2, UserPlus, Users, CheckCircle, AlertCircle, Upload, Download, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const EMPTY_ACCOUNT = {
  employee_id: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  birthday: "",
  username: "",
  password: "",
  role: "Cashier",
};

const ROLES = ["Cashier", "Stockman", "Admin", "Super Admin"];

function getAvailableRoles() {
  const user = (() => { try { return JSON.parse(sessionStorage.getItem("stn_user") || "null"); } catch { return null; } })();
  const role = user?.role === "Staff" ? "Cashier" : user?.role;
  return role === "Admin" ? ["Cashier", "Stockman"] : ROLES;
}

function buildUsername(firstName, middleName, lastName, employeeId) {
  const f = firstName.trim().charAt(0);
  const m = middleName.trim().charAt(0);
  const l = lastName.trim().toLowerCase().replace(/\s+/g, "");
  // Extract numeric part from employee ID (e.g. "EMP-042" → "042")
  const numPart = (employeeId || "").replace(/\D/g, "");
  return (f + m + l + numPart).toLowerCase();
}

// Parse an employee ID like "EMP-042" → 42, or "42" → 42
function parseEmpNum(empId) {
  const n = parseInt((empId || "").replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

// Format number back to "EMP-001" style (3-digit padded)
function formatEmpId(n) {
  return `EMP-${String(n).padStart(3, "0")}`;
}

async function getNextEmployeeId(reservedIds = []) {
  const { data, error } = await supabase
    .from("users")
    .select("employee_id")
    .order("employee_id", { ascending: false });

  if (error) throw error;

  const allNums = [
    ...(data || []).map((r) => parseEmpNum(r.employee_id)),
    ...reservedIds.map(parseEmpNum),
  ];
  const maxNum = allNums.length > 0 ? Math.max(...allNums) : 0;
  return formatEmpId(maxNum + 1);
}

function generatePassword(lastName = "", birthday = "") {
  const raw = lastName.trim().toLowerCase().replace(/\s+/g, "");
  const ln = raw.charAt(0).toUpperCase() + raw.slice(1);
  // birthday is YYYY-MM-DD; extract year
  const year = birthday ? birthday.split("-")[0] : "";
  return ln && year ? `${ln}${year}!` : "";
}

const inputCls =
  "w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition bg-white";

const labelCls = "block text-xs font-semibold text-slate-500 mb-1";

function SingleForm() {
  const [form, setForm] = useState({ ...EMPTY_ACCOUNT, password: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [idLoading, setIdLoading] = useState(true);

  useEffect(() => {
    getNextEmployeeId()
      .then((nextId) => {
        setForm((prev) => ({ ...prev, employee_id: nextId }));
      })
      .catch(console.error)
      .finally(() => setIdLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      // Auto-derive username whenever a name field or employee_id changes
      const fn = name === "first_name" ? value : prev.first_name;
      const mn = name === "middle_name" ? value : prev.middle_name;
      const ln = name === "last_name" ? value : prev.last_name;
      const eid = name === "employee_id" ? value : prev.employee_id;
      if (["first_name", "middle_name", "last_name", "employee_id"].includes(name)) {
        next.username = buildUsername(fn, mn, ln, eid);
      }
      if (["last_name", "birthday"].includes(name)) {
        const newLn = name === "last_name" ? value : prev.last_name;
        const newBday = name === "birthday" ? value : prev.birthday;
        next.password = generatePassword(newLn, newBday);
      }
      return next;
    });
    if (result) setResult(null);
  };

  const regeneratePassword = () => {
    setForm((prev) => ({ ...prev, password: generatePassword(prev.last_name, prev.birthday) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["employee_id", "first_name", "last_name", "birthday", "username", "password"];
    for (const field of required) {
      if (!form[field].trim()) {
        setResult({ type: "error", message: `${field.replace("_", " ")} is required.` });
        return;
      }
    }

    setLoading(true);
    try {
      const { password, ...rest } = form;
      const hashed = await hashPassword(password);

      const { error } = await supabase.from("users").insert({
        ...rest,
        employee_id: rest.employee_id.trim(),
        first_name: rest.first_name.trim(),
        middle_name: rest.middle_name.trim(),
        last_name: rest.last_name.trim(),
        username: rest.username.trim(),
        password: hashed,
        must_change_password: true,
      });

      if (error) throw error;

      setForm({ ...EMPTY_ACCOUNT, password: "" });
      setResult({ type: "success", message: "Account created successfully." });
      // Refresh to next employee ID after successful creation
      setIdLoading(true);
      getNextEmployeeId()
        .then((nextId) => setForm((prev) => ({ ...prev, employee_id: nextId })))
        .catch(console.error)
        .finally(() => setIdLoading(false));
    } catch (err) {
      const msg = err.message?.includes("duplicate")
        ? "Employee ID or username already exists."
        : err.message || "Failed to create account.";
      setResult({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='bg-white border border-slate-100 rounded-xl p-6 shadow-sm'
    >
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
        <div>
          <label className={labelCls}>
            Employee ID <span className='text-teal-500 font-normal'>(auto)</span>
          </label>
          <div className='w-full px-3 py-2.5 text-sm border border-slate-100 rounded-lg bg-slate-50 text-slate-500 font-mono'>
            {idLoading ? "Loading..." : form.employee_id || "—"}
          </div>
        </div>
        <div>
          <label className={labelCls}>First Name *</label>
          <input
            name='first_name'
            value={form.first_name}
            onChange={handleChange}
            placeholder='First name'
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Middle Name</label>
          <input
            name='middle_name'
            value={form.middle_name}
            onChange={handleChange}
            placeholder='Middle name'
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Last Name *</label>
          <input
            name='last_name'
            value={form.last_name}
            onChange={handleChange}
            placeholder='Last name'
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Birthday *</label>
          <input
            type='date'
            name='birthday'
            value={form.birthday}
            onChange={handleChange}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Role</label>
          <select name='role' value={form.role} onChange={handleChange} className={inputCls}>
            {getAvailableRoles().map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Username <span className='text-teal-500 font-normal'>(auto)</span></label>
          <input
            name='username'
            value={form.username}
            onChange={handleChange}
            placeholder='Auto-generated'
            className={inputCls}
            autoComplete='off'
          />
        </div>
        <div>
          <label className={labelCls}>Password <span className='text-teal-500 font-normal'>(auto)</span></label>
          <div className='flex gap-1.5'>
            <input
              type='text'
              name='password'
              value={form.password}
              onChange={handleChange}
              className={`${inputCls} font-mono`}
              autoComplete='new-password'
              readOnly
            />
            <button
              type='button'
              onClick={regeneratePassword}
              className='shrink-0 p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-teal-600 hover:border-teal-300 transition'
              title='Regenerate password'
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div
          className={`flex items-center gap-2 mt-4 px-3 py-2.5 rounded-lg text-xs font-medium border ${
            result.type === "success"
              ? "bg-teal-50 text-teal-700 border-teal-100"
              : "bg-rose-50 text-rose-600 border-rose-100"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {result.message}
        </div>
      )}

      <button
        type='submit'
        disabled={loading}
        className='mt-5 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white text-xs font-semibold px-6 py-2.5 rounded-lg transition-all duration-200'
      >
        {loading ? "Creating..." : "Create Account"}
      </button>
    </form>
  );
}

const BATCH_COLS = [
  { key: "employee_id", label: "Employee ID", type: "readonly", placeholder: "" },
  { key: "first_name", label: "First Name *", type: "text", placeholder: "First" },
  { key: "middle_name", label: "Middle Name", type: "text", placeholder: "Middle" },
  { key: "last_name", label: "Last Name *", type: "text", placeholder: "Last" },
  { key: "birthday", label: "Birthday *", type: "date", placeholder: "" },
  { key: "role", label: "Role", type: "select", placeholder: "" },
  { key: "username", label: "Username (auto)", type: "text", placeholder: "auto" },
  { key: "password", label: "Password (auto)", type: "password-regen", placeholder: "" },
];

const CSV_HEADERS = ["employee_id", "first_name", "middle_name", "last_name", "birthday", "role", "username", "password"];
const CSV_REQUIRED = ["first_name", "last_name", "birthday"];
const TEMPLATE_HEADERS = ["first_name", "middle_name", "last_name", "birthday"];

function downloadTemplate() {
  // Create worksheet data
  const wsData = [
    ["first_name", "middle_name", "last_name", "birthday"],
    ["Juan", "Lopez", "Dela Cruz", "1990-05-21"]
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Accounts");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "accounts_template.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], error: "CSV has no data rows." };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const missing = CSV_REQUIRED.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    return { rows: [], error: `Missing required columns: ${missing.join(", ")}` };
  }

  const rows = lines.slice(1).map((line, i) => {
    const vals = line.split(",").map((v) => v.trim());
    const obj = { _id: Date.now() + i };
    headers.forEach((h, idx) => {
      obj[h] = vals[idx] ?? "";
    });
    // Ensure role default
    if (!obj.role) obj.role = "Cashier";
    return obj;
  });

  return { rows, error: null };
}

function BatchForm() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [csvError, setCsvError] = useState(null);
  const [initLoading, setInitLoading] = useState(true);
  const fileInputRef = useRef(null);

  // Seed first row with next employee ID on mount
  useEffect(() => {
    getNextEmployeeId()
      .then((nextId) => {
        setRows([{ ...EMPTY_ACCOUNT, _id: Date.now(), employee_id: nextId, password: generatePassword() }]);
      })
      .catch(console.error)
      .finally(() => setInitLoading(false));
  }, []);

  // Returns the highest numeric emp ID currently in the rows array
  const maxReservedId = () => rows.map((r) => r.employee_id).filter(Boolean);

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setCsvError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = new Uint8Array(ev.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const ws = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) {
        setCsvError("Excel file has no data rows.");
        return;
      }
      const headers = json[0].map((h) => String(h).trim().toLowerCase());
      const missing = CSV_REQUIRED.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        setCsvError(`Missing required columns: ${missing.join(", ")}`);
        return;
      }
      const rowsArr = json.slice(1).map((vals, i) => {
        const obj = { _id: Date.now() + i };
        headers.forEach((h, idx) => {
          if (h === "birthday") {
            let b = vals[idx];
            let dateStr = "";
            if (b instanceof Date) {
              const d = b;
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              dateStr = `${day}/${month}/${year}`;
            } else if (typeof b === "number") {
              // Excel date serial number
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              const d = new Date(excelEpoch.getTime() + b * 86400000);
              const day = String(d.getDate()).padStart(2, '0');
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const year = d.getFullYear();
              dateStr = `${day}/${month}/${year}`;
            } else if (typeof b === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(b.trim())) {
              dateStr = b.trim();
            } else if (typeof b === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.trim())) {
              // Convert from YYYY-MM-DD to DD/MM/YYYY
              const [y, m, d] = b.trim().split('-');
              dateStr = `${d}/${m}/${y}`;
            } else {
              dateStr = "";
            }
            obj[h] = dateStr;
          } else {
            obj[h] = vals[idx] ? String(vals[idx]).trim() : "";
          }
        });
        if (!obj.role) obj.role = "Cashier";
        return obj;
      });
      // Auto-fill employee_id, username, password as in CSV
      const dbData = await supabase.from("users").select("employee_id").order("employee_id", { ascending: false });
      const dbNums = (dbData.data || []).map((r) => parseEmpNum(r.employee_id));
      const baseMax = dbNums.length > 0 ? Math.max(...dbNums) : 0;
      const filled = rowsArr.map((row, i) => {
        const empId = row.employee_id || formatEmpId(baseMax + i + 1);
        const username = buildUsername(row.first_name, row.middle_name, row.last_name, empId);
        // Convert DD/MM/YYYY to YYYY-MM-DD for password generation
        let bday = row.birthday || "";
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(bday)) {
          const [dd, mm, yyyy] = bday.split("/");
          bday = `${yyyy}-${mm}-${dd}`;
        }
        const password = generatePassword(row.last_name, bday);
        return {
          ...row,
          employee_id: empId,
          username,
          password,
        };
      });
      setRows(filled);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    setCsvError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target.result;
      const { rows: parsedRows, error } = parseCSV(text);
      if (error) {
        setCsvError(error);
        return;
      }
      // Query DB for last employee_id, increment for new rows
      const dbData = await supabase.from("users").select("employee_id").order("employee_id", { ascending: false });
      const dbNums = (dbData.data || []).map((r) => parseEmpNum(r.employee_id));
      const baseMax = dbNums.length > 0 ? Math.max(...dbNums) : 0;
      const filled = parsedRows.map((row, i) => {
        const empId = row.employee_id || formatEmpId(baseMax + i + 1);
        const birthday = typeof row.birthday === "string" ? row.birthday.trim() : String(row.birthday ?? "").trim();
        const username = buildUsername(row.first_name, row.middle_name, row.last_name, empId);
        // Convert DD/MM/YYYY to YYYY-MM-DD for password generation
        let bday = birthday;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(bday)) {
          const [dd, mm, yyyy] = bday.split("/");
          bday = `${yyyy}-${mm}-${dd}`;
        }
        const password = generatePassword(row.last_name, bday);
        return {
          ...row,
          employee_id: empId,
          birthday,
          username,
          password,
        };
      });
      setRows(filled);
    };
    reader.readAsText(file);
  };

  const addRow = () => {
    getNextEmployeeId(maxReservedId())
      .then((nextId) => {
        setRows((prev) => [
          ...prev,
          { ...EMPTY_ACCOUNT, _id: Date.now(), employee_id: nextId, username: "", password: "" },
        ]);
      })
      .catch(console.error);
    if (result) setResult(null);
  };

  const removeRow = (id) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r._id !== id));
    if (result) setResult(null);
  };

  const handleChange = (id, name, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row._id !== id) return row;
        const next = { ...row };
        if (name === "birthday") {
          // Always store as DD/MM/YYYY string or empty
          if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim())) {
            next.birthday = value.trim();
          } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
            // Convert from YYYY-MM-DD to DD/MM/YYYY
            const [y, m, d] = value.trim().split('-');
            next.birthday = `${d}/${m}/${y}`;
          } else if (value instanceof Date) {
            const d = value;
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            next.birthday = `${day}/${month}/${year}`;
          } else {
            next.birthday = "";
          }
        } else {
          next[name] = value;
        }
        const fn = name === "first_name" ? value : row.first_name;
        const mn = name === "middle_name" ? value : row.middle_name;
        const ln = name === "last_name" ? value : row.last_name;
        const eid = name === "employee_id" ? value : row.employee_id;
        if (["first_name", "middle_name", "last_name", "employee_id"].includes(name)) {
          next.username = buildUsername(fn, mn, ln, eid);
        }
        // Regenerate password if last_name or birthday changes
        if (["last_name", "birthday"].includes(name)) {
          const newLastName = name === "last_name" ? value : row.last_name;
          const newBirthday = name === "birthday" ? next.birthday : row.birthday;
          next.password = generatePassword(newLastName, (() => {
            // Convert DD/MM/YYYY to YYYY-MM-DD for password generation
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(newBirthday)) {
              const [dd, mm, yyyy] = newBirthday.split("/");
              return `${yyyy}-${mm}-${dd}`;
            }
            return newBirthday;
          })());
        }
        return next;
      })
    );
    if (result) setResult(null);
  };

  const regenerateRowPassword = (id) => {
    setRows((prev) =>
      prev.map((row) => (row._id === id ? { ...row, password: generatePassword() } : row))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const required = ["employee_id", "first_name", "last_name", "birthday", "username", "password"];

    for (let i = 0; i < rows.length; i++) {
      for (const field of required) {
        if (!rows[i][field]?.trim()) {
          setResult({
            type: "error",
            message: `Row ${i + 1}: ${field.replace("_", " ")} is required.`,
          });
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = await Promise.all(
        rows.map(async ({ password, ...rest }) => {
          delete rest._id;
          // Convert DD/MM/YYYY to YYYY-MM-DD for upload
          let bday = rest.birthday;
          if (typeof bday === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(bday.trim())) {
            const [d, m, y] = bday.trim().split('/');
            bday = `${y}-${m}-${d}`;
          } else if (typeof bday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bday.trim())) {
            // already correct
          } else {
            bday = "";
          }
          return {
            ...rest,
            employee_id: rest.employee_id.trim(),
            first_name: rest.first_name.trim(),
            middle_name: rest.middle_name.trim(),
            last_name: rest.last_name.trim(),
            birthday: bday,
            username: rest.username.trim(),
            password: await hashPassword(password),
            must_change_password: true,
          };
        })
      );

      const { error } = await supabase.from("users").insert(payload);
      if (error) throw error;

      const sessionUser = getSessionUser();
      await insertAuditTrail([{
        action: "BATCH_ACCOUNT",
        performed_by: getPerformedBy(sessionUser),
        quantity: payload.length,
        item_name: payload.map((p) => `${p.first_name} ${p.last_name}`.trim()).join(", "),
      }]);

      setRows([{ ...EMPTY_ACCOUNT, _id: Date.now(), password: generatePassword() }]);
      // Refresh first row with next ID
      getNextEmployeeId()
        .then((nextId) =>
          setRows([{ ...EMPTY_ACCOUNT, _id: Date.now(), employee_id: nextId, password: generatePassword() }])
        )
        .catch(console.error);
      setResult({
        type: "success",
        message: `${payload.length} account(s) created successfully.`,
      });
    } catch (err) {
      const msg = err.message?.includes("duplicate")
        ? "One or more Employee IDs or usernames already exist."
        : err.message || "Failed to create accounts.";
      setResult({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {initLoading && (
        <div className='text-xs text-slate-400 mb-4'>Loading employee IDs...</div>
      )}
      {/* CSV toolbar */}
      <div className='flex flex-wrap items-center gap-2 mb-4'>
        <input
          ref={fileInputRef}
          type='file'
          accept='.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, .xlsx'
          onChange={(e) => {
            const file = e.target.files[0];
            if (file && file.name.endsWith('.xlsx')) handleExcelUpload(e);
            else handleCSVUpload(e);
          }}
          className='hidden'
        />
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-slate-200 hover:border-slate-300 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 transition'
        >
          <Upload size={13} />
          Upload CSV/Excel
        </button>
        <button
          type='button'
          onClick={downloadTemplate}
          className='flex items-center gap-1.5 text-xs font-semibold text-teal-600 border border-teal-200 hover:border-teal-300 px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 transition'
        >
          <Download size={13} />
          Download Template
        </button>
        <span className='text-[10px] text-slate-400 ml-1'>
          CSV columns: employee_id (optional), first_name, middle_name, last_name, birthday, role, username (optional), password (optional)
        </span>
      </div>

      {csvError && (
        <div className='flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg text-xs font-medium border bg-rose-50 text-rose-600 border-rose-100'>
          <AlertCircle size={14} />
          {csvError}
        </div>
      )}

      {result && (
        <div
          className={`flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg text-xs font-medium border ${
            result.type === "success"
              ? "bg-teal-50 text-teal-700 border-teal-100"
              : "bg-rose-50 text-rose-600 border-rose-100"
          }`}
        >
          {result.type === "success" ? (
            <CheckCircle size={14} />
          ) : (
            <AlertCircle size={14} />
          )}
          {result.message}
        </div>
      )}

      <div className='overflow-x-auto rounded-xl border border-slate-100 shadow-sm'>
        <table className='w-full text-xs'>
          <thead>
            <tr className='bg-slate-50 border-b border-slate-100'>
              <th className='px-2 py-2.5 text-left font-semibold text-slate-400 text-[10px] uppercase tracking-wide w-8'>
                #
              </th>
              {BATCH_COLS.map((col) => (
                <th
                  key={col.key}
                  className='px-2 py-2.5 text-left font-semibold text-slate-400 text-[10px] uppercase tracking-wide whitespace-nowrap'
                >
                  {col.label}
                </th>
              ))}
              <th className='px-2 py-2.5 w-8' />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row._id} className='border-b border-slate-50 hover:bg-slate-50/50'>
                <td className='px-2 py-1.5 text-slate-400 text-center font-medium'>
                  {index + 1}
                </td>
                {BATCH_COLS.map((col) => (
                  <td key={col.key} className='px-1.5 py-1.5'>
                    {col.type === "select" ? (
                      <select
                        value={row[col.key]}
                        onChange={(e) => handleChange(row._id, col.key, e.target.value)}
                        className='w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white min-w-22.5'
                      >
                        {getAvailableRoles().map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : col.type === "password-regen" ? (
                      <div className='flex gap-1'>
                        <input
                          type='text'
                          value={row[col.key]}
                          onChange={(e) => handleChange(row._id, col.key, e.target.value)}
                          className='w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white font-mono min-w-22.5'
                          autoComplete='off'
                        />
                        <button
                          type='button'
                          onClick={() => regenerateRowPassword(row._id)}
                          className='shrink-0 p-1.5 border border-slate-200 rounded-md text-slate-400 hover:text-teal-600 hover:border-teal-300 transition'
                          title='Regenerate'
                        >
                          <RefreshCw size={11} />
                        </button>
                      </div>
                    ) : col.type === "readonly" ? (
                      <div className='px-2 py-1.5 text-xs text-slate-500 font-mono bg-slate-50 border border-slate-100 rounded-md min-w-22.5 whitespace-nowrap'>
                        {row[col.key] || "—"}
                      </div>
                    ) : (
                      <>
                        <input
                          type={col.type}
                          value={col.key === "birthday" && col.type === "date"
                            ? (() => {
                                // Convert DD/MM/YYYY to YYYY-MM-DD for date input
                                const val = row[col.key];
                                if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
                                  const [dd, mm, yyyy] = val.split("/");
                                  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
                                }
                                return "";
                              })()
                            : row[col.key]}
                          onChange={(e) => {
                            if (col.key === "birthday" && col.type === "date") {
                              // Convert YYYY-MM-DD from date picker to DD/MM/YYYY for storage
                              const [yyyy, mm, dd] = e.target.value.split("-");
                              handleChange(row._id, col.key, `${dd}/${mm}/${yyyy}`);
                            } else {
                              handleChange(row._id, col.key, e.target.value);
                            }
                          }}
                          placeholder={col.placeholder}
                          autoComplete='off'
                          className='w-full px-2 py-1.5 text-xs border border-slate-200 rounded-md outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white min-w-22.5'
                        />
                      </>
                    )}
                  </td>
                ))}
                <td className='px-2 py-1.5 text-center'>
                  <button
                    type='button'
                    onClick={() => removeRow(row._id)}
                    disabled={rows.length === 1}
                    className='text-slate-300 hover:text-rose-400 disabled:opacity-30 transition'
                    aria-label='Remove row'
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='flex flex-wrap items-center gap-3 mt-4'>
        <button
          type='button'
          onClick={addRow}
          className='flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 border border-teal-200 hover:border-teal-300 px-3 py-2 rounded-lg bg-teal-50 hover:bg-teal-100 transition'
        >
          <Plus size={13} />
          Add Row
        </button>
        <button
          type='submit'
          disabled={loading}
          className='flex items-center gap-1.5 bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 text-white text-xs font-semibold px-6 py-2 rounded-lg transition-all duration-200'
        >
          {loading ? "Creating..." : `Create ${rows.length} Account${rows.length !== 1 ? "s" : ""}`}
        </button>
        <span className='text-[10px] text-slate-400 ml-auto'>
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
    </form>
  );
}

export default function AccountCreation() {
  const [mode, setMode] = useState("single");

  return (
    <div className='p-3 sm:p-4 md:p-6 lg:p-8 bg-[#f3f4f6] min-h-screen text-black overflow-x-hidden'>
      <div className='max-w-5xl mx-auto'>
        <div className='flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 sm:mb-8 gap-4'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3'>
              <UserPlus size={32} className='text-teal-600' /> ACCOUNT CREATION
            </h1>
            <p className='text-slate-600 font-bold text-[8px] sm:text-xs uppercase tracking-[0.2em] mt-2'>
              User Management | Employee Onboarding
            </p>
          </div>
        </div>

      <div className='flex gap-2 mb-6'>
        <button
          type='button'
          onClick={() => setMode("single")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
            mode === "single"
              ? "bg-teal-500 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <UserPlus size={14} />
          Single
        </button>
        <button
          type='button'
          onClick={() => setMode("batch")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition ${
            mode === "batch"
              ? "bg-teal-500 text-white shadow-sm"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Users size={14} />
          Batch
        </button>
      </div>

      {mode === "single" ? <SingleForm /> : <BatchForm />}
    </div>
  </div>
  );
}
