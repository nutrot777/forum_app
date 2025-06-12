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
	onSuccess?: (updatedDiscussion?: any) => void;
	editingDiscussion?: {
		id: number;
		title: string;
		content: string;
		imagePaths: string[];
		captions: string[];
	};
}

const CreatePost: React.FC<CreatePostProps> = ({ onSuccess, editingDiscussion }) => {
	const { user } = useAuth();
	const { toast } = useToast();
	const [title, setTitle] = useState(editingDiscussion ? editingDiscussion.title : "");
	const [content, setContent] = useState(editingDiscussion ? editingDiscussion.content : "");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	// Separate state for existing and new images
	const [existingImages, setExistingImages] = useState<string[]>(editingDiscussion?.imagePaths || []);
	const [existingCaptions, setExistingCaptions] = useState<string[]>(editingDiscussion?.captions || []);
	const [selectedImages, setSelectedImages] = useState<File[]>([]);
	const [previewUrls, setPreviewUrls] = useState<string[]>([]);
	const [captions, setCaptions] = useState<string[]>([]);

	const handleImageClick = () => {
		fileInputRef.current?.click();
	};

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []);
		if (selectedImages.length + files.length > 20) {
			toast({
				title: "Error",
				description: "You cannot upload more than 20 images per post.",
				variant: "destructive",
			});
			return;
		}
		if (files.length > 0) {
			setSelectedImages((prev) => [...prev, ...files]);
			// Read all files and update previewUrls and captions in a single batch
			Promise.all(
				files.map((file) => {
					return new Promise<string>((resolve) => {
						const reader = new FileReader();
						reader.onloadend = () => resolve(reader.result as string);
						reader.readAsDataURL(file);
					});
				})
			).then((urls) => {
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
			if (editingDiscussion) {
				existingImages.forEach((url) => formData.append("existingImagePaths", url));
				existingCaptions.forEach((caption) => formData.append("existingCaptions", caption));
			}
			selectedImages.forEach((img) => formData.append("images", img));
			captions.forEach((caption) => formData.append("captions", caption));
			let updatedDiscussion;
			if (editingDiscussion) {
				const res = await apiRequestWithUpload("PATCH", `/api/discussions/${editingDiscussion.id}`, formData);
				updatedDiscussion = await res.json();
			} else {
				await apiRequestWithUpload("POST", "/api/discussions", formData);
			}
			setTitle("");
			setContent("");
			setSelectedImages([]);
			setPreviewUrls([]);
			setCaptions([]);
			setExistingImages([]);
			setExistingCaptions([]);
			toast({
				title: "Success",
				description: editingDiscussion ? "Your discussion has been updated" : "Your discussion has been posted",
			});
			queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
			if (onSuccess) {
				onSuccess(updatedDiscussion);
			}
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : editingDiscussion ? "Failed to update discussion" : "Failed to post discussion",
				variant: "destructive",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow mb-6 p-4">
			<h2 className="font-ibm font-semibold text-lg mb-3">
				{editingDiscussion ? "Edit Discussion" : "Start a New Discussion"}
			</h2>
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

			{/* Show existing images if editing */}
			{editingDiscussion && existingImages.length > 0 && (
				<div className="mb-3 flex flex-wrap gap-2">
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
								className="absolute top-2 right-2 h-6 w-6 rounded-full focus:bg-transparent active:bg-transparent focus:ring-0 active:ring-0"
								onClick={() => handleRemoveExistingImage(idx)}
							>
								✕
							</Button>
						</div>
					))}
				</div>
			)}

			{previewUrls.length > 0 && (
				<div className="mb-3 flex flex-wrap gap-2">
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
								className="absolute top-2 right-2 h-6 w-6 rounded-full focus:bg-transparent active:bg-transparent focus:ring-0 active:ring-0"
								onClick={() => handleRemoveImage(idx)}
							>
								✕
							</Button>
						</div>
					))}
				</div>
			)}

			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-2">
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleImageChange}
						accept="image/*"
						multiple
						className="hidden"
					/>
					<Button
						variant="ghost"
						className="flex items-center text-gray-600 hover:text-[#0079D3] focus:bg-transparent active:bg-transparent focus:ring-0 active:ring-0"
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
