// app/upload/page.tsx
"use client"
import { useState } from "react";
import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import axios from "axios";
import FileUpload from "@/components/file-upload";

export default function UploadPage() {
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !file) {
      alert("Please provide both email and file.");
      return;
    }

    const formData = new FormData();
    formData.append("email", email);
    formData.append("file", file);

    console.log("Email:", email);
    console.log("File:", file);
    console.log("Uploading paper...");
    console.log(formData);

    try {
      const response = await axios.post("/api/upload", formData);
      const data = response.data;
      alert(`Paper uploaded successfully! Tracking Number: ${data.trackingNumber}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Error message:', error.message);
      } else {
        console.error('Unexpected error:', error);
      }
      alert("Failed to upload paper.");
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
            {/* <Input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <Button type="submit" className="w-full">
              Upload
            </Button> */}
            <FileUpload />

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
