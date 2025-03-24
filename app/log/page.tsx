'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";


// Define the Log type to match your Prisma schema
interface Log {
    id: string;
    action: string;
    actor: string;
    target: string;
    createdAt: Date;
}

export default function LogsPage() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isClearingLogs, setIsClearingLogs] = useState(false);

    // Fetch logs function
    const fetchLogs = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get('http://localhost:3000/api/logs');
            setLogs(response.data);
        } catch (err) {
            console.error('Error fetching logs:', err);
            setLogs([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Clear logs function
    const clearLogs = async () => {
        try {
            setIsClearingLogs(true);
            await axios.delete('http://localhost:3000/api/logs');
            await fetchLogs(); // Refresh logs after clearing
            alert("All logs have been successfully deleted.")
        } catch (err) {
            console.error('Error clearing logs:', err);
            alert(`Error clearing logs: ${err}`)

        } finally {
            setIsClearingLogs(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>System Logs</CardTitle>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={clearLogs}
                        disabled={logs.length === 0 || isClearingLogs}
                    >
                        {isClearingLogs ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Clear Logs
                    </Button>
                </CardHeader>
                <CardContent>
                    {logs.length === 0 ? (
                        <p className="text-center text-muted-foreground">No logs found</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Actor</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>Timestamp</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>
                                            <Badge variant="secondary">{log.action}</Badge>
                                        </TableCell>
                                        <TableCell>{log.actor}</TableCell>
                                        <TableCell>{log.target}</TableCell>
                                        <TableCell>
                                            {new Date(log.createdAt).toLocaleString()}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}