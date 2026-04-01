import { useState, useEffect, useMemo } from "react";
import { Users, Search, Filter, Mail, ShieldCheck, Shield, User as UserIcon } from "lucide-react";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";
import { PageHeader } from "@/components/PageHeader";
import { AccountButton } from "@/components/AccountButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/hooks/use-user";
import { UserService } from "@/services/users";
import type { User, UserRole, UserStatus } from "@/types/organization";

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Admin",
  MEMBER: "Member",
};

const ROLE_VARIANTS: Record<UserRole, "default" | "secondary" | "outline"> = {
  SUPER_ADMIN: "default",
  ORG_ADMIN: "secondary",
  MEMBER: "outline",
};

const STATUS_VARIANTS: Record<UserStatus, "default" | "secondary" | "outline" | "destructive"> = {
  ACTIVE: "default",
  PENDING: "secondary",
  INACTIVE: "destructive",
};

function RoleIcon({ role }: { role: UserRole }) {
  if (role === "SUPER_ADMIN") return <ShieldCheck className="w-3.5 h-3.5" />;
  if (role === "ORG_ADMIN") return <Shield className="w-3.5 h-3.5" />;
  return <UserIcon className="w-3.5 h-3.5" />;
}

function getInitials(user: User): string {
  if (user.displayName) {
    return user.displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return user.email.slice(0, 2).toUpperCase();
}

const AdminUsers = () => {
  const { organization, user: firestoreUser } = useUser();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    const orgId = organization?.id ?? firestoreUser?.organizationId;
    if (!orgId) return;
    setLoading(true);
    UserService.getByOrganization(orgId)
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [organization?.id, firestoreUser?.organizationId]);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        !search ||
        (u.displayName ?? "").toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "all" || u.status === statusFilter;

      const matchesRole =
        roleFilter === "all" || u.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, search, statusFilter, roleFilter]);

  const counts = {
    all: users.length,
    active: users.filter(u => u.status === "ACTIVE").length,
    pending: users.filter(u => u.status === "PENDING").length,
    inactive: users.filter(u => u.status === "INACTIVE").length,
  };

  return (
    <ResponsiveLayout>
      <header className="bg-card/95 backdrop-blur-lg px-4 py-4 sm:px-6 lg:px-8 border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <PageHeader showLogo={false} />
          <AccountButton />
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Title */}
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Users</h1>
            <p className="text-sm text-muted-foreground">
              Manage organization members and their roles
            </p>
          </div>
        </div>

        {/* Status badge pills */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: "all",      label: `All (${counts.all})` },
            { key: "ACTIVE",   label: `Active (${counts.active})` },
            { key: "PENDING",  label: `Pending (${counts.pending})` },
            { key: "INACTIVE", label: `Inactive (${counts.inactive})` },
          ].map(({ key, label }) => (
            <Badge
              key={key}
              variant={statusFilter === key ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </Badge>
          ))}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-44">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              <SelectItem value="ORG_ADMIN">Admin</SelectItem>
              <SelectItem value="MEMBER">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {loading ? "Loading users…" : `${filtered.length} user${filtered.length !== 1 ? "s" : ""}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No users match your filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-[2.5fr_1.5fr_1fr_1fr] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span>User</span>
                  <span>Email</span>
                  <span>Role</span>
                  <span>Status</span>
                </div>

                {filtered.map(u => (
                  <div
                    key={u.id}
                    className="grid grid-cols-1 md:grid-cols-[2.5fr_1.5fr_1fr_1fr] gap-2 md:gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors"
                  >
                    {/* Avatar + name */}
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={u.photoURL} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(u)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {u.displayName ?? <span className="text-muted-foreground italic">No name</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate md:hidden">{u.email}</p>
                      </div>
                    </div>

                    {/* Email */}
                    <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>

                    {/* Role */}
                    <div>
                      <Badge variant={ROLE_VARIANTS[u.role]} className="gap-1 text-xs">
                        <RoleIcon role={u.role} />
                        {ROLE_LABELS[u.role]}
                      </Badge>
                    </div>

                    {/* Status */}
                    <div>
                      <Badge variant={STATUS_VARIANTS[u.status]} className="text-xs">
                        {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
};

export default AdminUsers;
