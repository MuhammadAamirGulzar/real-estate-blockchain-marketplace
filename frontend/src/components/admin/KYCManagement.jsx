import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useWallet } from '@/contexts/WalletContext';
import { CheckCircle, Clock, Eye, FileText, Loader2, Search, User, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const KYCManagement = () => {
  const { signMessage } = useWallet();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter]);

  const fetchSubmissions = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/admin/kyc/submissions?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSubmissions(data.submissions);
      }
    } catch (error) {
      console.error('Error fetching KYC submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;
    
    setActionLoading(true);
    try {
      const message = `Approve KYC submission ${selectedSubmission.id} for user ${selectedSubmission.user.email} at ${Date.now()}`;
      const signature = await signMessage(message);

      const response = await fetch(`/api/admin/kyc/${selectedSubmission.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ signature, message })
      });

      const data = await response.json();
      if (data.success) {
        setShowApprovalModal(false);
        setSelectedSubmission(null);
        fetchSubmissions();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error approving KYC:', error);
      alert('Failed to approve KYC: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission || !rejectionReason.trim()) return;
    
    setActionLoading(true);
    try {
      const message = `Reject KYC submission ${selectedSubmission.id} for user ${selectedSubmission.user.email} at ${Date.now()}`;
      const signature = await signMessage(message);

      const response = await fetch(`/api/admin/kyc/${selectedSubmission.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ 
          rejectionReason: rejectionReason.trim(),
          signature, 
          message 
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowRejectionModal(false);
        setSelectedSubmission(null);
        setRejectionReason('');
        fetchSubmissions();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error rejecting KYC:', error);
      alert('Failed to reject KYC: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(submission => {
    const matchesSearch = 
      submission.user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getStatusBadge = (status) => {
    const colors = {
      approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      rejected: 'bg-destructive/10 text-destructive border-destructive/30'
    };
    
    const icons = {
      approved: <CheckCircle className="w-3 h-3 mr-1" />,
      pending: <Clock className="w-3 h-3 mr-1" />,
      rejected: <XCircle className="w-3 h-3 mr-1" />
    };
    
    return (
      <Badge className={`${colors[status]} border flex items-center`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>KYC Management</span>
            </CardTitle>
            <div className="text-sm text-slate-600 dark:text-slate-400">
              {filteredSubmissions.length} submissions
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submissions Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800">
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Reviewed By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {submission.user.firstName} {submission.user.lastName}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {submission.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(submission.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {submission.documentsCount} documents
                        </span>
                        {submission.hasSignature && (
                          <Badge variant="outline" className="text-xs">
                            Signed
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {new Date(submission.submittedAt).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {submission.reviewedBy ? (
                        <div className="text-sm">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {submission.reviewedBy.firstName} {submission.reviewedBy.lastName}
                          </p>
                          <p className="text-slate-600 dark:text-slate-400">
                            {submission.reviewedBy.role}
                          </p>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Not reviewed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {submission.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedSubmission(submission);
                                setShowApprovalModal(true);
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedSubmission(submission);
                                setShowRejectionModal(true);
                              }}
                              className="border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost">
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredSubmissions.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No KYC submissions found
              </h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Approve KYC Submission</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-sm text-foreground">
                You are about to approve the KYC submission for{' '}
                <span className="font-medium">
                  {selectedSubmission?.user.firstName} {selectedSubmission?.user.lastName}
                </span>
                . This action will grant them access to blockchain features and cannot be undone without admin intervention.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowApprovalModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve KYC'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={showRejectionModal} onOpenChange={setShowRejectionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span>Reject KYC Submission</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm text-foreground">
                You are about to reject the KYC submission for{' '}
                <span className="font-medium">
                  {selectedSubmission?.user.firstName} {selectedSubmission?.user.lastName}
                </span>
                . Please provide a reason for rejection.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Rejection Reason
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a detailed reason for rejection..."
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={actionLoading || !rejectionReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject KYC'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default KYCManagement;