// app/page.tsx
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <h1 className="text-4xl font-bold mb-4">Secure Document Anonymization System</h1>
      <p className="text-lg text-gray-600 mb-8 text-center">
        Upload your academic papers, track their status, and receive anonymous reviews.
      </p>
      <div className="flex gap-4">
        <Link href="/upload">
          <Button>Upload Paper</Button>
        </Link>
        <Link href="/status">
          <Button variant="outline">Check Status</Button>
        </Link>
      </div>
    </div>
  );
}