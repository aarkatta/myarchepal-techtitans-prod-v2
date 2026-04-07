import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Clock, Eye, ThumbsUp, MessageSquare, TrendingUp, Loader2, FileText, Plus } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useArticles, useFeaturedArticles, useArticlesByCategory, useArticleSearch } from "@/hooks/use-articles";
import { useAuth } from "@/hooks/use-auth";
import { Timestamp } from "firebase/firestore";
import { createEmojiElement } from "@/lib/sanitize";

const Blogs = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Use different hooks based on current state
  const { articles: allArticles, loading: allLoading, error: allError } = useArticles();
  const { articles: featuredArticles } = useFeaturedArticles();
  const { articles: categoryArticles, loading: categoryLoading } = useArticlesByCategory(selectedCategory);
  const { articles: searchResults, loading: searchLoading } = useArticleSearch(searchQuery);

  // Extract unique categories from all articles
  const [categories, setCategories] = useState<string[]>(["All"]);

  useEffect(() => {
    if (allArticles.length > 0) {
      const uniqueCategories = Array.from(new Set(allArticles.map(article => article.category)));
      setCategories(["All", ...uniqueCategories.sort()]);
    }
  }, [allArticles]);

  // Determine which articles to show
  const getArticlesToShow = () => {
    if (searchQuery.trim()) {
      return searchResults;
    } else if (selectedCategory === "All") {
      return allArticles;
    } else {
      return categoryArticles;
    }
  };

  const articles = getArticlesToShow();
  const loading = searchQuery.trim() ? searchLoading :
                  selectedCategory === "All" ? allLoading : categoryLoading;

  const formatDate = (date: Date | Timestamp | undefined) => {
    if (!date) return "Unknown date";
    const d = date instanceof Timestamp ? date.toDate() : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 14) return "1 week ago";
    return `${Math.floor(diffDays / 7)} weeks ago`;
  };

  const handleArticleClick = (articleId: string) => {
    navigate(`/article/${articleId}`);
  };

  return (
    <ResponsiveLayout>
      <header className="bg-card p-4 border-b border-border sticky top-0 z-10 lg:static">
        <div className="flex items-center justify-between mb-4">
          <PageHeader showLogo={false} />
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/create-article")}
                className="hover:bg-muted hover:text-primary"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create Blog
              </Button>
            )}
            <AccountButton mobileHidden />
          </div>
        </div>
        <div className="relative max-w-md">
          <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search blogs, authors..."
            className="pl-10 border-border"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="px-4 pt-4 lg:px-6 mx-auto max-w-7xl">
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-0 bg-transparent border-b rounded-none">
              {categories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 pb-3"
                >
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="All" className="mt-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading blogs...</span>
                </div>
              ) : allError ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-2">{allError}</p>
                  <Button onClick={() => window.location.reload()} variant="outline">
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  {!searchQuery && featuredArticles.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-foreground">Featured Blogs</h2>
                        <TrendingUp className="w-4 h-4 text-primary" />
                      </div>
                      <div className="space-y-3">
                        {featuredArticles.map((article) => (
                          <Card
                            key={article.id}
                            className="p-4 border-primary/20 bg-primary/5 hover:shadow-md transition-all cursor-pointer"
                            onClick={() => handleArticleClick(article.id!)}
                          >
                            <div className="flex gap-3">
                              <div className="w-14 h-14 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                {article.image ? (
                                  <img
                                    src={article.image}
                                    alt={article.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
