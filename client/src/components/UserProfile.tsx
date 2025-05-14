import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const profileFormSchema = z.object({
  email: z.string().email("Must be a valid email").nullish(),
  emailNotifications: z.boolean().default(true),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function UserProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      email: user?.email || "",
      emailNotifications: user?.emailNotifications !== false, // Default to true if not explicitly false
    },
  });

  // Update form with user data when it's available
  useEffect(() => {
    if (user) {
      form.reset({
        email: user.email || "",
        emailNotifications: user.emailNotifications !== false,
      });
    }
  }, [user, form]);

  async function onSubmit(data: ProfileFormValues) {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });

      toast({
        title: "Profile updated",
        description: "Your notification settings have been saved.",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>
          Manage your email notification preferences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="your@email.com" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>
                    Your email address for notifications.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="emailNotifications"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Email Notifications</FormLabel>
                    <FormDescription>
                      Receive email alerts for replies and helpful marks.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save settings"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between text-sm text-muted-foreground">
        <div>
          {!process.env.SENDGRID_API_KEY && (
            <p className="text-amber-500">
              Note: Email delivery is currently disabled. Contact the administrator to enable it.
            </p>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}