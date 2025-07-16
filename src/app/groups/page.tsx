"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, addDoc, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { useFirebase } from '../providers';

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  invitations: string[];
  createdAt: Date;
}

interface User {
  uid: string;
  displayName: string;
  email: string;
}

export default function GroupsPage() {
  const router = useRouter();
  const { db, user, loading: authLoading } = useFirebase();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState<StudyGroup[]>([]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Listen for groups where user is a member or has been invited
  useEffect(() => {
    if (!user) return;

    const groupsQuery = query(
      collection(db, 'studyGroups'),
      where('members', 'array-contains', user.uid)
    );

    const invitationsQuery = query(
      collection(db, 'studyGroups'),
      where('invitations', 'array-contains', user.email)
    );

    const unsubscribeGroups = onSnapshot(groupsQuery, (snapshot) => {
      const groupList: StudyGroup[] = [];
      snapshot.forEach((doc) => {
        groupList.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        } as StudyGroup);
      });
      setGroups(groupList);
      setLoading(false);
    });

    const unsubscribeInvitations = onSnapshot(invitationsQuery, (snapshot) => {
      const invitationList: StudyGroup[] = [];
      snapshot.forEach((doc) => {
        invitationList.push({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        } as StudyGroup);
      });
      setInvitations(invitationList);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeInvitations();
    };
  }, [user, db]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;

    try {
      const newGroup = {
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        createdBy: user.uid,
        members: [user.uid],
        invitations: [],
        createdAt: new Date(),
      };

      await addDoc(collection(db, 'studyGroups'), newGroup);
      setNewGroupName('');
      setNewGroupDescription('');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const handleInviteUser = async (groupId: string) => {
    if (!inviteEmail.trim() || !user) return;

    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      // Check if group already has 3 members
      if (group.members.length >= 3) {
        alert('Groups can only have up to 3 members.');
        return;
      }

      // Check if user is already a member or invited
      if (group.members.includes(inviteEmail) || group.invitations.includes(inviteEmail)) {
        alert('User is already a member or has been invited.');
        return;
      }

      const groupRef = doc(db, 'studyGroups', groupId);
      await updateDoc(groupRef, {
        invitations: arrayUnion(inviteEmail.trim())
      });

      setInviteEmail('');
      alert('Invitation sent!');
    } catch (error) {
      console.error('Error inviting user:', error);
    }
  };

  const handleAcceptInvitation = async (groupId: string) => {
    if (!user) return;

    try {
      const groupRef = doc(db, 'studyGroups', groupId);
      await updateDoc(groupRef, {
        members: arrayUnion(user.uid),
        invitations: arrayRemove(user.email)
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
    }
  };

  const handleDeclineInvitation = async (groupId: string) => {
    if (!user) return;

    try {
      const groupRef = doc(db, 'studyGroups', groupId);
      await updateDoc(groupRef, {
        invitations: arrayRemove(user.email)
      });
    } catch (error) {
      console.error('Error declining invitation:', error);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-end mb-8">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Create Group
          </button>
        </div>

        {/* Invitations */}
      {invitations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Invitations</h2>
          <div className="space-y-4">
            {invitations.map((group) => (
              <div key={group.id} className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{group.name}</h3>
                    <p className="text-gray-600 dark:text-gray-400">{group.description}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAcceptInvitation(group.id)}
                      className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(group.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Create Group Form */}
      {showCreateForm && (
        <div className="mb-8 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Create New Group</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Group Name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="w-full border rounded p-2 text-gray-800 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600"
                placeholder="Enter group name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className="w-full border rounded p-2 text-gray-800 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600"
                rows={3}
                placeholder="Describe your study group"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim()}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                Create Group
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Groups List */}
      <div className="space-y-6">
        {groups.length > 0 ? (
          groups.map((group) => (
            <div key={group.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{group.name}</h3>
                  <p className="text-gray-600 dark:text-gray-400">{group.description}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                    Created {group.createdAt.toLocaleDateString()} • {group.members.length}/3 members
                  </p>
                </div>
                <button
                  onClick={() => setSelectedGroup(selectedGroup?.id === group.id ? null : group)}
                  className="text-blue-500 hover:text-blue-600"
                >
                  {selectedGroup?.id === group.id ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {selectedGroup?.id === group.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  {/* Invite new member */}
                  {group.createdBy === user.uid && group.members.length < 3 && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Invite Member</h4>
                      <div className="flex space-x-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="flex-1 border rounded p-2 text-gray-800 dark:text-gray-200 dark:bg-gray-700 dark:border-gray-600"
                          placeholder="Enter email address"
                        />
                        <button
                          onClick={() => handleInviteUser(group.id)}
                          disabled={!inviteEmail.trim()}
                          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-300"
                        >
                          Invite
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Group members */}
                  <div>
                    <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Members</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Pending invitations */}
                  {group.invitations.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Pending Invitations</h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {group.invitations.map((email, index) => (
                          <div key={index} className="py-1">{email}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">You haven't joined any study groups yet.</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
            >
              Create Your First Group
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
