import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ReplyFormProps {
  discussionId: number;
  parentId?: number;
  onSuccess?: () => void;
}

const ReplyForm: React.FC<ReplyFormProps> = ({ discussionId, parentId, onSuccess }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!user) return null;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter a reply",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("content", content);
      formData.append("userId", user.id.toString());
      formData.append("discussionId", discussionId.toString());
      
      if (parentId) {
        formData.append("parentId", parentId.toString());
      }
      
      if (selectedImage) {
        formData.append("image", selectedImage);
      }

      await apiRequest("POST", "/api/replies", formData);
      
      setContent("");
      setSelectedImage(null);
      setPreviewUrl(null);
      
      toast({
        title: "Success",
        description: "Your reply has been posted",
      });
      
      // Invalidate discussion query to refresh replies
      queryClient.invalidateQueries({ queryKey: [`/api/discussions/${discussionId}`] });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to post reply",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="ml-8 mt-4">
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div className="flex">
          <Avatar className="w-8 h-8 hidden sm:block mr-2">
            <AvatarImage src={`https://ui-avatars.com/api/?name=${user.username}&background=random`} alt={user.username} />
            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="Write your reply..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm h-20 focus:outline-none focus:ring-2 focus:ring-[#0079D3]/30 focus:border-[#0079D3]"
            />
            
            {previewUrl && (
              <div className="mt-2 relative">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-48 rounded-md border border-gray-200" 
                />
                <Button
                  variant="destructive" 
                  size="icon"
                  className="absolute top-2 right-2 h-5 w-5 rounded-full"
                  onClick={() => {
                    setSelectedImage(null);
                    setPreviewUrl(null);
                  }}
                >
                  ✕
                </Button>
              </div>
            )}
            
            <div className="flex justify-between items-center mt-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-gray-600 text-sm hover:text-[#0079D3]"
                onClick={handleImageClick}
              >
                <Image className="h-4 w-4 mr-1" />
                Add Image
              </Button>
              <Button
                type="submit"
                className="px-3 py-1.5 bg-[#0079D3] text-white text-sm rounded-md hover:bg-[#0079D3]/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Posting..." : "Post Reply"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ReplyForm;
