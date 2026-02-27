import React, { createContext, useContext, useState, useCallback } from 'react';

/**
 * XiaPageContext — global context for page & content awareness
 *
 * Any page can call setXiaContext({ page, ... }) to publish live content.
 * XiaAssistant reads this and sends it as page_context with every API call.
 *
 * SCHEMA per page:
 * {
 *   page: string,           // machine-readable page key
 *   page_label: string,     // human-readable label XIA sees
 *   summary: string,        // one-line description of what user sees right now
 *   data: object            // rich structured data of what's on screen
 * }
 */

const XiaContext = createContext(null);

export const XIA_DISABLED_PAGES = ['/billing', '/invoices', '/secure-checkout'];

export function XiaContextProvider({ children }) {
    const [pageContext, setPageContextState] = useState(null);

    const setPageContext = useCallback((ctx) => {
        setPageContextState(ctx);
    }, []);

    const clearPageContext = useCallback(() => {
        setPageContextState(null);
    }, []);

    return (
        <XiaContext.Provider value={{ pageContext, setPageContext, clearPageContext }}>
            {children}
        </XiaContext.Provider>
    );
}

export function useXiaContext() {
    const ctx = useContext(XiaContext);
    if (!ctx) throw new Error('useXiaContext must be used inside XiaContextProvider');
    return ctx;
}
