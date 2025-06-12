import { useQuery } from "@tanstack/react-query";
import { DiscussionWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export function useDiscussions(filter: string = "recent") {
	const { user } = useAuth();
	return useQuery<DiscussionWithDetails[]>({
		queryKey: ["/api/discussions", filter, user?.id],
		queryFn: async () => {
			if (filter === "bookmarks") {
				if (!user || !user.id) return [];
				const response = await fetch(`/api/bookmarks?userId=${user.id}`);
				if (response.status === 401) return [];
				if (!response.ok) throw new Error("Failed to fetch bookmarks");
				return response.json();
			}
			const response = await fetch(`/api/discussions?filter=${filter}`);
			if (!response.ok) {
				throw new Error("Failed to fetch discussions");
			}
			return response.json();
		},
		enabled: filter !== "bookmarks" || (!!user && !!user.id),
	});
}

export function useDiscussion(id: number) {
	return useQuery<DiscussionWithDetails>({
		queryKey: [`/api/discussions/${id}`],
		queryFn: async () => {
			const response = await fetch(`/api/discussions/${id}`);
			if (!response.ok) {
				throw new Error("Failed to fetch discussion");
			}
			return response.json();
		},
		enabled: !!id,
	});
}
