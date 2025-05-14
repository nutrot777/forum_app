import React, { useEffect } from 'react';
import { UserProfile } from '@/components/UserProfile';
import { Notifications } from '@/components/Notifications';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BellIcon, UserIcon, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';

export default function Settings() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Set document title
  useEffect(() => {
    document.title = 'Settings - Discussion Forum';
  }, []);

  // Require authentication
  useEffect(() => {
    if (!user) {
      setLocation('/login');
    }
  }, [user, setLocation]);

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-4">
        <Button
          variant="outline"
          onClick={() => setLocation('/')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Discussions
        </Button>
      </div>
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