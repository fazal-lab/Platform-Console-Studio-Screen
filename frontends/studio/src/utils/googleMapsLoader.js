/**
 * Google Maps JavaScript API loader (singleton).
 * Loads the script once and resolves with the `google.maps` namespace.
 */

let loadPromise = null;

export function loadGoogleMaps() {
    if (loadPromise) return loadPromise;

    loadPromise = new Promise((resolve, reject) => {
        // Already loaded (e.g. via another script tag)
        if (window.google?.maps?.places) {
            console.log('[GoogleMapsLoader] Already loaded');
            resolve(window.google.maps);
            return;
        }

        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        console.log('[GoogleMapsLoader] API key present:', !!apiKey, apiKey ? `(${apiKey.substring(0, 8)}...)` : '(none)');

        if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
            console.warn('[GoogleMapsLoader] No API key found – set VITE_GOOGLE_MAPS_API_KEY in .env');
            reject(new Error('Missing Google Maps API key'));
            loadPromise = null; // allow retry
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            console.log('[GoogleMapsLoader] Script loaded, google.maps:', !!window.google?.maps);
            if (window.google?.maps) {
                resolve(window.google.maps);
            } else {
                reject(new Error('Google Maps loaded but google.maps is undefined'));
                loadPromise = null;
            }
        };

        script.onerror = (err) => {
            console.error('[GoogleMapsLoader] Script failed to load:', err);
            reject(new Error('Failed to load Google Maps script'));
            loadPromise = null;
        };

        document.head.appendChild(script);
    });

    return loadPromise;
}
