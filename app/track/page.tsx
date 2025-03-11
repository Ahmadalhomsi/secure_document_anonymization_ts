"use client"
import { TrackSection } from "@/components/track-section";
import { useState } from "react";


export default function TrackPage() {
    const [trackingNumber, setTrackingNumber] = useState("");

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
            <TrackSection 
                trackingNumber={trackingNumber}
                setTrackingNumber={setTrackingNumber}
            />
        </div>
    );
}
