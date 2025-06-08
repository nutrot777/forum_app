import { useState } from "react";
import { useDiscussions } from "@/hooks/useDiscussions";
import CreatePost from "@/components/CreatePost";
import FilterOptions from "@/components/FilterOptions";
import DiscussionThread from "@/components/DiscussionThread";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

const Home = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState("recent");
  const [limit, setLimit] = useState(5);

  const { data: discussions, isLoading, error } = useDiscussions(filter);

  if (!user) {
    return null;
  }

  const loadMore = () => {
    setLimit((prev) => prev + 5);
  };

  const filteredDiscussions = Array.isArray(discussions)
    ? filter === "my"
      ? discussions.filter((discussion) => discussion.userId === user.id)
      : discussions
    : [];

  const limitedDiscussions = filteredDiscussions
    ? filteredDiscussions.slice(0, limit)
    : [];

  const hasMore =
    filteredDiscussions && limitedDiscussions.length < filteredDiscussions.length;

  return (
    <div className="max-w-4xl mx-auto">
      <CreatePost />

      <FilterOptions currentFilter={filter} setFilter={setFilter} />

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow mb-4 p-4">
              <div className="flex">
                <div className="w-10 mr-4">
                  <Skeleton className="h-16 w-6 rounded-md" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-7 w-3/4 rounded-md" />
                  <Skeleton className="h-4 w-1/4 rounded-md" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <p className="text-red-500 mb-2">Error loading discussions</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </div>
      ) : limitedDiscussions && limitedDiscussions.length > 0 ? (
        <div className="space-y-4">
          {limitedDiscussions.map((discussion) => (
            <DiscussionThread key={discussion.id} discussion={discussion} filter={filter} />
          ))}

          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button
                className="px-4 py-2 bg-white text-[#0079D3] border border-[#0079D3] rounded-md hover:bg-[#0079D3]/5 transition-colors font-medium"
                onClick={loadMore}
              >
                Load More Discussions
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-2">No discussions found</p>
          {filter !== "recent" && (
            <Button onClick={() => setFilter("recent")} variant="outline">
              View Recent Discussions
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
