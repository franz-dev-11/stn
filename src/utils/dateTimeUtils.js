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
