import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowUp, MessageSquare, Bookmark, Share, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Replies from "./Replies";
import { DiscussionWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import html2canvas from "html2canvas";
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
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CreatePost from "./CreatePost";

interface DiscussionThreadProps {
	discussion: DiscussionWithDetails;
	filter: string;
}

const DiscussionThread: React.FC<DiscussionThreadProps> = ({ discussion, filter }) => {
	const { user } = useAuth();
	const { toast } = useToast();
	const [showReplies, setShowReplies] = useState(true);
	const [isMarked, setIsMarked] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState(discussion.title);
	const [editContent, setEditContent] = useState(discussion.content);
	const [isBookmarked, setIsBookmarked] = useState(false);
	const [discussionDataState, setDiscussionDataState] = useState(discussion);
	const discussionRef = useRef<HTMLDivElement>(null);

	// Add logging to debug the `discussion` object
	useEffect(() => {
		console.log("Discussion object in DiscussionThread:", discussion);
	}, [discussion]);

	// Add query for discussion details (to get latest replies)
	const { data: discussionData, refetch } = useQuery({
		queryKey: ["/api/discussions/" + discussion.id],
		queryFn: async () => {
			const res = await fetch(`/api/discussions/${discussion.id}`);
			if (!res.ok) throw new Error("Failed to fetch discussion");
			return res.json();
		},
		initialData: discussion,
		refetchInterval: 2000, // Poll every 2 seconds for new upvotes/downvotes
	});
	// Keep local state in sync with server
	useEffect(() => {
		if (discussionData) setDiscussionDataState(discussionData);
	}, [discussionData]);

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

	// Check if current user has bookmarked this discussion
	useEffect(() => {
		const checkBookmark = async () => {
			if (!user) return;
			try {
				const response = await fetch(`/api/bookmarks/check?userId=${user.id}&discussionId=${discussion.id}`);
				const data = await response.json();
				setIsBookmarked(data.isBookmarked);
			} catch (error) {
				console.error("Failed to check bookmark status:", error);
			}
		};
		checkBookmark();
		// }, [user, discussion.id]);
	}, [user, discussion.id, isBookmarked, filter]);

	// Run on component mount
	useEffect(() => {
		checkIfMarkedAsHelpful();
	}, [user, discussion.id]);

	const handleToggleHelpful = async () => {
		if (!user) return;
		try {
			if (isMarked) {
				await apiRequest("DELETE", "/api/helpful", {
					userId: user.id,
					discussionId: discussion.id,
					type: "upvote",
				});
			} else {
				await apiRequest("POST", "/api/helpful", {
					userId: user.id,
					discussionId: discussion.id,
					type: "upvote",
				});
			}
			await checkIfMarkedAsHelpful(); // Ensure arrow color updates correctly
			refetch();
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to mark as helpful",
				variant: "destructive",
			});
		}
	};

	const toggleBookmark = async () => {
		if (!user) return;
		try {
			if (isBookmarked) {
				await apiRequest("DELETE", "/api/bookmarks", {
					userId: user.id,
					discussionId: discussion.id,
				});
			} else {
				await apiRequest("POST", "/api/bookmarks", {
					userId: user.id,
					discussionId: discussion.id,
				});
			}
			setIsBookmarked(!isBookmarked);
		} catch (error) {
			console.error("Failed to toggle bookmark:", error);
		}
	};

	const handleSaveOption = async (option: "current" | "continuous") => {
		if (!user) return;
		try {
			if (option === "current") {
				await apiRequest("POST", "/api/bookmarks", {
					userId: user.id,
					discussionId: discussion.id,
					saveType: "current",
				});
			} else {
				await apiRequest("POST", "/api/bookmarks", {
					userId: user.id,
					discussionId: discussion.id,
					saveType: "continuous",
				});
			}
			setIsBookmarked(true);
			toast({
				title: "Success",
				description: `Discussion saved as ${option === "current" ? "current thread" : "continuous update"}`,
			});
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to save discussion",
				variant: "destructive",
			});
		}
	};

	const handleDeleteBookmark = async () => {
		if (!user) return;

		try {

			const res = await apiRequest("DELETE", "/api/delete-bookmark", {
				userId: user.id,
				discussionId: discussion.id,
			})
			console.log("bookdeleted: ", res)
			setIsBookmarked(false);
			toast({
				title: "Success",
				description: "Bookmark successfully deleted",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to delete discussion",
				variant: "destructive",
			});

		}

	}

	const handleSaveEdit = async () => {
		if (!user || user.id !== discussion.userId) return;

		try {
			await apiRequest("PATCH", `/api/discussions/${discussion.id}`, {
				userId: user.id,
				title: editTitle,
				content: editContent,
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
				userId: user.id,
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

	const handleShareDiscussion = async () => {
		if (!discussionRef.current) return;

		try {
			// Ensure replies are visible for screenshot
			const wasHidden = !showReplies;
			if (wasHidden) {
				setShowReplies(true);
			}

			// Allow the DOM to update with shown replies
			setTimeout(async () => {
				try {
					// Capture the discussion element as an image
					const canvas = await html2canvas(discussionRef.current!, {
						scale: 2, // Higher quality
						logging: false,
						useCORS: true, // To handle images from other domains
						backgroundColor: "#ffffff",
					});

					// Convert canvas to blob
					canvas.toBlob((blob) => {
						if (!blob) {
							throw new Error("Failed to create image");
						}

						// Create download link
						const url = URL.createObjectURL(blob);
						const link = document.createElement("a");
						link.download = `discussion-${discussion.id}.png`;
						link.href = url;
						link.click();

						// Cleanup
						URL.revokeObjectURL(url);

						// Restore previous state if needed
						if (wasHidden) {
							setShowReplies(false);
						}

						toast({
							title: "Success",
							description: "Screenshot saved to your downloads",
						});
					}, "image/png");
				} catch (error) {
					console.error("Screenshot error:", error);
					toast({
						title: "Error",
						description: "Failed to take screenshot",
						variant: "destructive",
					});

					// Restore previous state if needed
					if (wasHidden) {
						setShowReplies(false);
					}
				}
			}, 300); // Small delay to ensure DOM rendering completes
		} catch (error) {
			console.error("Share error:", error);
			toast({
				title: "Error",
				description: "Failed to share discussion",
				variant: "destructive",
			});
		}
	};

	const createdAt = discussion.createdAt
		? formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })
		: "some time ago";
	const isOwner = user && user.id === discussion.userId;

	console.log({ filter });
	if (!isBookmarked && filter === "bookmarks") {
		return null;
	}

	return (
		<div ref={discussionRef} className="bg-white rounded-lg shadow mb-4">
			<div className="p-4">
				<div className="flex items-start">
					<div className="flex flex-col items-center mr-4">
						<Button variant="ghost" size="sm" aria-label="Mark as helpful" onClick={handleToggleHelpful}>
							<ArrowUp
								className={`h-6 w-6 text-gray-400 hover:text-[#FF4500] ${
									isMarked ? "text-[#FF4500]" : ""
								}`}
							/>
						</Button>
						<span className="text-sm font-medium">{discussionDataState.helpfulCount || 0}</span>
					</div>

					<div className="flex-1">
						{isEditing ? (
							<CreatePost
								onSuccess={(updated) => {
									if (updated) setDiscussionDataState(updated);
									setIsEditing(false);
									refetch();
								}}
								editingDiscussion={{
									id: discussionDataState.id,
									title: discussionDataState.title,
									content: discussionDataState.content,
									imagePaths: discussionDataState.imagePaths || [],
									captions: discussionDataState.captions || [],
								}}
							/>
						) : (
							<>
								<div className="flex justify-between items-start">
									<h3 className="font-ibm font-semibold text-xl mb-1">{discussionDataState.title}</h3>
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
															This action cannot be undone. This will permanently delete
															your discussion and all its replies.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction onClick={handleDeleteDiscussion}>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									)}
								</div>

								<div className="flex items-center space-x-2 mb-3 text-sm text-gray-600">
									<Avatar className="w-5 h-5">
										<AvatarImage
											src={`https://ui-avatars.com/api/?name=${
												discussionDataState.user?.username || "Unknown"
											}&background=random`}
											alt={discussionDataState.user?.username || "Unknown"}
										/>
										<AvatarFallback>
											{discussionDataState.user?.username?.charAt(0).toUpperCase() || "U"}
										</AvatarFallback>
									</Avatar>
									<span className="font-medium">{discussionDataState.user?.username || "Unknown"}</span>
									{isOwner && (
										<span className="bg-[#0079D3]/10 text-[#0079D3] text-xs px-1.5 py-0.5 rounded">
											You
										</span>
									)}
									<span>•</span>
									<span>{createdAt}</span>
								</div>

								<div className="prose max-w-none mb-4">
									<p>{discussionDataState.content}</p>
									{discussionDataState.imagePaths && discussionDataState.imagePaths.length > 0 && (
										<div className="flex flex-wrap gap-2 mt-2">
											{discussionDataState.imagePaths.map((url, idx) => (
												<div key={idx} className="flex flex-col items-center">
													<img
														src={url}
														alt={`Discussion attachment ${idx + 1}`}
														className="rounded-md border border-gray-200 max-h-64 object-contain max-w-xs"
														style={{ flex: '1 1 200px', minWidth: 0 }}
													/>
													{discussionDataState.captions && discussionDataState.captions[idx] && (
														<span className="text-xs text-gray-500 mt-1">{discussionDataState.captions[idx]}</span>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							</>
						)}

						<div className="flex items-center space-x-4 text-sm">
							<Button
								variant="ghost"
								className={`flex items-center transition-colors ${
									showReplies ? "text-[#0079D3] font-semibold" : "text-gray-600"
								} hover:text-[#0079D3]`}
								onClick={() => setShowReplies(!showReplies)}
							>
								<MessageSquare className="h-4 w-4 mr-1" />
								<span>
									Show Replies
									{typeof discussionData.replies === "object"
										? ` (${discussionData.replies.length})`
										: ""}
								</span>
							</Button>
							<Popover>
								<PopoverTrigger>
									<Button
										variant="ghost"
										className="flex items-center text-gray-600 hover:text-[#0079D3]"
									>
										<Bookmark
											className={`h-4 w-4 mr-1 ${
												isBookmarked ? "fill-current text-[#0079D3]" : ""
											}`}
										/>
										<span>Save</span>
									</Button>
								</PopoverTrigger>
								<PopoverContent className="p-4 bg-white shadow-lg rounded-md border border-gray-200">
									<h4 className="text-sm font-medium text-gray-700 mb-2">Save Options</h4>
									<div className="flex flex-col space-y-2">
										<Button
											variant="outline"
											className="text-sm text-gray-600 hover:text-[#0079D3] hover:border-[#0079D3]"
											onClick={() => handleSaveOption("current")}
										>
											Save Current Thread
										</Button>
										<Button
											variant="outline"
											className="text-sm text-gray-600 hover:text-[#0079D3] hover:border-[#0079D3]"
											onClick={() => handleSaveOption("continuous")}
										>
											Save Continuous Update
										</Button>
										{
											isBookmarked ? <Button
												variant="outline"
												className="text-sm text-gray-600 hover:text-[#0079D3] hover:border-[#0079D3]"
												// onClick={() => handleSaveOption("current")}
												onClick={() => handleDeleteBookmark()}
											>
												Delete Bookmark
											</Button>
												: null
										}
									</div>
								</PopoverContent>
							</Popover>
							<Button
								variant="ghost"
								className="flex items-center text-gray-600 hover:text-[#0079D3]"
								onClick={handleShareDiscussion}
							>
								<Share className="h-4 w-4 mr-1" />
								<span>Share</span>
							</Button>
						</div>
					</div>
				</div>
			</div>

			{showReplies && (
				<Replies discussionId={discussion.id} replies={discussionData.replies || []} onReplySuccess={refetch} />
			)}

			{!showReplies && discussion.replies?.length > 0 && (
				<div className="border-t border-gray-100 px-4 py-3 bg-gray-50 rounded-b-lg">
					<Button
						variant="ghost"
						className="w-full text-center text-[#0079D3] font-medium text-sm"
						onClick={() => setShowReplies(true)}
					>
						Show {discussion.replies?.length || 0} replies
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="inline-block ml-1 h-4 w-4"
						>
							<polyline points="6 9 12 15 18 9"></polyline>
						</svg>
					</Button>
				</div>
			)}
		</div>
	);
};

export default DiscussionThread;
