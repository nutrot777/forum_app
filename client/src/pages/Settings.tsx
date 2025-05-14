import React from 'react';
import { UserProfile } from '@/components/UserProfile';
import { Notifications } from '@/components/Notifications';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BellIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'wouter';
import { useTitle } from '@/hooks/use-title';

export default function Settings() {
  const { user } = useAuth();
  useTitle('Settings - Discussion Forum');

  // Require authentication
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl">Settings</CardTitle>
          <CardDescription>
            Manage your account settings and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="profile" className="space-y-4">
            <TabsList>
              <TabsTrigger value="profile">
                <UserIcon className="mr-2 h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="notifications">
                <BellIcon className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
            </TabsList>
            <TabsContent value="profile" className="p-4">
              <UserProfile />
            </TabsContent>
            <TabsContent value="notifications" className="p-4">
              <Notifications />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}