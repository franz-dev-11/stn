import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	throw new Error(
		"Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.",
	);
}

const isLikelySupabaseUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(
	supabaseUrl,
);

if (!isLikelySupabaseUrl) {
	throw new Error(
		"Invalid VITE_SUPABASE_URL format. Expected https://<project-ref>.supabase.co",
	);
}

// Initialize Supabase client with proper session persistence and RLS support
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		// Persist session to localStorage so it survives page refreshes
		storage: window.localStorage,
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true, // Auto-detect session from URL (for email verification links)
	},
	global: {
		// Add auth headers to all requests for RLS enforcement
		headers: {
			"x-client-info": "@supabase/supabase-js/browser",
		},
	},
});

// Function to refresh auth session and ensure RLS token is valid
export const refreshAuthSession = async () => {
	try {
		const { data, error } = await supabase.auth.refreshSession();
		if (error) {
			console.error("Session refresh error:", error);
			return null;
		}
		return data.session;
	} catch (err) {
		console.error("Failed to refresh session:", err);
		return null;
	}
};

// Function to ensure valid session before making RLS-protected queries
export const ensureAuthSession = async () => {
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session) {
		throw new Error("No active session. User must be authenticated.");
	}

	// Optionally refresh if close to expiry (5 minutes)
	const expiresAt = session.expires_at * 1000;
	const now = Date.now();
	const timeUntilExpiry = expiresAt - now;

	if (timeUntilExpiry < 5 * 60 * 1000) {
		return await refreshAuthSession();
	}

	return session;
};
