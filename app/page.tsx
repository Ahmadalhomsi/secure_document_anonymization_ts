// app/upload/page.tsx
"use client"
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import FileUpload from "@/components/file-upload";
import axios from "axios";

export default function UploadPage() {
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    setFileName(newFile?.name || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please provide your email address.");
      return;
    }

    if (!file) {
      setError("Please select a PDF file to upload.");
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("authorEmail", email);
      formData.append("file", file);
      formData.append("originalFileName", file.name);

      const response = await axios.post("/api/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        },
      });

      setTrackingNumber(response.data.trackingNumber);
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.response?.data?.error || "Failed to upload paper. Please try again.");
    } finally {
      setIsSubmitting(false);
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
              disabled={isSubmitting}
            />

            <FileUpload
              onFileChange={handleFileChange}
              isSubmitting={isSubmitting}
            />

            {fileName && (
              <div className="text-sm text-gray-600 mt-2 p-2 bg-gray-100 rounded-md">
                Selected file: {fileName}
              </div>
            )}

            {isSubmitting && (
              <div className="w-full">
                <div className="bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-center mt-1">Uploading: {uploadProgress}%</p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-100 text-red-800 rounded-md">
                {error}
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !email || !file}
            className="w-full"
          >
            {isSubmitting ? "Uploading..." : "Submit"}
          </Button>

          {trackingNumber && (
            <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md w-full">
              Paper uploaded successfully! Your tracking number is: <br />
              <span className="font-bold">{trackingNumber}</span>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}