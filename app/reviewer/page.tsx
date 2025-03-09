// app/reviewer/page.tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ReviewerPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Reviewer Panel</CardTitle>
          <CardDescription>Evaluate the assigned papers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Paper Title</h2>
            <p className="text-gray-600">Anonymized content of the paper...</p>
            <Textarea placeholder="Enter your review comments..." />
            <Button>Submit Review</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}