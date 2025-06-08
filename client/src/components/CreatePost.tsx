import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Image, Paperclip } from "lucide-react";
import { apiRequest, apiRequestWithUpload } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface CreatePostProps {
	onSuccess?: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onSuccess }) => {
	const { user } = useAuth();
	const { toast } = useToast();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
		if (!user) return;
		if (!title.trim()) {
			toast({
				title: "Error",
				description: "Please enter a title for your discussion",
				variant: "destructive",
			});
			return;
		}
		if (!content.trim()) {
			toast({
				title: "Error",
				description: "Please enter content for your discussion",
				variant: "destructive",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			const formData = new FormData();
			formData.append("title", title);
			formData.append("content", content);
			formData.append("userId", user.id.toString());

			if (selectedImage) {
				formData.append("image", selectedImage);
			}
			await apiRequestWithUpload("POST", "/api/discussions", formData);

			setTitle("");
			setContent("");
			setSelectedImage(null);
			setPreviewUrl(null);

			toast({
				title: "Success",
				description: "Your discussion has been posted",
			});

			// Invalidate discussions query to refresh the list
			queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });

			if (onSuccess) {
				onSuccess();
			}
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to post discussion",
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow mb-6 p-4">
			<h2 className="font-ibm font-semibold text-lg mb-3">Start a New Discussion</h2>
			<div className="mb-3">
				<Input
					placeholder="Discussion title"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0079D3]/30 focus:border-[#0079D3]"
				/>
			</div>

			<div className="mb-3">
				<Textarea
					placeholder="What would you like to discuss?"
					value={content}
					onChange={(e) => setContent(e.target.value)}
					className="w-full px-3 py-2 border border-gray-300 rounded-md h-24 focus:outline-none focus:ring-2 focus:ring-[#0079D3]/30 focus:border-[#0079D3]"
				/>
			</div>

			{previewUrl && (
				<div className="mb-3 relative">
					<img src={previewUrl} alt="Preview" className="max-h-64 rounded-md border border-gray-200" />
					<Button
						variant="destructive"
						size="icon"
						className="absolute top-2 right-2 h-6 w-6 rounded-full"
						onClick={() => {
							setSelectedImage(null);
							setPreviewUrl(null);
						}}
					>
						 ✕
					</Button>
				</div>
			)}

			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2">
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleImageChange}
						accept="image/*"
						className="hidden"
					/>
					<Button
						variant="ghost"
						className="flex items-center text-gray-600 hover:text-[#0079D3]"
						onClick={handleImageClick}
					>
						<Image className="h-5 w-5" />
						<span className="ml-1 text-sm">Add Image</span>
					</Button>

					<Button variant="ghost" className="flex items-center text-gray-600 hover:text-[#0079D3]">
						<Paperclip className="h-5 w-5" />
						<span className="ml-1 text-sm">Attach</span>
					</Button>
				</div>

				<Button
					className="px-4 py-2 bg-[#0079D3] text-white rounded-md hover:bg-[#0079D3]/90 transition-colors font-medium"
					onClick={handleSubmit}
					disabled={isSubmitting}
				>
					{isSubmitting ? "Posting..." : "Post Discussion"}
				</Button>
			</div>
		</div>
	);
};

export default CreatePost;
