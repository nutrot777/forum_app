import { useQuery } from "@tanstack/react-query";
import { DiscussionWithDetails } from "@shared/schema";

export function useDiscussions(filter: string = "recent") {
  return useQuery<DiscussionWithDetails[]>({
    queryKey: ["/api/discussions", filter],
    queryFn: async () => {
      const response = await fetch(`/api/discussions?filter=${filter}`);
      if (!response.ok) {
        throw new Error("Failed to fetch discussions");
      }
      return response.json();
    }
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
    enabled: !!id
  });
}
