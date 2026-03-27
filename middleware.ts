import { createServerClient, parse, serialize } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * NEXT.JS MIDDLEWARE FOR SUPABASE RLS PROTECTION
 *
 * This middleware ensures:
 * 1. Auth sessions are passed from browser to server
 * 2. Session tokens are refreshed when stale
 * 3. RLS policies always have valid credentials
 * 4. Cookies stay synced between client and server
 */

export async function middleware(request: NextRequest) {
	let supabaseResponse = NextResponse.next({
		request,
	});

	// Create a Supabase server client with the request/response for cookie handling
	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				// Get cookies from the request
				getAll() {
					return parse(request.headers.get("cookie") ?? "");
				},
				// Set cookies in the response
				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) => {
						supabaseResponse.cookies.set(name, value, options);
					});
				},
			},
		}
	);

	// Get the current session (this may trigger a refresh if using refresh tokens)
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// IMPORTANT: Even if there's no user, we need to keep auth state synced
	// This ensures the session cookie is properly maintained for RLS

	// Protect specific routes - redirect unauthenticated users
	if (!user && isProtectedRoute(request.nextUrl.pathname)) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/login";
		redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
		return NextResponse.redirect(redirectUrl);
	}

	// Redirect authenticated users away from auth pages
	if (
		user &&
		(request.nextUrl.pathname === "/login" ||
			request.nextUrl.pathname === "/signup")
	) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	// Return the response with updated cookies
	return supabaseResponse;
}

// Configure which routes use the middleware
export const config = {
	matcher: [
		// Include all routes
		"/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)",
	],
};

/**
 * Helper function to determine which routes require authentication
 */
function isProtectedRoute(pathname: string): boolean {
	const protectedPaths = [
		"/dashboard",
		"/inventory",
		"/procurement",
		"/sales",
		"/admin",
	];

	return protectedPaths.some((path) => pathname.startsWith(path));
}
