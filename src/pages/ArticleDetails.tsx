import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, ThumbsUp, MessageSquare, Clock, Share2, Edit, Loader2, User, Globe, Lock } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArticlesService, Article } from "@/services/articles";
import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { useArchaeologist } from "@/hooks/use-archaeologist";
import { DEFAULT_ORGANIZATION_ID } from "@/types/organization";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Timestamp } from "firebase/firestore";

const ArticleDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useUser();
  const { isArchaeologist } = useArchaeologist();
  const { toast } = useToast();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // Check if user is in a Pro/Enterprise organization (non-default)
  const isProOrg = organization &&
    organization.id !== DEFAULT_ORGANIZATION_ID &&
    (organization.subscriptionLevel === 'Pro' || organization.subscriptionLevel === 'Enterprise');

  useEffect(() => {
    const fetchArticle = async () => {
      if (!id) {
        setError("Article ID not found");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const articleData = await ArticlesService.getArticleById(id);
        setArticle(articleData);

        // Increment view count
        if (articleData) {
          await ArticlesService.incrementViews(id);
          // Update local state to reflect the view increment
          setArticle(prev => prev ? { ...prev, views: prev.views + 1 } : null);
        }
      } catch (error) {
        console.error("Error fetching article:", error);
        setError("Failed to load article");
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  const formatDate = (date: Date | Timestamp | undefined) => {
    if (!date) return "Unknown date";
    const d = date instanceof Timestamp ? date.toDate() : date;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  };

  const handleShare = async () => {
    if (navigator.share && article) {
      try {
        await navigator.share({
          title: article.title,
          text: article.excerpt,
          url: window.location.href,
        });
      } catch (error) {
        console.log("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link copied!",
          description: "Article link has been copied to clipboard",
        });
      } catch (error) {
        toast({
          title: "Share failed",
          description: "Unable to share or copy link",
          variant: "destructive"
        });
      }
    }
  };

  const canEdit = user && isArchaeologist && article && article.authorId === user.uid;

  // Can change visibility if: user is the creator and belongs to a Pro/Enterprise org
  const canChangeVisibility = canEdit && isProOrg;

  const handleVisibilityChange = async (newVisibility: 'public' | 'private') => {
    if (!article?.id || !canChangeVisibility) return;

    try {
      setUpdatingVisibility(true);
      await ArticlesService.updateArticle(article.id, { visibility: newVisibility });
      setArticle(prev => prev ? { ...prev, visibility: newVisibility } : null);
      toast({
        title: "Visibility Updated",
        description: `Article is now ${newVisibility}`,
      });
    } catch (error) {
      console.error("Error updating visibility:", error);
      toast({
        title: "Error",
        description: "Failed to update visibility. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUpdatingVisibility(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Article not found"}</p>
          <Button onClick={() => navigate("/articles")} variant="outline">
            Back to Articles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveLayout>
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <PageHeader showLogo={false} />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="hover:bg-muted h-10 w-10"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(`/edit-article/${article.id}`)}
                  className="hover:bg-muted h-10 w-10"
                >
                  <Edit className="w-4 h-4" />
                </Button>
              )}
              <AccountButton mobileHidden />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="p-4 sm:p-6 lg:p-8 space-y-4 lg:space-y-6">
          {/* Cover Image */}
          {article.image && (
            <Card>
              <CardContent className="pt-6">
                <div className="w-full flex justify-center rounded-lg bg-muted/30">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="max-w-full max-h-80 object-contain rounded-lg"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Article Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{article.category}</Badge>
                  {article.featured && (
                    <Badge variant="outline" className="border-primary text-primary">
                      Featured
                    </Badge>
                  )}
                </div>

                <h1 className="text-2xl font-bold text-foreground leading-tight">
                  {article.title}
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed">
                  {article.excerpt}
                </p>

                {/* Article Stats */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{article.views.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      <span>{article.likes}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      <span>{article.comments}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{article.readTime}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Author Info */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={article.authorAvatar} />
                  <AvatarFallback>
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{article.author}</p>
                  <p className="text-sm text-muted-foreground">
                    Published {formatDate(article.publishedAt)}
                  </p>
                  {article.updatedAt && article.updatedAt !== article.publishedAt && (
                    <p className="text-xs text-muted-foreground">
                      Updated {formatDate(article.updatedAt)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Article Content */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Article Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                {article.content.split('\n').map((paragraph, index) => (
                  <p key={index} className="text-muted-foreground mb-4 leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Image Analysis */}
          {article.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  🤖 AI Image Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <p className="text-sm text-muted-foreground mb-2">AI-generated insights about the cover image:</p>
                  <p className="text-sm leading-relaxed">{article.aiSummary}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Article Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Article Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Published:</span>
                <span className="text-muted-foreground text-sm">
                  {formatDate(article.publishedAt)}
                </span>
              </div>
              {article.updatedAt && article.updatedAt !== article.publishedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Last Updated:</span>
                  <span className="text-muted-foreground text-sm">
                    {formatDate(article.updatedAt)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Article ID:</span>
                <span className="text-muted-foreground text-sm font-mono">
                  {article.id}
                </span>
              </div>

              {/* Visibility Toggle - Only for Pro/Enterprise organizations */}
              {canChangeVisibility && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
                    <div className="space-y-0.5">
                      <Label className="text-foreground flex items-center gap-2">
                        {article.visibility === 'public' ? (
                          <Globe className="w-4 h-4 text-green-600" />
                        ) : (
                          <Lock className="w-4 h-4 text-amber-600" />
                        )}
                        Visibility
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {article.visibility === 'public'
                          ? 'Visible to all users'
                          : 'Only visible to organization members'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${article.visibility !== 'public' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        Private
                      </span>
                      <Switch
                        checked={article.visibility === 'public'}
                        onCheckedChange={(checked) => handleVisibilityChange(checked ? 'public' : 'private')}
                        disabled={updatingVisibility}
                      />
                      <span className={`text-sm ${article.visibility === 'public' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        Public
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default ArticleDetails;