"use client"
import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UploadSection } from "@/components/upload-section";
import { ChatSection } from "@/components/chat-section";
import { TrackSection } from "@/components/track-section";

export default function UploadPage() {
  const [email, setEmail] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [activeTab, setActiveTab] = useState("upload");
  
  // Check if websocket is connected (would be managed by ChatSection in a real app)
  // This is just a mock for showing the offline badge
  const [isConnected, setIsConnected] = useState(true);
  
  const handleUploadSuccess = () => {
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Paper Submission Portal</CardTitle>
          <CardDescription>Upload your paper, track its status, and chat with our support team</CardDescription>
        </CardHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Paper</TabsTrigger>
            <TabsTrigger value="chat">
              Support Chat
              {!isConnected && <Badge variant="destructive" className="ml-2">Offline</Badge>}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload">
            <UploadSection 
              email={email}
              setEmail={setEmail}
              setTrackingNumber={setTrackingNumber}
              onUploadSuccess={handleUploadSuccess}
            />
          </TabsContent>
          
          <TabsContent value="chat">
            {trackingNumber && (
              <Alert className="mb-4 bg-blue-50 border-blue-200">
                <AlertDescription>
                  Your paper has been submitted successfully. Tracking number: <span className="font-bold">{trackingNumber}</span>
                </AlertDescription>
              </Alert>
            )}
            <ChatSection 
              email={email}
              trackingNumber={trackingNumber}
            />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}