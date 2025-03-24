"use client"

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Updated reviewer profiles with multiple fields of interest
const reviewerProfiles = [
  {
    name: "Dr. Jane Smith",
    email: "jane.smith@university.edu",
    fieldsOfInterest: ["Artificial Intelligence and Machine Learning", "Big Data and Data Analytics"],
    department: "Computer Science",
    institution: "University of Technology"
  },
  {
    name: "Prof. John Davis",
    email: "j.davis@research.org",
    fieldsOfInterest: ["Artificial Intelligence and Machine Learning", "Networking and Distributed Systems"],
    department: "Information Sciences",
    institution: "Research Institute"
  },
  {
    name: "Dr. Sarah Chen",
    email: "schen@institute.ac",
    fieldsOfInterest: ["Human-Computer Interaction", "Big Data and Data Analytics"],
    department: "Electrical Engineering",
    institution: "Global Institute of Technology"
  },
  {
    name: "Prof. Michael Johnson",
    email: "mjohnson@tech.edu",
    fieldsOfInterest: ["Human-Computer Interaction", "Networking and Distributed Systems"],
    department: "Mechanical Engineering",
    institution: "Tech University"
  },
  {
    name: "Dr. Emily White",
    email: "e.white@science.org",
    fieldsOfInterest: ["Cybersecurity", "Networking and Distributed Systems"],
    department: "Digital Sciences",
    institution: "Science Academy"
  }
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

  // Handle profile selection with enhanced filtering
  const handleProfileChange = (profileName: string) => {
    setSelectedProfile(profileName);

    if (profileName === "none") {
      // Reset form if no profile selected
      setReviewerName("");
      setReviewerEmail("");
      setFilteredFiles(availableFiles);

      // Log the profile deselection event
      try {
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'Profile Deselected',
            actor: 'User', // Replace with actual user identifier if available
            target: 'None',
          }),
        });
      } catch (err) {
        console.error('Failed to log profile deselection:', err);
      }

      return;
    }

    // Find the selected profile
    const profile = reviewerProfiles.find(p => p.name === profileName);

    if (profile) {
      // Set reviewer information
      setReviewerName(profile.name);
      setReviewerEmail(profile.email);

      // Filter files based on ANY field of interest in the profile
      const filtered = availableFiles.filter(file =>
        profile.fieldsOfInterest.some(field =>
          file.category.toLowerCase().includes(field.toLowerCase())
        )
      );

      setFilteredFiles(filtered);

      // Reset selected PDF if it's not in the filtered list
      if (filtered.length > 0 && !filtered.some(f => f.filePath === selectedPdf)) {
        setSelectedPdf("");
      }

      // Log the profile selection event
      try {
        fetch('/api/logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'Profile Selected',
            actor: profile.email,
            target: profile.name,
          }),
        });
      } catch (err) {
        console.error('Failed to log profile selection:', err);
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

        // Log the review submission event
        try {
          fetch('/api/logs', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'Review Submitted',
              actor: reviewerEmail,
              target: selectedPdf,
            }),
          });
        } catch (err) {
          console.error('Failed to log review submission:', err);
        }

        try {
          const selectedFile = availableFiles.find(file => file.filePath === selectedPdf);
          if (selectedFile) {
            await fetch("/api/review", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                trackingNumber: selectedFile.trackingNumber,
                review: reviewData,
                reviewerProfile: selectedProfile,
                reviewScore: reviewScore
              }),
            });
          } else {
            console.error("Selected PDF does not match any available files.");
          }
        } catch (error) {
          console.log(error);
        }
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
            {/* Enhanced Profile Selector */}
            <div>
              <Label htmlFor="profile-selection">Select Reviewer Profile</Label>
              <Select value={selectedProfile} onValueChange={handleProfileChange}>
                <SelectTrigger id="profile-selection">
                  <SelectValue placeholder="Select your profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No profile (show all papers)</SelectItem>
                  {reviewerProfiles.map(profile => (
                    <SelectItem key={profile.email} value={profile.name} className="p-2">
                      <div className="flex flex-col gap-1">
                        <div className="font-medium">{profile.name}</div>
                        <div className="text-xs text-gray-500">{profile.department}, {profile.institution}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {profile.fieldsOfInterest.map(field => (
                            <Badge key={field} variant="outline" className="text-xs py-0">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Display Selected Profile Information */}
            {selectedProfile && selectedProfile !== "none" && (
              <div className="bg-gray-100 p-3 rounded-md">
                <h3 className="font-medium">{reviewerName}</h3>
                <p className="text-sm text-gray-600">{reviewerEmail}</p>
                {reviewerProfiles.find(p => p.name === selectedProfile)?.fieldsOfInterest && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {reviewerProfiles.find(p => p.name === selectedProfile)?.fieldsOfInterest.map(field => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

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

            {/* Reviewer Email - Auto-filled and locked from profile */}
            <div>
              <Label htmlFor="reviewer-email">Reviewer Email</Label>
              <Input
                id="reviewer-email"
                type="email"
                placeholder="Enter your email"
                value={reviewerEmail}
                onChange={(e) => setReviewerEmail(e.target.value)}
                disabled={selectedProfile !== "" && selectedProfile !== "none"}
                readOnly={selectedProfile !== "" && selectedProfile !== "none"}
                className={selectedProfile !== "" && selectedProfile !== "none" ? "bg-gray-100" : ""}
              />
            </div>

            {/* Reviewer Name - Auto-filled and locked from profile */}
            <div>
              <Input
                id="reviewer-name"
                placeholder="Enter your name"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                disabled={selectedProfile !== "" && selectedProfile !== "none"}
                readOnly={selectedProfile !== "" && selectedProfile !== "none"}
                className={selectedProfile !== "" && selectedProfile !== "none" ? "bg-gray-100" : ""}
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