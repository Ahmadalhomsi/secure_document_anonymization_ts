// app/upload/page.tsx
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function UploadPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Upload Your Paper</CardTitle>
          <CardDescription>Please provide your email and upload your PDF file.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <Input type="email" placeholder="Enter your email" required />
            <Input type="file" accept=".pdf" required />
            <Button type="submit" className="w-full">
              Upload
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}