"use client"

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Sample reviewer profiles
const reviewerProfiles = [
  { name: "Dr. Jane Smith", email: "jane.smith@university.edu", fieldOfInterest: "Machine Learning" },
  { name: "Prof. John Davis", email: "j.davis@research.org", fieldOfInterest: "Natural Language Processing" },
  { name: "Dr. Sarah Chen", email: "schen@institute.ac", fieldOfInterest: "Computer Vision" },
  { name: "Prof. Michael Johnson", email: "mjohnson@tech.edu", fieldOfInterest: "Robotics" },
  { name: "Dr. Emily White", email: "e.white@science.org", fieldOfInterest: "Cybersecurity" }
];

export default function ReviewerPage() {
  interface Paper {
    trackingNumber: string;
    filePath: string;
    category: string;
  }

  const [availableFiles, setAvailableFiles] = useState<Paper[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<Paper[]>([]);
  const [selectedPdf, setSelectedPdf] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewScore, setReviewScore] = useState(0);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [selectedProfile, setSelectedProfile] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch available PDFs when the component mounts
  useEffect(() => {
    const fetchAvailableFiles = async () => {
      try {
        const response = await fetch("/api/list-processed");
        if (!response.ok) {
          throw new Error("Failed to fetch PDF list");
        }
        const data = await response.json();
        console.log("Available PDFs:", data.files);
        setAvailableFiles(data.files || []);
        setFilteredFiles(data.files || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load PDF files");
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchAvailableFiles();
  }, []);

  // Handle profile selection
  const handleProfileChange = (profileName: string) => {
    setSelectedProfile(profileName);
    
    if (profileName === "none") {
      // Reset form if no profile selected
      setReviewerName("");
      setReviewerEmail("");
      setFilteredFiles(availableFiles);
      return;
    }
    
    // Find the selected profile
    const profile = reviewerProfiles.find(p => p.name === profileName);
    
    if (profile) {
      // Set reviewer information
      setReviewerName(profile.name);
      setReviewerEmail(profile.email);
      
      // Filter files based on field of interest
      const filtered = availableFiles.filter(file => 
        file.category.toLowerCase().includes(profile.fieldOfInterest.toLowerCase())
      );
      
      setFilteredFiles(filtered);
      
      // Reset selected PDF if it's not in the filtered list
      if (filtered.length > 0 && !filtered.some(f => f.filePath === selectedPdf)) {
        setSelectedPdf("");
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedPdf) {
      alert("Please select a PDF file.");
      return;
    }

    const reviewData = {
      pdf_filename: selectedPdf,
      review_text: reviewText,
      review_score: reviewScore,
      review_date: new Date().toISOString(), // Automatically set the current date
      reviewer_email: reviewerEmail,
      reviewer_name: reviewerName,
    };

    try {
      const response = await fetch("/api/py/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reviewData),
      });

      if (response.ok) {
        alert("Review submitted successfully!");
      } else {
        alert("Failed to submit review.");
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      alert("An error occurred while submitting the review.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Reviewer Panel</CardTitle>
          <CardDescription>Evaluate the assigned papers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Profile Selector */}
            <div>
              <Label htmlFor="profile-selection">Select Reviewer Profile</Label>
              <Select value={selectedProfile} onValueChange={handleProfileChange}>
                <SelectTrigger id="profile-selection">
                  <SelectValue placeholder="Select your profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No profile (show all papers)</SelectItem>
                  {reviewerProfiles.map(profile => (
                    <SelectItem key={profile.email} value={profile.name}>
                      {profile.name} - {profile.fieldOfInterest}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <h2 className="text-xl font-semibold">Paper Title</h2>
            <p className="text-gray-600">Anonymized content of the paper...</p>

            {/* PDF Selection */}
            <div>
              <Label htmlFor="pdf-selection">Select PDF</Label>
              {loadingFiles ? (
                <p>Loading PDFs...</p>
              ) : error ? (
                <p className="text-red-500">{error}</p>
              ) : (
                <Select value={selectedPdf} onValueChange={setSelectedPdf}>
                  <SelectTrigger id="pdf-selection">
                    <SelectValue placeholder="Select a PDF" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredFiles.length === 0 ? (
                      <SelectItem value="no-files-available">No matching PDFs available</SelectItem>
                    ) : (
                      filteredFiles.map(file => (
                        <SelectItem key={file.filePath} value={file.filePath}>
                          {file.filePath} ({file.category})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Review Text */}
            <div>
              <Label htmlFor="review-text">Review Comments</Label>
              <Textarea
                id="review-text"
                placeholder="Enter your review comments..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
              />
            </div>

            {/* Review Score */}
            <div>
              <Label htmlFor="review-score">Review Score</Label>
              <Input
                id="review-score"
                type="number"
                step="0.1"
                placeholder="Enter review score (e.g., 4.5)"
                value={reviewScore}
                onChange={(e) => setReviewScore(parseFloat(e.target.value))}
              />
            </div>

            {/* Reviewer Email - Auto-filled from profile */}
            <div>
              <Label htmlFor="reviewer-email">Reviewer Email</Label>
              <Input
                id="reviewer-email"
                type="email"
                placeholder="Enter your email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
              />
            </div>

            {/* Reviewer Name - Auto-filled from profile */}
            <div>
              <Label htmlFor="reviewer-name">Reviewer Name</Label>
              <Input
                id="reviewer-name"
                placeholder="Enter your name"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
              />
            </div>

            {/* Submit Button */}
            <Button onClick={handleSubmit}>Submit Review</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}