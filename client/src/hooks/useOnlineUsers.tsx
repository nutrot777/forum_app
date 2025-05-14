import { useState, useEffect } from "react";

export function useOnlineUsers() {
  // Temporarily hardcode online count to 1 for testing
  const [onlineCount, setOnlineCount] = useState(1);
  
  useEffect(() => {
    // Get initial count
    fetch("/api/users/online")
      .then(res => res.json())
      .then(data => setOnlineCount(data.count))
      .catch(err => console.error("Failed to fetch online users:", err));
    
    // WebSocket functionality temporarily disabled for troubleshooting
    console.log("WebSocket functionality temporarily disabled");
    
    // Poll for online users every 30 seconds as a fallback
    const intervalId = setInterval(() => {
      fetch("/api/users/online")
        .then(res => res.json())
        .then(data => setOnlineCount(data.count))
        .catch(err => console.error("Failed to fetch online users:", err));
    }, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);
  
  return { onlineCount };
}
