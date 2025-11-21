// Remove all existing warning listeners
process.removeAllListeners('warning');

// Store original console methods
const originalWarn = console.warn;
const originalError = console.error;
const originalLog = console.log;
const originalTrace = console.trace;

// Override console.warn to filter transaction warnings
console.warn = function(...args) {
    const message = args[0];
    if (typeof message === 'string') {
        // Filter out transaction warnings and other noise
        if (message.includes('unknown transaction confirmation') ||
            message.includes('deprecated') ||
            message.includes('punycode') ||
            message.includes('mobType') ||
            message.includes('objectType') ||
            message.includes('WARNING :') && message.includes('accepted false')) {
            return;
        }
    }
    originalWarn.apply(console, args);
};

// Also override console.log to catch any warnings that might come through there
console.log = function(...args) {
    const message = args[0];
    if (typeof message === 'string' && message.includes('WARNING : unknown transaction confirmation')) {
        return;
    }
    originalLog.apply(console, args);
};

// Suppress console.trace
console.trace = function(...args) {
    const message = args[0];
    if (typeof message === 'string' && (
        message.includes('entity.mobType') ||
        message.includes('entity.objectType') ||
        message.includes('deprecated')
    )) {
        return;
    }
    originalTrace.apply(console, args);
};

// Suppress process warnings
const originalEmit = process.emitWarning;
process.emitWarning = function(warning, ...args) {
    if (typeof warning === 'string' && (
        warning.includes('entity.mobType') ||
        warning.includes('entity.objectType') ||
        warning.includes('deprecated')
    )) {
        return;
    }
    if (args[0] === 'DeprecationWarning') {
        return;
    }
    return originalEmit.call(this, warning, ...args);
};

module.exports = {};