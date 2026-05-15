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
 * Get current datetime in Philippine Standard Time as ISO string
 * Calculates the actual UTC time that represents the current PST moment
 * @returns {string} Current datetime in ISO format representing PST
 */
export const getCurrentPSTDateTime = () => {
  const now = new Date();
  
  // Get what the current time looks like in both UTC and PST timezones
  const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  
  // Calculate the offset between PST and UTC
  const pstOffset = pstTime.getTime() - utcTime.getTime();
  
  // Apply this offset to the actual current time to get the UTC time that represents this PST moment
  const utcDateTime = new Date(now.getTime() - pstOffset);
  
  return utcDateTime.toISOString();
};

/**
 * Get today's date in Philippine Standard Time as YYYY-MM-DD
 * @returns {string} Today's date in YYYY-MM-DD format in PST
 */
export const getTodayPSTDateString = () => {
  const now = new Date();
  
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  return formatter.format(now);
};

/**
 * Convert a date string (YYYY-MM-DD) from HTML input to ISO string in PST timezone
 * Takes a date like "2026-05-20" and returns ISO string representing that date at midnight PST
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} ISO string representing midnight PST of that date
 */
export const convertToPhilippineDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // Parse the date string
    const date = new Date(dateString + 'T00:00:00');
    
    // PST is UTC+8. To convert a PST time to UTC, we subtract 8 hours
    // So midnight PST = 16:00 UTC of the previous day (minus 8 hours)
    const pstOffsetMs = 8 * 60 * 60 * 1000;
    const utcDate = new Date(date.getTime() - pstOffsetMs);
    
    return utcDate.toISOString();
  } catch (err) {
    console.error("Error converting date to PST:", err);
    return null;
  }
};

/**
 * Convert ISO string to YYYY-MM-DD format for HTML date input in PST
 * @param {string} isoString - ISO date string from database
 * @returns {string} Date string in YYYY-MM-DD format as it appears in PST
 */
export const convertIsoToDateInput = (isoString) => {
  if (!isoString) return "";
  
  try {
    const date = new Date(isoString);
    
    // Format in PST timezone to get the actual date in that timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    return formatter.format(date);
  } catch (err) {
    console.error("Error converting ISO to date input:", err);
    return "";
  }
};

/**
 * Convert ISO string to date-only string for calendar (YYYY-MM-DD)
 * Ensures the date displays correctly in PST timezone for calendar events
 * @param {string} isoString - ISO date string from database
 * @returns {string} Date string in YYYY-MM-DD format for calendar
 */
export const getCalendarDateFromISO = (isoString) => {
  return convertIsoToDateInput(isoString);
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
