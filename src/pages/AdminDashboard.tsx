import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/use-user';
import { OrganizationService } from '@/services/organizations';
import { UserService } from '@/services/users';
import { InvitationService } from '@/services/invitations';
import { UserRoleService } from '@/services/userRoles';
import {
  Organization,
  User,
  OrganizationType,
  SUBSCRIPTION_LEVELS,
  ROOT_ORGANIZATION_ID,
  DEFAULT_ORGANIZATION_ID,
  ROLE_IDS,
} from '@/types/organization';
import {
  Building2,
  Users,
  Plus,
  Loader2,
  Shield,
  Crown,
  RefreshCw,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Mail,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: currentUser, isSuperAdmin } = useUser();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgsData, usersData] = await Promise.all([
        OrganizationService.getAll(),
        UserService.getAll(),
      ]);
      setOrganizations(orgsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const totalOrgs = organizations.length;
  const activeOrgs = organizations.filter(o => o.status === 'ACTIVE').length;
  const totalUsers = users.length;
  const subscribedOrgs = organizations.filter(o => o.type === 'SUBSCRIBED').length;

  if (loading) {
    return (
      <ResponsiveLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <header className="bg-card p-4 border-b border-border sticky top-0 z-10">
        <PageHeader />
      </header>

      <div className="p-4 lg:p-6 space-y-6 mx-auto max-w-7xl">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Super Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage organizations and system settings
            </p>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Organizations</p>
                  <p className="text-2xl font-bold">{totalOrgs}</p>
                </div>
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Organizations</p>
                  <p className="text-2xl font-bold">{activeOrgs}</p>
                </div>
                <Building2 className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Subscribed Tenants</p>
                  <p className="text-2xl font-bold">{subscribedOrgs}</p>
                </div>
                <Crown className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>Manage tenant organizations</CardDescription>
            </div>
            <CreateOrganizationDialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
              onSuccess={() => {
                fetchData();
                setIsCreateDialogOpen(false);
              }}
              users={users}
              currentUserId={currentUser?.uid || ''}
            />
          </CardHeader>
          <CardContent>
            <OrganizationsTable
              organizations={organizations}
              users={users}
              onRefresh={fetchData}
            />
          </CardContent>
        </Card>

        {/* All Users Section with Pagination */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Manage users across all organizations</CardDescription>
          </CardHeader>
          <CardContent>
            <UsersTableWithPagination users={users} organizations={organizations} onRefresh={fetchData} />
          </CardContent>
        </Card>
      </div>
    </ResponsiveLayout>
  );
};

// ============================================================================
// CREATE ORGANIZATION DIALOG
// ============================================================================

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  users: User[];
  currentUserId: string;
}

type AdminAssignmentMode = 'none' | 'existing' | 'invite';

const CreateOrganizationDialog: React.FC<CreateOrganizationDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
  users,
  currentUserId,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subscriptionLevel: 'Free',
  });
  const [adminMode, setAdminMode] = useState<AdminAssignmentMode>('none');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  // Filter users that can be assigned as admin (not already super admins, preferably active)
  const availableUsers = users.filter(u =>
    u.role !== 'SUPER_ADMIN' &&
    u.status === 'ACTIVE'
  );

  const resetForm = () => {
    setFormData({ name: '', subscriptionLevel: 'Free' });
    setAdminMode('none');
    setSelectedUserId('');
    setInviteEmail('');
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Organization name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate admin assignment if mode selected
    if (adminMode === 'existing' && !selectedUserId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a user to assign as admin',
        variant: 'destructive',
      });
      return;
    }

    if (adminMode === 'invite' && !inviteEmail.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an email address to invite',
        variant: 'destructive',
      });
      return;
    }

    // Basic email validation
    if (adminMode === 'invite' && !inviteEmail.includes('@')) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create the organization
      const newOrg = await OrganizationService.create({
        name: formData.name.trim(),
        type: 'SUBSCRIBED',
        subscriptionLevel: formData.subscriptionLevel,
      });

      // Step 2: Handle admin assignment
      if (adminMode === 'existing' && selectedUserId) {
        // Assign existing user as ORG_ADMIN
        const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');

        if (db) {
          // Update user's organization and role
          const userDoc = doc(db, 'users', selectedUserId);
          await updateDoc(userDoc, {
            organizationId: newOrg.id,
            role: 'ORG_ADMIN',
            updatedAt: Timestamp.now(),
          });

          // Also create/update user_roles entry
          await UserRoleService.assignRole(selectedUserId, ROLE_IDS.ORG_ADMIN, newOrg.id, currentUserId);
        }

        toast({
          title: 'Success',
          description: `Organization "${formData.name}" created and admin assigned`,
        });
      } else if (adminMode === 'invite' && inviteEmail.trim()) {
        // Send invitation to email
        await InvitationService.create({
          email: inviteEmail.trim().toLowerCase(),
          organizationId: newOrg.id,
          invitedBy: currentUserId,
          role: 'ORG_ADMIN',
          baseUrl: window.location.origin,
        });

        toast({
          title: 'Success',
          description: `Organization "${formData.name}" created and invitation sent to ${inviteEmail}`,
        });
      } else {
        toast({
          title: 'Success',
          description: `Organization "${formData.name}" created successfully`,
        });
      }

      resetForm();
      onSuccess();
    } catch (error) {
      console.error('Error creating organization:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Organization
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Add a new tenant organization to the platform
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              placeholder="e.g., University of Archaeology"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subscription">Subscription Level</Label>
            <Select
              value={formData.subscriptionLevel}
              onValueChange={(value) => setFormData({ ...formData, subscriptionLevel: value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Free">Free</SelectItem>
                <SelectItem value="Pro">Pro</SelectItem>
                <SelectItem value="Enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Initial Admin Assignment Section */}
          <div className="space-y-3 pt-2 border-t">
            <Label>Initial Organization Admin</Label>
            <p className="text-sm text-muted-foreground">
              Optionally assign an admin to manage this organization
            </p>

            {/* Admin Mode Selection */}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant={adminMode === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdminMode('none')}
                disabled={loading}
                className="justify-start"
              >
                Skip - No admin assignment
              </Button>
              <Button
                type="button"
                variant={adminMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdminMode('existing')}
                disabled={loading}
                className="justify-start"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Select existing user
              </Button>
              <Button
                type="button"
                variant={adminMode === 'invite' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdminMode('invite')}
                disabled={loading}
                className="justify-start"
              >
                <Mail className="w-4 h-4 mr-2" />
                Invite by email
              </Button>
            </div>

            {/* Existing User Selection */}
            {adminMode === 'existing' && (
              <div className="space-y-2 pl-4 border-l-2 border-primary">
                <Label htmlFor="adminUser">Select User *</Label>
                <Select
                  value={selectedUserId}
                  onValueChange={setSelectedUserId}
                  disabled={loading}
                >
                  <SelectTrigger id="adminUser">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.length === 0 ? (
                      <SelectItem value="" disabled>
                        No available users
                      </SelectItem>
                    ) : (
                      availableUsers.map((user) => (
                        <SelectItem key={user.uid} value={user.uid}>
                          {user.displayName || user.email} ({user.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This user will be moved to the new organization and assigned as Org Admin
                </p>
              </div>
            )}

            {/* Email Invitation */}
            {adminMode === 'invite' && (
              <div className="space-y-2 pl-4 border-l-2 border-primary">
                <Label htmlFor="inviteEmail">Email Address *</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  placeholder="admin@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  An invitation will be sent to join as Org Admin
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Organization'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// ORGANIZATIONS TABLE
// ============================================================================

interface OrganizationsTableProps {
  organizations: Organization[];
  users: User[];
  onRefresh: () => void;
}

const OrganizationsTable: React.FC<OrganizationsTableProps> = ({
  organizations,
  users,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    subscriptionLevel: '',
    status: '',
  });
  const [editAdminMode, setEditAdminMode] = useState<AdminAssignmentMode>('none');
  const [editSelectedUserId, setEditSelectedUserId] = useState('');
  const [editInviteEmail, setEditInviteEmail] = useState('');

  // Filter users that can be assigned as admin (not super admins, active users)
  const getAvailableUsersForOrg = (orgId: string) => {
    return users.filter(u =>
      u.role !== 'SUPER_ADMIN' &&
      u.status === 'ACTIVE' &&
      u.organizationId !== orgId // Don't show users already in this org
    );
  };

  const getUserCount = (orgId: string) => {
    return users.filter(u => u.organizationId === orgId).length;
  };

  const getOrgUsers = (orgId: string) => {
    return users.filter(u => u.organizationId === orgId);
  };

  const getOrgAdmins = (orgId: string) => {
    return users.filter(u => u.organizationId === orgId && u.role === 'ORG_ADMIN');
  };

  const handleViewDetails = (org: Organization) => {
    setSelectedOrg(org);
    setIsViewDialogOpen(true);
  };

  const handleEdit = (org: Organization) => {
    setSelectedOrg(org);
    setEditFormData({
      name: org.name,
      subscriptionLevel: org.subscriptionLevel || 'Free',
      status: org.status,
    });
    // Reset admin assignment state
    setEditAdminMode('none');
    setEditSelectedUserId('');
    setEditInviteEmail('');
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrg) return;

    if (!editFormData.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Organization name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate admin assignment if mode selected
    if (editAdminMode === 'existing' && !editSelectedUserId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a user to assign as admin',
        variant: 'destructive',
      });
      return;
    }

    if (editAdminMode === 'invite' && !editInviteEmail.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter an email address to invite',
        variant: 'destructive',
      });
      return;
    }

    if (editAdminMode === 'invite' && !editInviteEmail.includes('@')) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    setEditLoading(true);
    try {
      // Step 1: Update organization details
      await OrganizationService.update(selectedOrg.id, {
        name: editFormData.name.trim(),
        subscriptionLevel: editFormData.subscriptionLevel,
        status: editFormData.status as 'ACTIVE' | 'SUSPENDED' | 'INACTIVE',
      });

      // Step 2: Handle admin assignment if specified
      if (editAdminMode === 'existing' && editSelectedUserId) {
        const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');

        if (db) {
          // Update user's organization and role
          const userDoc = doc(db, 'users', editSelectedUserId);
          await updateDoc(userDoc, {
            organizationId: selectedOrg.id,
            role: 'ORG_ADMIN',
            updatedAt: Timestamp.now(),
          });

          // Also create/update user_roles entry
          const currentUser = users.find(u => u.role === 'SUPER_ADMIN');
          await UserRoleService.assignRole(
            editSelectedUserId,
            ROLE_IDS.ORG_ADMIN,
            selectedOrg.id,
            currentUser?.uid
          );
        }

        toast({
          title: 'Success',
          description: 'Organization updated and admin assigned',
        });
      } else if (editAdminMode === 'invite' && editInviteEmail.trim()) {
        // Send invitation
        const currentUser = users.find(u => u.role === 'SUPER_ADMIN');
        await InvitationService.create({
          email: editInviteEmail.trim().toLowerCase(),
          organizationId: selectedOrg.id,
          invitedBy: currentUser?.uid || '',
          role: 'ORG_ADMIN',
          baseUrl: window.location.origin,
        });

        toast({
          title: 'Success',
          description: `Organization updated and invitation sent to ${editInviteEmail}`,
        });
      } else {
        toast({
          title: 'Success',
          description: 'Organization updated successfully',
        });
      }

      setIsEditDialogOpen(false);
      setSelectedOrg(null);
      onRefresh();
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update organization',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>;
      case 'SUSPENDED':
        return <Badge className="bg-yellow-100 text-yellow-800">Suspended</Badge>;
      case 'INACTIVE':
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTypeBadge = (type: OrganizationType) => {
    switch (type) {
      case 'ROOT':
        return <Badge className="bg-purple-100 text-purple-800">Root</Badge>;
      case 'SUBSCRIBED':
        return <Badge className="bg-blue-100 text-blue-800">Subscribed</Badge>;
      case 'DEFAULT':
        return <Badge className="bg-gray-100 text-gray-800">Default</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const handleSuspend = async (org: Organization) => {
    try {
      await OrganizationService.suspend(org.id);
      toast({ title: 'Organization suspended' });
      onRefresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to suspend organization',
        variant: 'destructive',
      });
    }
  };

  const handleActivate = async (org: Organization) => {
    try {
      await OrganizationService.activate(org.id);
      toast({ title: 'Organization activated' });
      onRefresh();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to activate organization',
        variant: 'destructive',
      });
    }
  };

  const isSystemOrg = (orgId: string) => {
    return orgId === ROOT_ORGANIZATION_ID || orgId === DEFAULT_ORGANIZATION_ID;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Subscription</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Users</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {organizations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No organizations found
              </TableCell>
            </TableRow>
          ) : (
            organizations.map((org) => (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell>{getTypeBadge(org.type)}</TableCell>
                <TableCell>{org.subscriptionLevel}</TableCell>
                <TableCell>{getStatusBadge(org.status)}</TableCell>
                <TableCell className="text-center">{getUserCount(org.id)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewDetails(org)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      {!isSystemOrg(org.id) && (
                        <>
                          <DropdownMenuItem onClick={() => handleEdit(org)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {org.status === 'ACTIVE' ? (
                            <DropdownMenuItem onClick={() => handleSuspend(org)}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleActivate(org)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Activate
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* View Organization Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Organization Details</DialogTitle>
            <DialogDescription>
              Viewing details for {selectedOrg?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{selectedOrg.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Type</Label>
                  <div className="mt-1">{getTypeBadge(selectedOrg.type)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedOrg.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Subscription</Label>
                  <p className="font-medium">{selectedOrg.subscriptionLevel || 'Free'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Organization ID</Label>
                  <p className="font-medium text-xs font-mono break-all">{selectedOrg.id}</p>
                </div>
                {selectedOrg.parentId && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Parent Org ID</Label>
                    <p className="font-medium text-xs font-mono">{selectedOrg.parentId}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground text-xs">Created</Label>
                  <p className="font-medium text-sm">{formatDate(selectedOrg.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Last Updated</Label>
                  <p className="font-medium text-sm">{formatDate(selectedOrg.updatedAt)}</p>
                </div>
              </div>

              {/* Users Summary */}
              <div className="pt-4 border-t">
                <Label className="text-muted-foreground text-xs">Users Summary</Label>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold">{getUserCount(selectedOrg.id)}</p>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-2xl font-bold">{getOrgAdmins(selectedOrg.id).length}</p>
                    <p className="text-sm text-muted-foreground">Org Admins</p>
                  </div>
                </div>
              </div>

              {/* Org Admins List */}
              {getOrgAdmins(selectedOrg.id).length > 0 && (
                <div className="pt-2">
                  <Label className="text-muted-foreground text-xs">Organization Admins</Label>
                  <div className="mt-2 space-y-2">
                    {getOrgAdmins(selectedOrg.id).map((admin) => (
                      <div key={admin.uid} className="flex items-center gap-2 text-sm bg-muted/30 rounded p-2">
                        <Badge className="bg-blue-100 text-blue-800">Admin</Badge>
                        <span className="font-medium">{admin.displayName || 'No name'}</span>
                        <span className="text-muted-foreground">({admin.email})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Members Preview */}
              {getOrgUsers(selectedOrg.id).filter(u => u.role === 'MEMBER').length > 0 && (
                <div className="pt-2">
                  <Label className="text-muted-foreground text-xs">
                    Members ({getOrgUsers(selectedOrg.id).filter(u => u.role === 'MEMBER').length})
                  </Label>
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {getOrgUsers(selectedOrg.id)
                      .filter(u => u.role === 'MEMBER')
                      .slice(0, 5)
                      .map((member) => (
                        <div key={member.uid} className="flex items-center gap-2 text-sm">
                          <span>{member.displayName || member.email}</span>
                        </div>
                      ))}
                    {getOrgUsers(selectedOrg.id).filter(u => u.role === 'MEMBER').length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        +{getOrgUsers(selectedOrg.id).filter(u => u.role === 'MEMBER').length - 5} more members
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* No Users Warning */}
              {getUserCount(selectedOrg.id) === 0 && (
                <div className="pt-2">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                    <p className="font-medium">No users in this organization</p>
                    <p className="text-xs mt-1">Consider assigning an admin or inviting users.</p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update details for {selectedOrg?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedOrg && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-org-name">Organization Name *</Label>
                <Input
                  id="edit-org-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  disabled={editLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-org-subscription">Subscription Level</Label>
                <Select
                  value={editFormData.subscriptionLevel}
                  onValueChange={(value) => setEditFormData({ ...editFormData, subscriptionLevel: value })}
                  disabled={editLoading}
                >
                  <SelectTrigger id="edit-org-subscription">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Free">Free</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-org-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                  disabled={editLoading}
                >
                  <SelectTrigger id="edit-org-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Current Admins Display */}
              {getOrgAdmins(selectedOrg.id).length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-muted-foreground text-xs">Current Org Admins</Label>
                  <div className="space-y-1">
                    {getOrgAdmins(selectedOrg.id).map((admin) => (
                      <div key={admin.uid} className="flex items-center gap-2 text-sm bg-muted/30 rounded p-2">
                        <Badge className="bg-blue-100 text-blue-800">Admin</Badge>
                        <span>{admin.displayName || admin.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Admin Section */}
              <div className="space-y-3 pt-2 border-t">
                <Label>Add Organization Admin</Label>
                <p className="text-sm text-muted-foreground">
                  {getOrgAdmins(selectedOrg.id).length === 0
                    ? 'This organization has no admin. Add one to manage it.'
                    : 'Optionally add another admin to this organization.'}
                </p>

                {/* Admin Mode Selection */}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant={editAdminMode === 'none' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditAdminMode('none')}
                    disabled={editLoading}
                    className="justify-start"
                  >
                    Skip - Don't add admin
                  </Button>
                  <Button
                    type="button"
                    variant={editAdminMode === 'existing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditAdminMode('existing')}
                    disabled={editLoading}
                    className="justify-start"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Select existing user
                  </Button>
                  <Button
                    type="button"
                    variant={editAdminMode === 'invite' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setEditAdminMode('invite')}
                    disabled={editLoading}
                    className="justify-start"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Invite by email
                  </Button>
                </div>

                {/* Existing User Selection */}
                {editAdminMode === 'existing' && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary">
                    <Label htmlFor="edit-admin-user">Select User *</Label>
                    <Select
                      value={editSelectedUserId}
                      onValueChange={setEditSelectedUserId}
                      disabled={editLoading}
                    >
                      <SelectTrigger id="edit-admin-user">
                        <SelectValue placeholder="Choose a user..." />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableUsersForOrg(selectedOrg.id).length === 0 ? (
                          <SelectItem value="" disabled>
                            No available users
                          </SelectItem>
                        ) : (
                          getAvailableUsersForOrg(selectedOrg.id).map((user) => (
                            <SelectItem key={user.uid} value={user.uid}>
                              {user.displayName || user.email} ({user.email})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      This user will be moved to this organization and assigned as Org Admin
                    </p>
                  </div>
                )}

                {/* Email Invitation */}
                {editAdminMode === 'invite' && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary">
                    <Label htmlFor="edit-invite-email">Email Address *</Label>
                    <Input
                      id="edit-invite-email"
                      type="email"
                      placeholder="admin@example.com"
                      value={editInviteEmail}
                      onChange={(e) => setEditInviteEmail(e.target.value)}
                      disabled={editLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      An invitation will be sent to join as Org Admin
                    </p>
                  </div>
                )}
              </div>

              {/* Organization Info (Read-only) */}
              <div className="pt-4 border-t space-y-2">
                <Label className="text-muted-foreground text-xs">Organization ID</Label>
                <p className="font-mono text-xs bg-muted p-2 rounded">{selectedOrg.id}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Type</Label>
                <div>{getTypeBadge(selectedOrg.type)}</div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={editLoading}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================================
// USERS TABLE
// ============================================================================

interface UsersTableProps {
  users: User[];
  organizations: Organization[];
}

const UsersTable: React.FC<UsersTableProps> = ({ users, organizations }) => {
  const getOrgName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return org?.name || 'Unknown';
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>;
      case 'ORG_ADMIN':
        return <Badge className="bg-blue-100 text-blue-800">Org Admin</Badge>;
      case 'MEMBER':
        return <Badge className="bg-gray-100 text-gray-800">Member</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.displayName || 'No name'}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{getOrgName(user.organizationId)}</TableCell>
                <TableCell>{getRoleBadge(user.role)}</TableCell>
                <TableCell>
                  <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {user.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

// ============================================================================
// USERS TABLE WITH PAGINATION
// ============================================================================

interface UsersTableWithPaginationProps {
  users: User[];
  organizations: Organization[];
  onRefresh?: () => void;
}

const UsersTableWithPagination: React.FC<UsersTableWithPaginationProps> = ({
  users,
  organizations,
  onRefresh,
}) => {
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');

  // Dialog states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editFormData, setEditFormData] = useState({
    role: '',
    status: '',
    organizationId: '',
  });

  const getOrgName = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    return org?.name || 'Unknown';
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>;
      case 'ORG_ADMIN':
        return <Badge className="bg-blue-100 text-blue-800">Org Admin</Badge>;
      case 'MEMBER':
        return <Badge className="bg-gray-100 text-gray-800">Member</Badge>;
      default:
        return <Badge>{role}</Badge>;
    }
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      role: user.role || 'MEMBER',
      status: user.status || 'ACTIVE',
      organizationId: user.organizationId || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    setEditLoading(true);
    try {
      // Update user role
      if (editFormData.role !== selectedUser.role) {
        await UserService.updateRole(selectedUser.uid, editFormData.role as any);
      }

      // Update user status
      if (editFormData.status !== selectedUser.status) {
        await UserService.updateStatus(selectedUser.uid, editFormData.status as any);
      }

      // Update organization if changed
      if (editFormData.organizationId !== selectedUser.organizationId) {
        const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        if (db) {
          const userDoc = doc(db, 'users', selectedUser.uid);
          await updateDoc(userDoc, {
            organizationId: editFormData.organizationId,
            updatedAt: Timestamp.now(),
          });
        }
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      setIsEditDialogOpen(false);
      setSelectedUser(null);
      onRefresh?.();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: 'Failed to update user',
        variant: 'destructive',
      });
    } finally {
      setEditLoading(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter users based on search and filters
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      searchQuery === '' ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesOrg = orgFilter === 'all' || user.organizationId === orgFilter;

    return matchesSearch && matchesRole && matchesStatus && matchesOrg;
  });

  // Pagination calculations
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, orgFilter, itemsPerPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Role Filter */}
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
            <SelectItem value="MEMBER">Member</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>

        {/* Organization Filter */}
        <Select value={orgFilter} onValueChange={setOrgFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} users
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || orgFilter !== 'all'
                    ? 'No users match the current filters'
                    : 'No users found'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.displayName || 'No name'}
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getOrgName(user.organizationId)}</TableCell>
                  <TableCell>{getRoleBadge(user.role)}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {user.status || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewUser(user)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditUser(user)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View User Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Viewing details for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Name</Label>
                  <p className="font-medium">{selectedUser.displayName || 'Not set'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Email</Label>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Role</Label>
                  <div className="mt-1">{getRoleBadge(selectedUser.role)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div className="mt-1">
                    <Badge variant={selectedUser.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {selectedUser.status || 'Unknown'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Organization</Label>
                  <p className="font-medium">{getOrgName(selectedUser.organizationId)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">User ID</Label>
                  <p className="font-medium text-xs font-mono">{selectedUser.uid}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Created</Label>
                  <p className="font-medium text-sm">{formatDate(selectedUser.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Last Updated</Label>
                  <p className="font-medium text-sm">{formatDate(selectedUser.updatedAt)}</p>
                </div>
              </div>
              {selectedUser.institution && (
                <div>
                  <Label className="text-muted-foreground text-xs">Institution</Label>
                  <p className="font-medium">{selectedUser.institution}</p>
                </div>
              )}
              {selectedUser.specialization && (
                <div>
                  <Label className="text-muted-foreground text-xs">Specialization</Label>
                  <p className="font-medium">{selectedUser.specialization}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsViewDialogOpen(false);
              if (selectedUser) handleEditUser(selectedUser);
            }}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update details for {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={selectedUser.email} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editFormData.role}
                  onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
                  disabled={editLoading}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="ORG_ADMIN">Org Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                  disabled={editLoading}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-org">Organization</Label>
                <Select
                  value={editFormData.organizationId}
                  onValueChange={(value) => setEditFormData({ ...editFormData, organizationId: value })}
                  disabled={editLoading}
                >
                  <SelectTrigger id="edit-org">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={editLoading}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editLoading}>
              {editLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => setItemsPerPage(Number(value))}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
