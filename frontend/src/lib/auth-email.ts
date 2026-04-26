import type { SupabaseClient } from '@supabase/supabase-js';

const EMAIL_CONFIRMATION_PATTERN =
    /(email not confirmed|email.*not.*confirmed|confirm your email|verify your email)/i;
const EXISTING_ACCOUNT_PATTERN = /(already registered|user already registered)/i;

export const EMAIL_CONFIRMATION_REQUIRED_MESSAGE =
    'Please verify your email before signing in. Open the confirmation link we sent to your inbox, then come back and log in.';
export const EXISTING_ACCOUNT_MESSAGE =
    'This email is already registered. If you have not verified it yet, resend the confirmation email below.';
export const DEFAULT_AUTH_ERROR_MESSAGE =
    'Something went wrong. Please try again in a moment.';

export function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

export function getBrowserAuthRedirectUrl(origin: string) {
    return `${origin}/auth/v1/callback`;
}

export function getEmailConfirmationMessage(email: string) {
    return `We sent a confirmation link to ${email}. Open that email and verify your account before signing in for the first time.`;
}

export function getResendConfirmationMessage(email: string) {
    return `We sent a fresh confirmation link to ${email}. Check your inbox and your spam folder.`;
}

export function extractAuthErrorMessage(error: unknown) {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        return typeof message === 'string' ? message : '';
    }

    return '';
}

export function isEmailConfirmationError(error: unknown) {
    return EMAIL_CONFIRMATION_PATTERN.test(extractAuthErrorMessage(error));
}

export function isExistingAccountError(error: unknown) {
    return EXISTING_ACCOUNT_PATTERN.test(extractAuthErrorMessage(error));
}

export function shouldOfferConfirmationResend(error: unknown) {
    return isEmailConfirmationError(error) || isExistingAccountError(error);
}

export function getFriendlyAuthErrorMessage(error: unknown) {
    if (isEmailConfirmationError(error)) {
        return EMAIL_CONFIRMATION_REQUIRED_MESSAGE;
    }

    if (isExistingAccountError(error)) {
        return EXISTING_ACCOUNT_MESSAGE;
    }

    return extractAuthErrorMessage(error) || DEFAULT_AUTH_ERROR_MESSAGE;
}

export async function resendConfirmationEmail({
    supabase,
    email,
    origin,
}: {
    supabase: SupabaseClient;
    email: string;
    origin: string;
}) {
    return supabase.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: getBrowserAuthRedirectUrl(origin),
        },
    });
}
