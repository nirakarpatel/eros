'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the LiveMap with SSR disabled to avoid Leaflet window errors
const LiveMap = dynamic(() => import('./LiveMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-[600px] bg-slate-900 flex items-center justify-center border border-slate-800 rounded-xl">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-mono text-sm animate-pulse">Initializing Realistic Map Link...</p>
            </div>
        </div>
    )
});

export default function MapPlaceholder() {
    return (
        <div className="w-full h-[600px]">
            <LiveMap />
        </div>
    );
}
