// app/upload/page.tsx
"use client"
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import axios from "axios";
import FileUpload from "@/components/file-upload";

export default function UploadPage() {
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<any>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !file) {
      alert("Please provide both email and file.");
      setLoading(false);
      return;
    }

    try {
      // Create FormData object
      const formData = new FormData();
      formData.append("authorEmail", email);
      formData.append("file", file);
      formData.append("originalFileName", file.name);

      const response = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      const data = response.data;
      setTrackingNumber(data.trackingNumber);
      alert(`Paper uploaded successfully! Tracking Number: ${data.trackingNumber}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error message:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
      alert("Failed to upload paper.");
    } finally {
      setLoading(false);
    }
  };

  // Handle file selection from FilePond
  const handleFileUpdate = (fileItems :any) => {
    if (fileItems.length > 0 && fileItems[0].file) {
      setFile(fileItems[0].file);
    } else {
      setFile(null);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Upload Your Paper</CardTitle>
          <CardDescription>Please provide your email and upload your PDF file.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <FileUpload onupdatefiles={handleFileUpdate} />
            
            <Button type="submit" disabled={loading}>
              {loading ? "Uploading..." : "Submit"}
            </Button>
            
            {trackingNumber && (
              <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md">
                Paper uploaded successfully! Tracking Number: {trackingNumber}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}