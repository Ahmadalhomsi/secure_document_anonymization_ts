// components/upload-section.tsx
"use client"
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import FileUpload from "@/components/file-upload";
import axios from "axios";

interface UploadSectionProps {
  email: string;
  setEmail: (email: string) => void;
  setTrackingNumber: (number: string) => void;
  onUploadSuccess: () => void;
}

interface CategoryResult {
  pdf_filename: string;
  primary_category: string;
  category_scores: Record<string, number>;
}

export function UploadSection({
  email,
  setEmail,
  setTrackingNumber,
  onUploadSuccess
}: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState("");
  const [categoryResult, setCategoryResult] = useState<CategoryResult | null>(null);
  const [isCategorizing, setIsCategorizing] = useState(false);

  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    setFileName(newFile?.name || "");
    setCategoryResult(null); // Reset category result when changing file
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setCategoryResult(null);

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

      const trackingNum = response.data.trackingNumber;
      setTrackingNumber(trackingNum);
      setSuccessMessage(`Paper uploaded successfully! Your tracking number is: ${trackingNum} `);

      // Log the file upload event
      await axios.post("/api/logs", {
        action: "File Upload",
        actor: email,
        target: file.name,
      });

      // Start categorization
      setIsCategorizing(true);
      // Modified axios request to correctly send the pdf_filename
      try {
        const categorizeData = new FormData();
        categorizeData.append("pdf_filename", response.data.fileName);

        // For debugging
        console.log("Sending pdf_filename:", response.data.fileName);

        const response2 = await axios.post("/api/py/categorize",
          response.data.fileName,  // Send just the filename string
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        // Log the categorization event
        await axios.post("/api/logs", {
          action: "Categorization",
          actor: email,
          target: response.data.fileName,
        });

        try {
          await axios.post("/api/categorize", {
            trackingNumber: trackingNum,
            category: response2.data.primary_category,
          });
        } catch (error) {
          console.log("Error updating category:", error);
          setError("Failed to update category.");
        }

        console.log("Categorization response:", response2.data);
        setCategoryResult(response2.data);
      } catch (error: any) {
        console.error("Categorization error:", error);
        console.error("Error details:", error.response?.data);
        setError(prev => prev ? `${prev}. Categorization failed.` : "Categorization failed.");
      }
      setIsCategorizing(false);

      onUploadSuccess();
    } catch (error: any) {
      console.error("Upload error:", error);
      setError(error.response?.data?.error || "Failed to upload paper. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Function to render category scores as a bar chart
  const renderCategoryScores = () => {
    if (!categoryResult?.category_scores) return null;

    return (
      <div className="mt-4 space-y-2 w-full">
        <h4 className="font-medium text-sm">Category Analysis:</h4>
        {Object.entries(categoryResult.category_scores)
          .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
          .map(([category, score]) => (
            <div key={category} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{category}</span>
                <span>{score.toFixed(1)}%</span>
              </div>
              <div className="bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>
          ))}
      </div>
    );
  };

  return (
    <>
      <CardContent>
        <form onSubmit={handleUploadSubmit} className="space-y-4">
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

          {isCategorizing && (
            <div className="text-sm text-center mt-1">
              <p>Analyzing document content...</p>
              <div className="mt-2 flex justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
              </div>
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
          onClick={handleUploadSubmit}
          disabled={isSubmitting || isCategorizing || !email || !file}
          className="w-full"
        >
          {isSubmitting ? "Uploading..." : "Submit"}
        </Button>

        {successMessage && (
          <div className="mt-4 p-3 bg-green-100 text-green-800 rounded-md w-full">
            {successMessage}

            {categoryResult && (
              <div className="mt-3 border-t pt-3">
                <div className="font-medium mb-2">Document Category:
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                    {categoryResult.primary_category}
                  </span>
                </div>
                {renderCategoryScores()}
              </div>
            )}

            <Button
              variant="link"
              className="p-0 h-auto mt-2"
              onClick={onUploadSuccess}
            >
              Need help? Chat with the manager
            </Button>
          </div>
        )}
      </CardFooter>
    </>
  );
}