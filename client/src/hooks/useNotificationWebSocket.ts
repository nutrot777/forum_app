import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

// Use environment variable or fallback to current host for WebSocket URL
const WS_BASE_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

export function useNotificationWebSocket() {
  // WebSocket is disabled for debugging and stability
  return;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    // Connect to backend WebSocket server on /ws path with userId
    const wsUrl = `${WS_BASE_URL}/ws?userId=${user.id}`;
    const ws = new window.WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Optionally authenticate or identify user if needed
      // ws.send(JSON.stringify({ type: "auth", userId: user.id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          // Refetch notifications and unread count instantly
          queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
          queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread/count"] });
        }
        // Handle discussion/reply events for instant updates
        if (data.type === "discussion" && data.discussionId) {
          queryClient.invalidateQueries({ queryKey: ["/api/discussions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/discussions/recent"] });
          queryClient.invalidateQueries({ queryKey: ["/api/discussions/helpful"] });
          queryClient.invalidateQueries({ queryKey: ["/api/discussions/my"] });
          queryClient.invalidateQueries({ queryKey: ["/api/discussions/" + data.discussionId] });
        }
        if (data.type === "reply" && data.discussionId) {
          queryClient.invalidateQueries({ queryKey: ["/api/discussions/" + data.discussionId] });
        }
        // NEW: Handle helpful (like/upvote) events
        if (data.type === "helpful" && data.discussionId) {
          queryClient.invalidateQueries({ queryKey: ["/api/discussions/" + data.discussionId] });
        }
      } catch (e) {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // Optionally handle error
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
    };
    // Only re-run if user changes
  }, [user, queryClient]);
}
