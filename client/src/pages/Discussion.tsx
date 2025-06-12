import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import DiscussionThread from "@/components/DiscussionThread";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

const DiscussionPage = () => {
  const params = useParams();
  const { id } = params;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/discussions/" + id],
    queryFn: async () => {
      const res = await fetch(`/api/discussions/${id}`);
      if (!res.ok) throw new Error("Discussion not found");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (id) refetch();
  }, [id, refetch]);

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (error || !data) return <div className="p-8 text-center text-red-500">Discussion not found.</div>;

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <DiscussionThread discussion={data} />
    </div>
  );
};

export default DiscussionPage;
