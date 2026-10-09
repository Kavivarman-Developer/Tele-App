import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export const SAMPLE_LEADS_TEMPLATE_CSV = `name,phone,email,city,agent
Saravanan Balaji,9840123451,saravanan.b@example.com,Chennai,agent@company.com
Geetha Sundaram,9840123452,geetha.s@example.com,Coimbatore,agent@company.com
Murugan Palanivel,9840123453,murugan.p@example.com,Madurai,agent@company.com
Divya Chandran,9840123454,divya.c@example.com,Trichy,agent@company.com
Naveen Raj,9840123455,naveen.r@example.com,Salem,agent@company.com
Pavithra Subramanian,9840123456,pavithra.s@example.com,Tirunelveli,agent@company.com
Gokul Krishnan,9840123457,gokul.k@example.com,Erode,agent@company.com
Janani Venkatesh,9840123458,janani.v@example.com,Vellore,agent@company.com
Harish Narayanan,9840123459,harish.n@example.com,Thanjavur,agent@company.com
Keerthana Ravi,9840123460,keerthana.r@example.com,Dindigul,agent@company.com
`;

/**
 * Downloads or shares a CSV file across Web, Android, and iOS.
 * On Web: Triggers browser download.
 * On Mobile (Android/iOS): Saves to app documents and opens native Share/Save sheet.
 */
export async function downloadOrShareCsv(
  filename: string,
  csvContent: string,
): Promise<{ success: boolean; message: string }> {
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', safeFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, message: `Downloaded ${safeFilename}` };
    } catch (err: any) {
      console.error('Web CSV download error:', err);
      return { success: false, message: err?.message || 'Failed to download CSV' };
    }
  }

  // Native Mobile (Android / iOS)
  try {
    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!baseDir) {
      throw new Error('Local document directory not available');
    }

    const fileUri = `${baseDir}${safeFilename}`;
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: `Download / Save ${safeFilename}`,
        UTI: 'public.comma-separated-values-text',
      });
      return { success: true, message: `CSV saved to ${safeFilename}` };
    } else {
      return {
        success: true,
        message: `CSV saved at ${fileUri}`,
      };
    }
  } catch (err: any) {
    console.error('Mobile CSV export error:', err);
    return { success: false, message: err?.message || 'Could not export CSV file' };
  }
}

/**
 * Converts an array of lead objects into CSV format
 */
export function convertLeadsToCsv(leads: Array<Record<string, any>>): string {
  if (!leads || leads.length === 0) {
    return 'Name,Phone,Email,Stage,Tag,Status,Branch,Next Follow-up,Created At\n';
  }

  const headers = [
    'Name',
    'Phone',
    'Email',
    'Stage',
    'Tag',
    'Status',
    'Branch',
    'Next Follow-up',
    'Created At',
  ];

  const escapeCell = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map((l) => [
    escapeCell(l.name || 'Unnamed'),
    escapeCell(l.phone || ''),
    escapeCell(l.email || ''),
    escapeCell(l.stage || 'New'),
    escapeCell(l.tag || ''),
    escapeCell(l.status || 'OPEN'),
    escapeCell(l.branch || ''),
    escapeCell(l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleString() : ''),
    escapeCell(l.createdAt ? new Date(l.createdAt).toLocaleDateString() : ''),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
