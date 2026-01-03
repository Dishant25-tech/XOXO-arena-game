"use client";

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";

export default function SettingsPage() {

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Manage your application settings.</p>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Theme selection is currently disabled.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>The ability to switch themes has been temporarily removed to resolve a build issue.</p>
        </CardContent>
      </Card>
    </div>
  );
}
