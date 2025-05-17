import { ReplyWithUser } from "@shared/schema";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThumbsUp, Edit, Trash2, Bookmark } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ReplyForm from "./ReplyForm";
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

interface RepliesProps {
  discussionId: number;
  replies: ReplyWithUser[];
  onReplySuccess?: () => void;
}

const Replies: React.FC<RepliesProps> = ({ discussionId, replies, onReplySuccess }) => {
  return (
    <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-lg">
      <h4 className="font-ibm font-medium text-sm mb-2">Replies ({replies?.length || 0})</h4>
      {replies && replies.length > 0 && replies.map((reply) => (
        <ReplyItem 
          key={reply.id} 
          reply={reply} 
          discussionId={discussionId} 
          depth={0}
          onReplySuccess={onReplySuccess}
        />
      ))}
      <ReplyForm discussionId={discussionId} onSuccess={onReplySuccess} />
    </div>
  );
};

interface ReplyItemProps {
  reply: ReplyWithUser;
  discussionId: number;
  depth?: number;
  onReplySuccess?: () => void;
}

const ReplyItem: React.FC<ReplyItemProps> = ({ reply, discussionId, depth = 0, onReplySuccess }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const [isMarked, setIsMarked] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(reply.helpfulCount || 0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  
  // Check if current user has marked this reply as helpful
  const checkIfMarkedAsHelpful = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`/api/helpful/check?userId=${user.id}&replyId=${reply.id}`);
      const data = await response.json();
      setIsMarked(data.isMarked);
      console.log("API /api/helpful/check returned:", data.isMarked, "for reply", reply.id, "user", user.id);
    } catch (error) {
      console.error("Failed to check helpful status:", error);
    }
  };
  
  // Run on component mount
  useEffect(() => {
    checkIfMarkedAsHelpful();
  }, [user, reply.id]);
  
  const handleToggleHelpful = async () => {
    if (!user) return;
    
    try {
      if (isMarked) {
        await apiRequest("DELETE", "/api/helpful", {
          userId: user.id,
          replyId: reply.id,
          type: "upvote"
        });
        setHelpfulCount(prev => Math.max(0, (prev || 0) - 1));
      } else {
        await apiRequest("POST", "/api/helpful", {
          userId: user.id,
          replyId: reply.id, 
          type: "upvote"
        });
        setHelpfulCount(prev => (prev || 0) + 1);
      }
      await checkIfMarkedAsHelpful();
      console.log("After toggle, isMarked is:", isMarked);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark as helpful",
        variant: "destructive",
      });
    }
  };
  
  const handleSaveEdit = async () => {
    if (!user || user.id !== reply.userId) return;
    
    try {
      await apiRequest("PATCH", `/api/replies/${reply.id}`, {
        userId: user.id,
        content: editContent
      });
      
      toast({
        title: "Success",
        description: "Reply updated successfully",
      });
      
      // Update local state
      reply.content = editContent;
      
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: [`/api/discussions/${discussionId}`] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update reply",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteReply = async () => {
    if (!user || user.id !== reply.userId) return;
    
    try {
      await apiRequest("DELETE", `/api/replies/${reply.id}`, {
        userId: user.id
      });
      
      toast({
        title: "Success",
        description: "Reply deleted successfully",
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/discussions/${discussionId}`] });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete reply",
        variant: "destructive",
      });
    }
  };
  
  const handleToggleBookmark = async () => {
    if (!user) return;
    try {
      if (isBookmarked) {
        await apiRequest("DELETE", "/api/bookmarks", {
          userId: user.id,
          discussionId: discussionId,
        });
        setIsBookmarked(false);
      } else {
        await apiRequest("POST", "/api/bookmarks", {
          userId: user.id,
          discussionId: discussionId,
        });
        setIsBookmarked(true);
      }
      // Optionally show a toast here
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save discussion",
        variant: "destructive",
      });
    }
  };
  
  const createdAt = reply.createdAt 
    ? formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true }) 
    : "some time ago";
  const isOwner = user && user.id === reply.userId;
  const maxDepth = 3;
  
  return (
    <div className={`ml-8 mb-4 border-l-2 border-gray-200 pl-4`}>
      <div className="flex items-start">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 mb-1 text-sm">
              <Avatar className="w-5 h-5">
                <AvatarImage src={`https://ui-avatars.com/api/?name=${reply.user.username}&background=random`} alt={reply.user.username} />
                <AvatarFallback>{reply.user.username.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium">{reply.user.username}</span>
              {isOwner && (
                <span className="bg-[#0079D3]/10 text-[#0079D3] text-xs px-1.5 py-0.5 rounded">You</span>
              )}
              <span className="text-gray-500">{createdAt}</span>
            </div>
            
            {isOwner && (
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-500 hover:text-[#0079D3] h-6 w-6"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-gray-500 hover:text-red-500 h-6 w-6"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your reply.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteReply}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
          
          {isEditing ? (
            <div>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[100px] mb-3 text-sm"
              />
              <div className="flex space-x-2">
                <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none mb-2">
              <p>{reply.content}</p>
              
              {reply.imagePath && (
                <img
                  src={reply.imagePath}
                  alt="Reply attachment"
                  className="my-2 rounded-md border border-gray-200 max-h-64 object-contain"
                />
              )}
            </div>
          )}
          
          <div className="flex items-center space-x-3 text-xs">
            <Button
              variant="ghost"
              className="group focus:bg-transparent active:bg-transparent focus:text-inherit active:text-inherit focus:outline-none"
              onClick={handleToggleHelpful}
            >
              <ThumbsUp className={`h-4 w-4 mr-1 ${isMarked ? 'text-[#FF4500]' : 'text-gray-400'} group-hover:text-[#FF4500]`} />
              <span className={`${isMarked ? 'text-[#FF4500]' : 'text-gray-600'} group-hover:text-[#FF4500]`}>
                Helpful ({helpfulCount})
              </span>
            </Button>
            {depth < maxDepth && (
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-600 hover:text-[#0079D3] p-0 h-auto"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                Reply
              </Button>
            )}
            {/* <Button
              variant="ghost"
              className={`flex items-center ${isBookmarked ? "text-[#0079D3]" : "text-gray-600"} hover:text-[#0079D3]`}
              onClick={handleToggleBookmark}
            >
              <Bookmark className="h-4 w-4 mr-1" />
              <span>{isBookmarked ? "Saved" : "Save"}</span>
            </Button> */}
          </div>
          
          {showReplyForm && (
            <div className="mt-2">
              <ReplyForm 
                discussionId={discussionId} 
                parentId={reply.id} 
                onSuccess={() => {
                  setShowReplyForm(false);
                  if (onReplySuccess) onReplySuccess();
                }} 
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Child replies */}
      {reply.childReplies && reply.childReplies?.length > 0 && (
        <div className="mt-3">
          {reply.childReplies?.map((childReply) => (
            <ReplyItem
              key={childReply.id}
              reply={childReply}
              discussionId={discussionId}
              depth={(depth ?? 0) + 1} // Ensure depth is incremented for children
              onReplySuccess={onReplySuccess}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Replies;
