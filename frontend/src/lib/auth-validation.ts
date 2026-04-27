export const PASSWORD_RULES = {
    minLength: 10,
    maxLength: 72,
    uppercase: /[A-Z]/,
    lowercase: /[a-z]/,
    number: /[0-9]/,
    special: /[^A-Za-z0-9]/,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmailAddress(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
        return 'Email address is required.';
    }
    if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
        return 'Enter a valid email address.';
    }
    return null;
}

export function getPasswordRuleErrors(password: string) {
    const errors: string[] = [];

    if (password.length < PASSWORD_RULES.minLength) {
        errors.push(`At least ${PASSWORD_RULES.minLength} characters`);
    }
    if (password.length > PASSWORD_RULES.maxLength) {
        errors.push(`No more than ${PASSWORD_RULES.maxLength} characters`);
    }
    if (!PASSWORD_RULES.uppercase.test(password)) {
        errors.push('One uppercase letter');
    }
    if (!PASSWORD_RULES.lowercase.test(password)) {
        errors.push('One lowercase letter');
    }
    if (!PASSWORD_RULES.number.test(password)) {
        errors.push('One number');
    }
    if (!PASSWORD_RULES.special.test(password)) {
        errors.push('One special character');
    }

    return errors;
}

export function validateSignupPassword(password: string) {
    if (!password) {
        return 'Password is required.';
    }

    const errors = getPasswordRuleErrors(password);
    if (errors.length > 0) {
        return `Password must include: ${errors.join(', ')}.`;
    }

    return null;
}

export function validateLoginPassword(password: string) {
    if (!password) {
        return 'Password is required.';
    }
    if (password.length > PASSWORD_RULES.maxLength) {
        return `Password cannot be more than ${PASSWORD_RULES.maxLength} characters.`;
    }
    return null;
}
