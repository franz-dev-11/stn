/**
 * Philippine Standard Time (PST) Utility Functions
 * All functions return dates/times in Philippine Standard Time (UTC+8)
 */

/**
 * Format date to Philippine Standard Time date string
 * @param {Date|string} dateInput - Date object or ISO string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string in PST
 */
export const formatPSTDate = (dateInput, options = {}) => {
  if (!dateInput) return "—";
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const defaultOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
      ...options,
    };
    return date.toLocaleDateString("en-PH", defaultOptions);
  } catch (err) {
    console.error("Error formatting PST date:", err);
    return "—";
  }
};

/**
 * Format time to Philippine Standard Time time string
 * @param {Date|string} dateInput - Date object or ISO string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted time string in PST
 */
export const formatPSTTime = (dateInput, options = {}) => {
  if (!dateInput) return "—";
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const defaultOptions = {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
      ...options,
    };
    return date.toLocaleTimeString("en-PH", defaultOptions);
  } catch (err) {
    console.error("Error formatting PST time:", err);
    return "—";
  }
};

/**
 * Format date and time to Philippine Standard Time string
 * @param {Date|string} dateInput - Date object or ISO string
 * @param {object} dateOptions - Intl.DateTimeFormat options for date
 * @param {object} timeOptions - Intl.DateTimeFormat options for time
 * @returns {string} Formatted date and time string in PST
 */
export const formatPSTDateTime = (
  dateInput,
  dateOptions = {},
  timeOptions = {}
) => {
  if (!dateInput) return "—";
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const defaultDateOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Manila",
      ...dateOptions,
    };
    const defaultTimeOptions = {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Manila",
      ...timeOptions,
    };
    const dateStr = date.toLocaleDateString("en-PH", defaultDateOptions);
    const timeStr = date.toLocaleTimeString("en-PH", defaultTimeOptions);
    return `${dateStr} ${timeStr}`;
  } catch (err) {
    console.error("Error formatting PST date-time:", err);
    return "—";
  }
};

/**
 * Get current date in Philippine Standard Time
 * @returns {Date} Current date in PST
 */
export const getCurrentPSTDate = () => {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
  const pstDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
  const offset = pstDate.getTime() - utcDate.getTime();
  return new Date(now.getTime() + offset);
};

/**
 * Convert a date string (YYYY-MM-DD) from HTML input to PST ISO string
 * The HTML date input provides local date, this converts it properly to PST
 * @param {string} dateString - Date string in YYYY-MM-DD format from HTML input
 * @returns {string} ISO string in PST timezone
 */
export const convertToPhilippineDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // Parse the YYYY-MM-DD string
    const [year, month, day] = dateString.split('-');
    
    // Create a date at midnight in PST (Asia/Manila)
    // We use the toLocaleString method to interpret the date as PST
    const pstDateString = new Date(`${year}-${month}-${day}T00:00:00`).toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // Parse back to get UTC equivalent
    const [datePart, timePart] = pstDateString.split(', ');
    const [m, d, y] = datePart.split('/');
    const [h, min, s] = timePart.split(':');
    
    // Create the date in UTC that represents midnight in PST
    const date = new Date(`${y}-${m}-${d}T${h}:${min}:${s}Z`);
    
    // Adjust for the timezone offset (PST is UTC+8)
    const offsetMinutes = 8 * 60; // 480 minutes
    const adjustedDate = new Date(date.getTime() - offsetMinutes * 60 * 1000);
    
    return adjustedDate.toISOString();
  } catch (err) {
    console.error("Error converting date to PST:", err);
    return dateString; // Fallback to original string
  }
};

/**
 * Format date in full locale format for Philippine Standard Time
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} Formatted full date string (e.g., "May 15, 2026")
 */
export const formatPSTFullDate = (dateInput) => {
  if (!dateInput) return "—";
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Manila",
    });
  } catch (err) {
    console.error("Error formatting PST full date:", err);
    return "—";
  }
};
