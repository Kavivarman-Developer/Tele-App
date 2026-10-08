import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  Check,
  Edit3,
} from 'lucide-react-native';

import { useTemplateStore, WhatsAppTemplate } from '../store/templateStore';
import { toast } from '../store/toastStore';
import { colors, borderRadius, shadows } from '../theme';

interface WhatsAppTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  customerName?: string;
  customerPhone?: string;
  recipientName?: string;
  recipientPhone?: string;
}

export const WhatsAppTemplateModal: React.FC<WhatsAppTemplateModalProps> = ({
  visible,
  onClose,
  customerName,
  customerPhone,
  recipientName,
  recipientPhone,
}) => {
  const activeName = customerName || recipientName || 'Customer';
  const activePhone = customerPhone || recipientPhone || '';

  const { templates, loadTemplates } = useTemplateStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');

  useEffect(() => {
    loadTemplates();
  }, []);

  // When modal becomes visible or activeName changes, select first template and format
  useEffect(() => {
    if (visible && templates.length > 0) {
      const initial = templates[0];
      setSelectedTemplateId(initial.id);
      const formatted = initial.content.replace(/\{name\}/g, activeName);
      setMessageText(formatted);
    }
  }, [visible, templates, activeName]);

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplateId(template.id);
    const formatted = template.content.replace(/\{name\}/g, activeName);
    setMessageText(formatted);
  };

  const handleSend = () => {
    const cleanNum = activePhone.replace(/\D/g, '');
    if (!cleanNum) {
      Alert.alert('Invalid Number', 'This lead does not have a valid phone number.');
      return;
    }

    const encoded = encodeURIComponent(messageText);
    const url = `https://wa.me/91${cleanNum}?text=${encoded}`;

    Linking.openURL(url)
      .then(() => {
        toast.success(`Opening WhatsApp for ${activeName}...`, 'WhatsApp Template');
        onClose();
      })
      .catch(() => {
        toast.warning('Unable to open WhatsApp automatically. Please check if app is installed.');
        Alert.alert('Error', 'Unable to open WhatsApp. Please check if WhatsApp is installed.');
      });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <MessageSquare size={18} color="#16A34A" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Send WhatsApp Service Details</Text>
                <Text style={styles.headerSubtitle}>
                  To: <Text style={{ fontWeight: '700', color: '#0F172A' }}>{activeName}</Text> ({activePhone})
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Template Selection Pills */}
          <View style={styles.templatesSection}>
            <Text style={styles.sectionLabel}>CHOOSE TEMPLATE</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templatePillsRow}
            >
              {templates.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <TouchableOpacity
                    key={tmpl.id}
                    style={[styles.templatePill, isSelected && styles.templatePillActive]}
                    onPress={() => handleSelectTemplate(tmpl)}
                    activeOpacity={0.7}
                  >
                    {isSelected && <Check size={12} color="#16A34A" strokeWidth={3} />}
                    <Text
                      style={[
                        styles.templatePillText,
                        isSelected && styles.templatePillTextActive,
                      ]}
                    >
                      {tmpl.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Message Preview & Edit */}
          <View style={styles.messageBoxWrap}>
            <View style={styles.messageHeaderRow}>
              <Text style={styles.sectionLabel}>MESSAGE PREVIEW & CUSTOMIZATION</Text>
              <View style={styles.editTipRow}>
                <Edit3 size={11} color="#64748B" />
                <Text style={styles.editTipText}>Editable before sending</Text>
              </View>
            </View>

            <TextInput
              style={styles.messageInput}
              multiline
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type or customize your WhatsApp message..."
              placeholderTextColor="#94A3B8"
              textAlignVertical="top"
            />
          </View>

          {/* Send Button */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sendWhatsAppBtn}
              onPress={handleSend}
              activeOpacity={0.8}
            >
              <Send size={15} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.sendWhatsAppText}>Send on WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  templatesSection: {
    marginTop: 14,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  templatePillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  templatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  templatePillActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  templatePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  templatePillTextActive: {
    color: '#16A34A',
    fontWeight: '700',
  },
  messageBoxWrap: {
    marginTop: 14,
  },
  messageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editTipText: {
    fontSize: 10,
    color: '#64748B',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 140,
    lineHeight: 18,
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  sendWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendWhatsAppText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
