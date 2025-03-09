// app/status/page.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function StatusPage() {
  // Example data
  const papers = [
    { trackingNumber: "12345", status: "Under Review" },
    { trackingNumber: "67890", status: "Reviewed" },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Paper Status</CardTitle>
          <CardDescription>Track the status of your uploaded papers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking Number</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {papers.map((paper) => (
                <TableRow key={paper.trackingNumber}>
                  <TableCell>{paper.trackingNumber}</TableCell>
                  <TableCell>{paper.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}