// components/track-section.tsx
"use client"
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock } from "lucide-react";
import axios from "axios";

interface TrackSectionProps {
    trackingNumber: string;
    setTrackingNumber: (number: string) => void;
}

interface PaperStatus {
    id: string;
    status: "pending" | "accepted" | "rejected" | string; // Allow for other statuses
    originalFileName: string;
    submitDate: string;
    reviewDate?: string;
    feedback?: string;
}

export function TrackSection({ trackingNumber, setTrackingNumber }: TrackSectionProps) {
    const [inputTrackingNumber, setInputTrackingNumber] = useState(trackingNumber);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [paperStatus, setPaperStatus] = useState<PaperStatus | null>(null);

    const handleTrack = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!inputTrackingNumber.trim()) {
            setError("Please enter a tracking number");
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.get('/api/paperStatus', {
                params: { trackingNumber: inputTrackingNumber }
            });
            console.log('Paper:', response.data);
            setPaperStatus(response.data.paper);
            setTrackingNumber(inputTrackingNumber);
        } catch (error: any) {
            console.error("Tracking error:", error);
            setError(error.response?.data?.error || "Failed to retrieve paper status. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "accepted":
                return <CheckCircle className="h-8 w-8 text-green-500" />;
            case "rejected":
                return <XCircle className="h-8 w-8 text-red-500" />;
            default:
                return <Clock className="h-8 w-8 text-amber-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "accepted":
                return "bg-green-50 border-green-200";
            case "rejected":
                return "bg-red-50 border-red-200";
            default:
                return "bg-amber-50 border-amber-200";
        }
    };

    return (
        <>
            <CardContent>
                <form onSubmit={handleTrack} className="space-y-4">
                    <div className="flex space-x-2">
                        <Input
                            placeholder="Enter tracking number"
                            value={inputTrackingNumber}
                            onChange={(e) => setInputTrackingNumber(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        <Button
                            type="submit"
                            disabled={isLoading || !inputTrackingNumber.trim()}
                        >
                            {isLoading ? "Checking..." : "Check Status"}
                        </Button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-100 text-red-800 rounded-md">
                            {error}
                        </div>
                    )}

                    {paperStatus && (
                        <div className={`p-4 border rounded-md mt-4 ${getStatusColor(paperStatus.status)}`}>
                            <div className="flex items-start">
                                {getStatusIcon(paperStatus.status)}
                                <div className="ml-4 flex-1">
                                    <h3 className="font-medium text-lg">
                                        {paperStatus.originalFileName}
                                    </h3>
                                    <div className="mt-2 space-y-2">
                                        <div className="text-sm">
                                            <span className="font-medium">Status:</span> {paperStatus.status ? paperStatus.status.charAt(0).toUpperCase() + paperStatus.status.slice(1) : "Unknown"}
                                        </div>
                                        <div className="text-sm">
                                            <span className="font-medium">Submission Date:</span> {paperStatus.submitDate}
                                        </div>
                                        {paperStatus.reviewDate && (
                                            <div className="text-sm">
                                                <span className="font-medium">Review Date:</span> {paperStatus.reviewDate}
                                            </div>
                                        )}
                                        {paperStatus.feedback && (
                                            <div className="mt-3 p-3 bg-white bg-opacity-50 rounded text-sm">
                                                <span className="font-medium block mb-1">Feedback:</span>
                                                {paperStatus.feedback}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </form>
            </CardContent>

            <CardFooter className="text-sm text-gray-500">
                {!paperStatus && !error && (
                    <p>Enter your tracking number to check the status of your paper submission.</p>
                )}
            </CardFooter>
        </>
    );
}