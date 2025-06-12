import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { BellIcon, CheckIcon, CheckSquareIcon, TrashIcon, XIcon, Maximize2 } from 'lucide-react';

interface NotificationType {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  discussionId?: number;
  replyId?: number;
  triggeredByUser: {
    id: number;
    username: string;
    isOnline: boolean;
  };
}

export function NotificationItem({ notification, onRead, onDelete, onOpenDiscussion }: { 
  notification: NotificationType; 
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
  onOpenDiscussion: (discussionId: number) => void;
}) {
  // Format the date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else if (diffDays < 7) {
      return format(date, 'EEEE') + ' at ' + format(date, 'h:mm a');
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  // Get appropriate icon based on notification type
  const getIcon = () => {
    switch (notification.type) {
      case 'reply':
        return '💬';
      case 'helpful':
        return '👍';
      default:
        return '🔔';
    }
  };

  return (
    <div 
      className={`p-4 border-b last:border-b-0 transition-colors ${notification.isRead ? 'bg-background' : 'bg-muted'}`}
    >
      <div className="flex items-start gap-2">
        <div className="text-xl">{getIcon()}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            {notification.discussionId ? (
              <span
                role="button"
                tabIndex={0}
                className="text-primary hover:underline bg-transparent border-none p-0 m-0 cursor-pointer outline-none"
                style={{ display: 'inline', background: 'none' }}
                onClick={() => onOpenDiscussion(notification.discussionId!)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onOpenDiscussion(notification.discussionId!); }}
              >
                <div dangerouslySetInnerHTML={{ __html: notification.message }} />
              </span>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: notification.message }} />
            )}
            {!notification.isRead && (
              <Badge variant="outline" className="ml-2">New</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatDate(notification.createdAt)}
          </p>
        </div>
        <div className="flex space-x-1">
          {!notification.isRead && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onRead(notification.id)}
              title="Mark as read"
            >
              <CheckIcon className="h-4 w-4" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(notification.id)}
            title="Delete notification"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface NotificationsProps {
  onClosePopover?: () => void;
  onOpenDiscussion: (discussionId: number) => void;
}

export function Notifications({ onClosePopover, onOpenDiscussion }: NotificationsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all notifications
  const { data: notifications, isLoading } = useQuery<NotificationType[]>({
    queryKey: ['/api/notifications', user?.id],
    queryFn: async () => user ? (await apiRequest("GET", `/api/notifications?userId=${user.id}`)).json() : [],
    enabled: !!user,
  });

  // Get unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ['/api/notifications/unread/count', user?.id],
    queryFn: async () => user ? (await apiRequest("GET", `/api/notifications/unread/count?userId=${user.id}`)).json() : { count: 0 },
    enabled: !!user,
  });
  
  const unreadCount = unreadData?.count || 0;

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread/count', user?.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    }
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/notifications/mark-all-read?userId=${user?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread/count', user?.id] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    }
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread/count', user?.id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  });

  // When a notification is clicked, close the popover and call onOpenDiscussion
  const handleOpenDiscussion = (discussionId: number) => {
    if (onClosePopover) onClosePopover();
    onOpenDiscussion(discussionId);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Stay updated on your discussions</CardDescription>
        </div>
        <div className="flex items-center">
          <BellIcon className="mr-2 h-5 w-5" />
          {unreadCount > 0 && (
            <Badge>{unreadCount}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-6">Loading notifications...</div>
        ) : notifications && notifications.length > 0 ? (
          <ScrollArea className="h-[300px]">
            {notifications.map((notification: NotificationType) => (
              <NotificationItem 
                key={notification.id} 
                notification={notification} 
                onRead={(id) => markAsReadMutation.mutate(id)}
                onDelete={(id) => deleteNotificationMutation.mutate(id)}
                onOpenDiscussion={handleOpenDiscussion}
              />
            ))}
          </ScrollArea>
        ) : (
          <div className="text-center p-6 text-muted-foreground">
            No notifications yet
          </div>
        )}
      </CardContent>
      {notifications && notifications.length > 0 && (
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending || unreadCount === 0}
          >
            <CheckSquareIcon className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}