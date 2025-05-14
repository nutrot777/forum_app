import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, MessageSquare, Bookmark, Share, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Replies from "./Replies";
import { DiscussionWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface DiscussionThreadProps {
  discussion: DiscussionWithDetails;
}

const DiscussionThread: React.FC<DiscussionThreadProps> = ({ discussion }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showReplies, setShowReplies] = useState(true);
  const [isMarked, setIsMarked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(discussion.title);
  const [editContent, setEditContent] = useState(discussion.content);
  const [helpfulCount, setHelpfulCount] = useState(discussion.helpfulCount || 0);

  // Check if current user has marked this discussion as helpful
  const checkIfMarkedAsHelpful = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/helpful/check?userId=${user.id}&discussionId=${discussion.id}`);
      const data = await response.json();
      setIsMarked(data.isMarked);
    } catch (error) {
      console.error("Failed to check helpful status:", error);
    }
  };

  // Run on component mount
  useEffect(() => {
    checkIfMarkedAsHelpful();
  }, []);

  const handleToggleHelpful = async () => {
    if (!user) return;
    
    try {
      if (isMarked) {
        await apiRequest("DELETE", "/api/helpful", {
          userId: user.id,
          discussionId: discussion.id
        });
        setHelpfulCount(prev => Math.max(0, (prev || 0) - 1));
      } else {
        await apiRequest("POST", "/api/helpful", {
          userId: user.id,
          discussionId: discussion.id
        });
        setHelpfulCount(prev => (prev || 0) + 1);
      }
      setIsMarked(!isMarked);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark as helpful",
        variant: "destructive",
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!user || user.id !== discussion.userId) return;
    
    try {
      await apiRequest("PATCH", `/api/discussions/${discussion.id}`, {
        userId: user.id,
        title: editTitle,
        content: editContent
      });
      
      toast({
        title: "Success",
        description: "Discussion updated successfully",
      });
      
      // Update local state
      discussion.title = editTitle;
      discussion.content = editContent;
      
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update discussion",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDiscussion = async () => {
    if (!user || user.id !== discussion.userId) return;
    
    try {
      await apiRequest("DELETE", `/api/discussions/${discussion.id}`, {
        userId: user.id
      });
      
      toast({
        title: "Success",
        description: "Discussion deleted successfully",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete discussion",
        variant: "destructive",
      });
    }
  };

  const createdAt = discussion.createdAt 
    ? formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })
    : "some time ago";
  const isOwner = user && user.id === discussion.userId;

  return (
    <div className="bg-white rounded-lg shadow mb-4">
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex flex-col items-center mr-4">
            <Button
              variant="ghost"
              size="sm"
              className={`text-gray-400 hover:text-[#FF4500] ${isMarked ? 'text-[#FF4500]' : ''}`}
              aria-label="Mark as helpful"
              onClick={handleToggleHelpful}
            >
              <ArrowUp className="h-6 w-6" />
            </Button>
            <span className="text-sm font-medium">{helpfulCount}</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-gray-600"
              aria-label="Mark as not helpful"
            >
              <ArrowDown className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="flex-1">
            {isEditing ? (
              <div>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="font-ibm font-semibold text-xl mb-3 w-full"
                />
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[100px] mb-3"
                />
                <div className="flex space-x-2">
                  <Button onClick={handleSaveEdit}>Save</Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <h3 className="font-ibm font-semibold text-xl mb-1">{discussion.title}</h3>
                  {isOwner && (
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-[#0079D3] h-8 w-8"
                        onClick={() => setIsEditing(true)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-500 hover:text-red-500 h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete your discussion
                              and all its replies.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteDiscussion}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${discussion.user.username}&background=random`} alt={discussion.user.username} />
                    <AvatarFallback>{discussion.user.username.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{discussion.user.username}</span>
                  {isOwner && (
                    <span className="bg-[#0079D3]/10 text-[#0079D3] text-xs px-1.5 py-0.5 rounded">You</span>
                  )}
                  <span>•</span>
                  <span>{createdAt}</span>
                </div>
                
                <div className="prose max-w-none mb-4">
                  <p>{discussion.content}</p>
                  
                  {discussion.imagePath && (
                    <img
                      src={discussion.imagePath}
                      alt="Discussion attachment"
                      className="my-3 rounded-md border border-gray-200 max-h-96 object-contain"
                    />
                  )}
                </div>
              </>
            )}
            
            <div className="flex items-center space-x-4 text-sm">
              <Button
                variant="ghost"
                className="flex items-center text-gray-600 hover:text-[#0079D3]"
                onClick={() => setShowReplies(!showReplies)}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                <span>Reply ({discussion.replies?.length || 0})</span>
              </Button>
              <Button
                variant="ghost"
                className="flex items-center text-gray-600 hover:text-[#0079D3]"
              >
                <Bookmark className="h-4 w-4 mr-1" />
                <span>Save</span>
              </Button>
              <Button
                variant="ghost"
                className="flex items-center text-gray-600 hover:text-[#0079D3]"
              >
                <Share className="h-4 w-4 mr-1" />
                <span>Share</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {discussion.replies?.length > 0 && showReplies && (
        <Replies 
          discussionId={discussion.id} 
          replies={discussion.replies} 
        />
      )}
      
      {!showReplies && discussion.replies.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-lg">
          <Button 
            variant="ghost"
            className="w-full text-center text-[#0079D3] font-medium text-sm"
            onClick={() => setShowReplies(true)}
          >
            Show {discussion.replies.length} replies <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block ml-1 h-4 w-4"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </Button>
        </div>
      )}
    </div>
  );
};

export default DiscussionThread;
