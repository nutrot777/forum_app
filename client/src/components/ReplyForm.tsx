import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Image } from "lucide-react";
import { apiRequest, apiRequestWithUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ReplyFormProps {
  discussionId: number;
  parentId?: number;
  onSuccess?: (updatedReply?: any) => void;
  editingReply?: {
    id: number;
    content: string;
    imagePaths: string[];
    captions: string[];
  };
}

const ReplyForm: React.FC<ReplyFormProps> = ({ discussionId, parentId, onSuccess, editingReply }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState(editingReply ? editingReply.content : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [existingImages, setExistingImages] = useState<string[]>(editingReply?.imagePaths || []);
  const [existingCaptions, setExistingCaptions] = useState<string[]>(editingReply?.captions || []);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [captions, setCaptions] = useState<string[]>([]);

  if (!user) return null;

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (selectedImages.length + files.length > 20) {
      toast({
        title: "Error",
        description: "You cannot upload more than 20 images per reply.",
        variant: "destructive",
      });
      return;
    }
    if (files.length > 0) {
      setSelectedImages((prev) => [...prev, ...files]);
      Promise.all(files.map(file => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      })).then((urls) => {
        setPreviewUrls((prev) => [...prev, ...urls]);
        setCaptions((prev) => [...prev, ...Array(files.length).fill("")]);
      });
    }
  };

  const handleRemoveImage = (idx: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== idx));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== idx));
    setCaptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleRemoveExistingImage = (idx: number) => {
    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
    setExistingCaptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCaptionChange = (idx: number, value: string) => {
    setCaptions((prev) => prev.map((c, i) => (i === idx ? value : c)));
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
      if (editingReply) {
        existingImages.forEach((url) => formData.append("existingImagePaths", url));
        existingCaptions.forEach((caption) => formData.append("existingCaptions", caption));
      }
      selectedImages.forEach((img) => formData.append("images", img));
      captions.forEach((caption) => formData.append("captions", caption));
      let updatedReply;
      if (editingReply) {
        const res = await apiRequestWithUpload("PATCH", `/api/replies/${editingReply.id}`, formData);
        updatedReply = await res.json();
      } else {
        await apiRequestWithUpload("POST", "/api/replies", formData);
      }
      setContent("");
      setSelectedImages([]);
      setPreviewUrls([]);
      setCaptions([]);
      setExistingImages([]);
      setExistingCaptions([]);
      toast({
        title: "Success",
        description: editingReply ? "Your reply has been updated" : "Your reply has been posted",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/discussions/${discussionId}`] });
      if (onSuccess) {
        onSuccess(updatedReply);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : editingReply ? "Failed to update reply" : "Failed to post reply",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4">
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
            {/* Show existing images if editing */}
            {editingReply && existingImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 mt-2">
                {existingImages.map((url, idx) => (
                  <div key={url} className="relative flex flex-col items-center">
                    <img src={url} alt={`Existing ${idx + 1}`} className="max-h-32 rounded-md border border-gray-200 mb-1" />
                    <input
                      type="text"
                      placeholder="Add a caption..."
                      value={existingCaptions[idx] || ""}
                      onChange={(e) => setExistingCaptions((prev) => prev.map((c, i) => (i === idx ? e.target.value : c)))}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-1"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-5 w-5 rounded-full"
                      onClick={() => handleRemoveExistingImage(idx)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {previewUrls.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 mt-2">
                {previewUrls.map((url, idx) => (
                  <div key={idx} className="relative flex flex-col items-center">
                    <img src={url} alt={`Preview ${idx + 1}`} className="max-h-32 rounded-md border border-gray-200 mb-1" />
                    <input
                      type="text"
                      placeholder="Add a caption..."
                      value={captions[idx] || ""}
                      onChange={(e) => handleCaptionChange(idx, e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs mb-1"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-5 w-5 rounded-full"
                      onClick={() => handleRemoveImage(idx)}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-between items-center mt-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                multiple
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
                Add Images
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
