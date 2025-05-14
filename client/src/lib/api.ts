import { apiRequest } from "./queryClient";

export const api = {
  // Auth
  login: async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/login", { username, password });
    return response.json();
  },
  
  register: async (username: string, password: string) => {
    const response = await apiRequest("POST", "/api/auth/register", { username, password });
    return response.json();
  },
  
  logout: async (userId: number) => {
    const response = await apiRequest("POST", "/api/auth/logout", { userId });
    return response.json();
  },
  
  // Discussions
  getDiscussions: async (filter: string = "recent") => {
    const response = await fetch(`/api/discussions?filter=${filter}`);
    if (!response.ok) {
      throw new Error("Failed to fetch discussions");
    }
    return response.json();
  },
  
  getDiscussion: async (id: number) => {
    const response = await fetch(`/api/discussions/${id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch discussion");
    }
    return response.json();
  },
  
  createDiscussion: async (formData: FormData) => {
    const response = await apiRequest("POST", "/api/discussions", formData);
    return response.json();
  },
  
  updateDiscussion: async (id: number, formData: FormData) => {
    const response = await apiRequest("PATCH", `/api/discussions/${id}`, formData);
    return response.json();
  },
  
  deleteDiscussion: async (id: number, userId: number) => {
    const response = await apiRequest("DELETE", `/api/discussions/${id}`, { userId });
    return response.json();
  },
  
  // Replies
  createReply: async (formData: FormData) => {
    const response = await apiRequest("POST", "/api/replies", formData);
    return response.json();
  },
  
  updateReply: async (id: number, formData: FormData) => {
    const response = await apiRequest("PATCH", `/api/replies/${id}`, formData);
    return response.json();
  },
  
  deleteReply: async (id: number, userId: number) => {
    const response = await apiRequest("DELETE", `/api/replies/${id}`, { userId });
    return response.json();
  },
  
  // Helpful marks
  markAsHelpful: async (userId: number, discussionId?: number, replyId?: number) => {
    const response = await apiRequest("POST", "/api/helpful", { userId, discussionId, replyId });
    return response.json();
  },
  
  removeHelpfulMark: async (userId: number, discussionId?: number, replyId?: number) => {
    const response = await apiRequest("DELETE", "/api/helpful", { userId, discussionId, replyId });
    return response.json();
  },
  
  checkHelpfulMark: async (userId: number, discussionId?: number, replyId?: number) => {
    const params = new URLSearchParams();
    params.append("userId", userId.toString());
    if (discussionId) params.append("discussionId", discussionId.toString());
    if (replyId) params.append("replyId", replyId.toString());
    
    const response = await fetch(`/api/helpful/check?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to check helpful mark");
    }
    return response.json();
  }
};
