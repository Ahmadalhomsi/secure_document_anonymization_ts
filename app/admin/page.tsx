// app/admin/page.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminPage() {
  // Example data
  const papers = [
    { id: "1", title: "Paper 1", status: "Pending", assignedReviewer: "Reviewer A" },
    { id: "2", title: "Paper 2", status: "Under Review", assignedReviewer: "Reviewer B" },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>Manage papers and assign reviewers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paper ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Reviewer</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {papers.map((paper) => (
                <TableRow key={paper.id}>
                  <TableCell>{paper.id}</TableCell>
                  <TableCell>{paper.title}</TableCell>
                  <TableCell>{paper.status}</TableCell>
                  <TableCell>{paper.assignedReviewer}</TableCell>
                  <TableCell>
                    <Button variant="outline">Assign Reviewer</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}