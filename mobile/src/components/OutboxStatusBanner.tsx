import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useOutboxStore, OutboxItem } from '../store/outboxStore';
import { WifiOff, RefreshCw, AlertCircle, CheckCircle2, Trash2, X } from 'lucide-react-native';

export const OutboxStatusBanner: React.FC = () => {
  const { isOnline, isSyncing, items, retryItem, discardItem, processOutbox } = useOutboxStore();
  const [showModal, setShowModal] = useState(false);

  const pendingItems = items.filter((i) => i.status === 'PENDING' || i.status === 'SYNCING');
  const failedItems = items.filter((i) => i.status === 'FAILED');

  if (isOnline && pendingItems.length === 0 && failedItems.length === 0) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setShowModal(true)}
        style={[
          styles.banner,
          !isOnline
            ? styles.bannerOffline
            : failedItems.length > 0
            ? styles.bannerFailed
            : styles.bannerPending,
        ]}
      >
        <View style={styles.contentRow}>
          {!isOnline ? (
            <WifiOff size={16} color="#DC2626" />
          ) : failedItems.length > 0 ? (
            <AlertCircle size={16} color="#B45309" />
          ) : (
            <RefreshCw size={16} color="#2563EB" />
          )}

          <Text style={styles.bannerText}>
            {!isOnline
              ? `Offline Mode • ${pendingItems.length} changes queued`
              : failedItems.length > 0
              ? `${failedItems.length} update(s) failed sync • Tap to review`
              : isSyncing
              ? `Syncing ${pendingItems.length} update(s)...`
              : `${pendingItems.length} update(s) pending sync`}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Offline Outbox Queue</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSummary}>
              <Text style={styles.summaryText}>
                Connection: <Text style={{ fontWeight: '700', color: isOnline ? '#16A34A' : '#DC2626' }}>{isOnline ? 'Online' : 'Offline'}</Text>
                {'  •  '}Pending: <Text style={{ fontWeight: '700' }}>{pendingItems.length}</Text>
                {'  •  '}Failed: <Text style={{ fontWeight: '700', color: '#DC2626' }}>{failedItems.length}</Text>
              </Text>
            </View>

            {items.length === 0 ? (
              <View style={styles.emptyContainer}>
                <CheckCircle2 size={36} color="#16A34A" />
                <Text style={styles.emptyText}>All updates are synced with server!</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }: { item: OutboxItem }) => (
                  <View style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemType}>{item.type.replace('_', ' ')}</Text>
                      <View
                        style={[
                          styles.badge,
                          item.status === 'SYNCED'
                            ? styles.badgeSynced
                            : item.status === 'FAILED'
                            ? styles.badgeFailed
                            : styles.badgePending,
                        ]}
                      >
                        <Text style={styles.badgeText}>{item.status}</Text>
                      </View>
                    </View>

                    <Text style={styles.itemLead}>Lead Phone: {item.payload.phone || item.leadId}</Text>
                    {item.payload.stage && <Text style={styles.itemDetail}>Stage: {item.payload.stage}</Text>}
                    {item.lastError && (
                      <Text style={styles.itemError}>Error: {item.lastError}</Text>
                    )}

                    <View style={styles.itemActions}>
                      {item.status === 'FAILED' && (
                        <TouchableOpacity
                          style={styles.retryBtn}
                          onPress={() => retryItem(item.id)}
                        >
                          <RefreshCw size={13} color="#FFFFFF" />
                          <Text style={styles.btnText}>Retry</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.discardBtn}
                        onPress={() => discardItem(item.id)}
                      >
                        <Trash2 size={13} color="#EF4444" />
                        <Text style={styles.discardBtnText}>Discard</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}

            {isOnline && pendingItems.length > 0 && (
              <TouchableOpacity
                style={styles.syncAllBtn}
                onPress={() => processOutbox()}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <RefreshCw size={16} color="#FFFFFF" />
                    <Text style={styles.syncAllText}>Sync All Now</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  bannerOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  bannerPending: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  bannerFailed: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  bannerText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalSummary: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  summaryText: {
    fontSize: 13,
    color: '#475569',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemType: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePending: {
    backgroundColor: '#DBEAFE',
  },
  badgeFailed: {
    backgroundColor: '#FEE2E2',
  },
  badgeSynced: {
    backgroundColor: '#DCFCE7',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  itemLead: {
    fontSize: 12.5,
    color: '#334155',
  },
  itemDetail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  itemError: {
    fontSize: 11.5,
    color: '#DC2626',
    marginTop: 4,
    fontWeight: '500',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  btnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  discardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  discardBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  syncAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  syncAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
