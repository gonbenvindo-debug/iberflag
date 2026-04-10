async function runNonBlockingAction(label, action) {
    try {
        return await action();
    } catch (error) {
        console.warn(`${label}:`, error);
        return null;
    }
}

module.exports = {
    runNonBlockingAction
};
