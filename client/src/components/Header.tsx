import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Rows3, Settings, BellIcon, Users, XIcon, Maximize2 } from "lucide-react";
import UserSection from "./UserSection";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Notifications } from "./Notifications";
import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import DiscussionThread from "@/components/DiscussionThread";
import { Skeleton } from "@/components/ui/skeleton";
import type { DiscussionWithDetails } from "../../../shared/schema";

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverShouldClose = useRef(false);

  // Modal state lifted here
  const [openDiscussion, setOpenDiscussion] = useState<DiscussionWithDetails | null>(null);
  const [loadingDiscussion, setLoadingDiscussion] = useState(false);
  const [expandModal, setExpandModal] = useState(true); // Always expanded by default

  const handleLogout = () => {
    logout();
  };

  // This callback will be called by Notifications after the modal is open and data is loaded
  const handleRequestPopoverClose = () => {
    popoverShouldClose.current = true;
    setTimeout(() => {
      setPopoverOpen(false);
      popoverShouldClose.current = false;
    }, 100); // Delay to ensure Dialog is open before Popover closes
  };

  // Called by Notifications when a notification is clicked
  const handleOpenDiscussion = async (discussionId: number) => {
    setLoadingDiscussion(true);
    setOpenDiscussion(null);
    handleRequestPopoverClose();
    try {
      const res = await fetch(`/api/discussions/${discussionId}`);
      if (!res.ok) throw new Error('Failed to fetch discussion');
      const data = await res.json();
      setOpenDiscussion(data);
    } catch (e) {
      setOpenDiscussion(null);
    } finally {
      setLoadingDiscussion(false);
    }
  };

  return (
    <header className="bg-white shadow sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Rows3 className="text-[#0079D3] h-6 w-6 mr-2" />
          <h1 className="text-xl font-ibm font-semibold">StudentForum</h1>
        </Link>
        {user && (
          <div className="flex items-center space-x-4">
            <Popover open={popoverOpen} onOpenChange={open => {
              // Prevent popover from closing if we're opening the modal
              if (!open && popoverShouldClose.current) return;
              setPopoverOpen(open);
            }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative rounded-full text-gray-700 hover:bg-gray-100">
                  <BellIcon className="h-5 w-5" />
                  <NotificationCountBadge />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-96 max-w-full">
                <Notifications onClosePopover={handleRequestPopoverClose} onOpenDiscussion={handleOpenDiscussion} />
              </PopoverContent>
            </Popover>
            <TotalUsersBadge />
            <UserSection />
            <Link href="/settings">
              <Button 
                variant="ghost"
                size="icon"
                className="rounded-full text-gray-700 hover:bg-gray-100"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button 
              className="rounded-full px-4 py-1.5 bg-[#0079D3] text-white text-sm font-medium hover:bg-[#0079D3]/90 transition-colors"
              onClick={handleLogout}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </Button>
          </div>
        )}
      </div>
      {/* Modal rendered at header level */}
      <Dialog open={!!openDiscussion || loadingDiscussion} onOpenChange={(open) => {
        if (!open) {
          setOpenDiscussion(null);
          setLoadingDiscussion(false);
        }
      }}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Removed DialogTitle, header, and expand icon for a cleaner modal */}
          <div className="p-2">
            {loadingDiscussion && (
              <Skeleton className="h-40 w-full rounded-lg" />
            )}
            {openDiscussion && (
              <DiscussionThread discussion={openDiscussion} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

// NotificationCountBadge component
function NotificationCountBadge() {
  const { user } = useAuth();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread/count"],
    enabled: !!user,
  });
  if (!user || !data?.count) return null;
  return (
    <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
      {data.count}
    </Badge>
  );
}

// TotalUsersBadge component
function TotalUsersBadge() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/users/count"],
  });
  if (typeof data?.count !== "number" || isNaN(data.count)) return null;
  return (
    <div className="flex items-center text-gray-700 text-sm font-medium ml-2">
      <Users className="h-5 w-5 mr-1" />
      <span>{data.count} users</span>
    </div>
  );
}

export default Header;
